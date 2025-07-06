const fs = require('fs');
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  const viewports = [320, 768, 1024, 1440];
  fs.mkdirSync('screenshots/responsive', { recursive: true });

  for (const width of viewports) {
    await page.setViewport({ width, height: 800 });
    await page.waitForNetworkIdle();
    await page.screenshot({
      path: `screenshots/responsive/${width}.png`,
      fullPage: true
    });
  }

  await browser.close();
})();
