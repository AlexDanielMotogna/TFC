/**
 * Export X banner to PNG using Puppeteer
 * Run: node assets/export-banner.js
 */

const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Set viewport to banner size
  await page.setViewport({
    width: 1200,
    height: 400,
    deviceScaleFactor: 2, // 2x for high-res
  });

  // Load the HTML file
  const htmlPath = 'file://' + path.resolve(__dirname, 'x-banner.html');
  await page.goto(htmlPath, { waitUntil: 'networkidle0' });

  // Wait for fonts to load
  await page.waitForTimeout(1000);

  // Screenshot the banner element
  const element = await page.$('.banner');
  await element.screenshot({
    path: path.resolve(__dirname, 'x-banner.png'),
    omitBackground: false,
  });

  console.log('✓ Banner exported to assets/x-banner.png');

  await browser.close();
})();
