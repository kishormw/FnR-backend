const puppeteer = require('puppeteer');
const http = require('http');
const dotenv = require("dotenv").config();
const fs = require('fs');
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;
let AUTH_TOKEN = process.env.AUTH_TOKEN;
const PORT = process.env.PORT || 3000;

function extract() {
  const server = http.createServer((req, res) => {
    res.end('Script will execute at scheduled time.');
  });

  server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });

  const updateEnvFile = (newToken) => {
    try {
      dotenv.parsed.AUTH_TOKEN = newToken;
      const serializedEnv = Object.keys(dotenv.parsed)  
        .map(key => `${key}=${dotenv.parsed[key]}`)
        .join('\n');
      fs.writeFileSync('.env', serializedEnv);
    } catch (error) {
      console.error('Error updating .env file:', error);
    }
  };

  const fetchNewToken = async () => {
    //console.log('\nFetching new token...');
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.goto('https://app.meltwater.com/login');
      await page.type('#input_0', EMAIL);
      await Promise.all([
        page.waitForNavigation(),
        page.click('button[type="submit"]')
      ]);
      await page.type('#password', PASSWORD);
      await Promise.all([
        page.waitForNavigation(),
        page.click('button[type="submit"]')
      ]);
      await page.waitForNavigation();
      //console.log('\nCurrent Token:', AUTH_TOKEN);
      await page.setExtraHTTPHeaders({ 'Authorization': `Bearer ${AUTH_TOKEN}` });
      await page.goto('https://live.gaf-identity-provider.meltwater.io/auth/resetToken?rememberMe=false&isActive=true');
      const newToken = await page.evaluate(() => {
        const tokenElement = document.body.textContent;
        const tokenData = JSON.parse(tokenElement);
        return tokenData.token;
      });
      //console.log('\nNext Token:', newToken);
      AUTH_TOKEN = newToken;
      updateEnvFile(newToken);
    } catch (error) {
      console.error('Error occurred:', error);
    } finally {
      await browser.close();
    }

    // Schedule the next token fetch after 23 hours and 59 minutes
    setTimeout(fetchNewToken, (23 * 60 + 30) * 60 * 1000);
  };

  // Start the initial fetch
  fetchNewToken();
}

module.exports = extract;

