class BrowserManager {
    static instance = null;
    static _config = { headless: true };

    constructor(config = {}) {
        BrowserManager._config = { ...BrowserManager._config, ...config };
    }

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
                headless: BrowserManager._config.headless,
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

    // Instance methods delegating to static methods.
    // Allows both BrowserManager.newPage() and new BrowserManager().newPage().
    async getInstance() { return BrowserManager.getInstance(); }
    async newPage() { return BrowserManager.newPage(); }
    async close() { return BrowserManager.close(); }
}

module.exports = BrowserManager;
