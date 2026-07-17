class BrowserManager {
    static instance = null;

    static async getInstance() {
        if (!BrowserManager.instance) {
            let puppeteer;
            try {
                puppeteer = require('puppeteer');
            } catch (err) {
                throw new Error(
                    'puppeteer is not available. Install it with: npm install puppeteer\n' +
                    'Or ensure it is in optionalDependencies if your platform supports it.\n' +
                    'Original error: ' + err.message
                );
            }
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
