const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const ac = require('@antiadmin/anticaptchaofficial');
const BaseScraper = require('./base-scraper');

class WalmartScraper extends BaseScraper {
    constructor() {
        super('Walmart');
        // Use environment variable for API key security
        const apiKey = process.env.ANTICAPTCHA_API_KEY;
        if (apiKey) {
            ac.setAPIKey(apiKey);
        } else {
            console.warn('Anti-Captcha API key not found in environment variables');
        }
    }

        async searchDiapers(searchParams) {
        // Note: For now, we'll use a hardcoded URL for testing, as was done previously.
        // A future implementation should construct the URL from searchParams.
        const url = 'https://www.walmart.ca/en/ip/huggies-little-movers-diapers-size-4-150-diapers/6000201375940';
        let browser = null;
        try {
            browser = await puppeteer.launch({ 
                headless: false,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--disable-features=VizDisplayCompositor'
                ]
            });
            const page = await browser.newPage();
            
            // Set realistic viewport and user agent
            await page.setViewport({ width: 1366, height: 768 });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            // Start from homepage to establish session
            console.log('Starting from Walmart homepage...');
            await page.goto('https://www.walmart.ca/en', { waitUntil: 'networkidle2' });
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            console.log('Navigating to product page:', url);
            await page.goto(url, { waitUntil: 'networkidle2' });
            await new Promise(resolve => setTimeout(resolve, 3000));
            console.log('Page loaded successfully');

            const pageInfo = await page.evaluate(() => {
                return {
                    title: document.title,
                    bodyText: document.body.innerText.substring(0, 500),
                    hasHumanVerification: document.title.includes('Human verification'),
                    hasPressAndHold: document.body.innerText.includes('press and hold'),
                    url: window.location.href
                };
            });
            
            console.log('Page info:', pageInfo);
            const isCaptcha = pageInfo.hasHumanVerification || pageInfo.hasPressAndHold;

            if (isCaptcha) {
                console.log('CAPTCHA detected! Solving with Anti-Captcha...');
                console.log('Using template: walmart-perimeter-x');

                try {
                    const solution = await ac.solveAntiGateTask(
                        url,
                        'walmart-perimeter-x', // Template created in Anti-Captcha dashboard
                        {}
                    );

                    console.log('Anti-Captcha solution received:', JSON.stringify(solution, null, 2));

                    if (!solution || !solution.cookies) {
                        await page.screenshot({ path: 'captcha_error.png' });
                        throw new Error('Failed to get a valid solution from Anti-Captcha.');
                    }

                    console.log('Applying cookies and local storage...');
                    const cookies = Object.entries(solution.cookies).map(([name, value]) => ({ name, value, url: page.url() }));
                    await page.setCookie(...cookies);

                    await page.evaluate(localStorageData => {
                        if (!localStorageData) return;
                        for (const [key, value] of Object.entries(localStorageData)) {
                            localStorage.setItem(key, value);
                        }
                    }, solution.localStorage);

                    console.log('Reloading page with CAPTCHA solution...');
                    await page.reload({ waitUntil: 'networkidle2' });

                    console.log('Page reloaded. Taking screenshot...');
                    await page.screenshot({ path: 'post_captcha.png' });
                    const pageTitle = await page.title();
                    console.log('Page title after reload:', pageTitle);

                } catch (error) {
                    console.error('Error solving CAPTCHA with Anti-Captcha:', error);
                    await page.screenshot({ path: 'captcha_fatal_error.png' });
                    throw new Error('Failed to solve CAPTCHA.');
                }
            }

            console.log('Attempting to scrape product data...');
            const productData = await page.evaluate(() => {
                const scriptElement = document.querySelector('script[type="application/ld+json"]');
                if (!scriptElement) {
                    return { error: 'Failed to find product data JSON script.' };
                }

                try {
                    const jsonData = JSON.parse(scriptElement.innerHTML);
                    // The JSON contains an array of objects, we usually want the one of type 'Product'
                    const productInfo = Array.isArray(jsonData) ? jsonData.find(item => item['@type'] === 'Product') : jsonData;

                    if (!productInfo || !productInfo.name || !productInfo.offers) {
                         return { error: 'Product data not found in JSON script.' };
                    }

                    return {
                        title: productInfo.name,
                        price: productInfo.offers.price,
                        size: 'N/A',
                        quantity: 1,
                    };
                } catch (e) {
                    return { error: 'Failed to parse product data JSON.' };
                }
            });

            if (productData.error) {
                console.error(productData.error);
                await page.screenshot({ path: 'scraper_error.png' });
                fs.writeFileSync('scraper_error.html', await page.content());
                throw new Error(productData.error);
            }

            return [{ ...productData, vendor: this.vendor, url }];

        } catch (error) {
            console.error(`Error scraping ${this.vendor}:`, error);
            return [];
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }
}

module.exports = WalmartScraper;
