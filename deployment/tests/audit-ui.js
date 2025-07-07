import puppeteer from 'puppeteer';
import AxeBuilder from '@axe-core/puppeteer';

const pages = ['/dashboard', '/anomaly-viewer', '/iam', '/audit-log'];
const ignoreSelectors = ['.intercom-widget', '.chatbot'];

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'], ignoreHTTPSErrors: true });
  try {
    for (const path of pages) {
      const page = await browser.newPage();
      await page.goto(`${process.env.UI_URL}${path}`, { waitUntil: 'networkidle0' });
      const builder = new AxeBuilder({ page })
        .include('body')
        .withTags(['wcag2aa']);
      ignoreSelectors.forEach((sel) => builder.exclude(sel));
      const results = await builder.analyze();
      if (results.violations.length) {
        console.error(`Accessibility violations on ${path}`);
        console.error(JSON.stringify(results.violations, null, 2));
        await browser.close();
        process.exit(1);
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
})();
