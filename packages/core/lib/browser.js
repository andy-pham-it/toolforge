const puppeteer = require('puppeteer');

class BrowserManager {
    static instance = null;

    static async getInstance() {
        if (!BrowserManager.instance) {
            BrowserManager.instance = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                ],
            });
        }
        return BrowserManager.instance;
    }

    static async newPage() {
        const browser = await BrowserManager.getInstance();
        const page = await browser.newPage();
        await page.setViewport({ width: 1400, height: 900 });
        return page;
    }

    static async close() {
        if (BrowserManager.instance) {
            await BrowserManager.instance.close();
            BrowserManager.instance = null;
        }
    }
}

module.exports = BrowserManager;
