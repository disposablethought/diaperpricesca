const BaseScraper = require('./base-scraper');
const puppeteer = require('puppeteer');

/**
 * Scraper for Well.ca using Puppeteer for better anti-blocking
 */
class WellScraper extends BaseScraper {
  constructor() {
    super('Well.ca', 'https://well.ca');
    this.browser = null;
    this.browserLaunchTime = null;
    this.maxBrowserLifetime = 1000 * 60 * 30; // 30 minutes
  }
  
  /**
   * Get or initialize a Puppeteer browser instance
   * @returns {Promise<Browser>} - Puppeteer browser instance
   */
  async getBrowser() {
    const currentTime = Date.now();
    
    // If browser exists but has been open too long, close it
    if (this.browser && this.browserLaunchTime && 
        (currentTime - this.browserLaunchTime > this.maxBrowserLifetime)) {
      console.log('Closing old browser session for Well.ca');
      await this.browser.close();
      this.browser = null;
    }
    
    // Launch a new browser if needed
    if (!this.browser) {
      console.log('Launching new Puppeteer browser for Well.ca');
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080',
        ],
        defaultViewport: {
          width: 1920,
          height: 1080
        }
      });
      this.browserLaunchTime = Date.now();
    }
    
    return this.browser;
  }
  
  /**
   * Scrape a product page using Puppeteer
   * @param {string} url - URL to scrape
   * @returns {Promise<Object>} - HTML content and status
   */
  async scrapeWithPuppeteer(url) {
    console.log(`Scraping ${url} with Puppeteer`);
    let page = null;
    
    try {
      const browser = await this.getBrowser();
      page = await browser.newPage();
      
      // Set a realistic user agent
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      );
      
      // Set extra HTTP headers to appear more browser-like
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Referer': 'https://www.google.com/',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      });
      
      // Add a random delay before navigation to seem more human-like
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      
      // Navigate to the URL with a generous timeout
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      // Add some random scrolling to simulate human behavior
      await this.simulateHumanScrolling(page);
      
      // Check if page has CAPTCHA or access denied content
      const pageContent = await page.content();
      const isBlocked = await page.evaluate(() => {
        const html = document.documentElement.innerHTML.toLowerCase();
        return html.includes('captcha') || 
               html.includes('access denied') || 
               html.includes('blocked') || 
               html.includes('security check');
      });
      
      if (isBlocked) {
        console.log('Detected CAPTCHA or access restriction with Puppeteer');
        if (page) await page.close();
        return { html: null, success: false, blocked: true };
      }
      
      return { html: pageContent, success: true, blocked: false };
    } catch (error) {
      console.error(`Error with Puppeteer for ${url}:`, error.message);
      return { html: null, success: false, error: error.message };
    } finally {
      if (page) await page.close();
    }
  }
  
  /**
   * Simulate human-like scrolling behavior
   * @param {Page} page - Puppeteer page instance
   */
  async simulateHumanScrolling(page) {
    try {
      // Get page height
      const pageHeight = await page.evaluate(() => document.body.scrollHeight);
      
      // Scroll down in random increments
      let currentPosition = 0;
      const scrollPoints = Math.floor(Math.random() * 4) + 2; // 2-5 scroll points
      
      for (let i = 0; i < scrollPoints; i++) {
        // Calculate a random position to scroll to
        const scrollAmount = Math.floor((pageHeight / scrollPoints) * (i + 1) * (0.7 + Math.random() * 0.5));
        
        // Scroll to the position
        await page.evaluate((position) => {
          window.scrollTo({
            top: position,
            behavior: 'smooth'
          });
        }, scrollAmount);
        
        // Wait a random amount of time between scrolls (500-2000ms)
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1500));
        currentPosition = scrollAmount;
      }
      
      // Randomly scroll back up a bit
      if (Math.random() > 0.5) {
        const scrollUpAmount = currentPosition * (0.3 + Math.random() * 0.3);
        await page.evaluate((position) => {
          window.scrollTo({
            top: position,
            behavior: 'smooth'
          });
        }, scrollUpAmount);
        
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 800));
      }
    } catch (error) {
      console.error('Error during scroll simulation:', error.message);
      // Continue execution even if scrolling fails
    }
  }
  
  /**
   * Get search URLs for Well.ca with different patterns to try
   * @param {string} searchQuery - Search query string
   * @returns {Array} - Array of URLs to try
   */
  getSearchUrls(searchQuery) {
    const encodedQuery = encodeURIComponent(searchQuery);
    
    return [
      // Standard search
      `${this.baseUrl}/en/search?q=${encodedQuery}`,
      // Baby category search
      `${this.baseUrl}/en/c/baby-child?q=${encodedQuery}`,
      // Diapers category
      `${this.baseUrl}/en/c/baby-child/diapers-potty?q=${encodedQuery}`,
      // Sort by top sellers
      `${this.baseUrl}/en/search?q=${encodedQuery}&sort=best_selling`,
      // Sort by price low to high
      `${this.baseUrl}/en/search?q=${encodedQuery}&sort=price_ascending`
    ];
  }

  /**
   * Search for diapers on Well.ca with Puppeteer-based browser simulation
   * @param {Object} params - Search parameters
   * @returns {Promise<Array>} - Array of diaper products
   */
  async searchDiapers(params = {}) {
    try {
      const brands = params.brands || ['Pampers', 'Huggies', 'Seventh Generation'];
      const sizes = params.sizes || ['1', '2', '3', '4', '5', '6'];
      const results = [];
      
      // Limit search scope for quicker results when testing
      const maxBrands = 2;
      const maxSizes = 2;
      const limitedBrands = brands.slice(0, maxBrands);
      const limitedSizes = sizes.slice(0, maxSizes);

      console.log(`Starting Well.ca scraper with brands: ${limitedBrands.join(', ')} and sizes: ${limitedSizes.join(', ')}`);

      for (const brand of limitedBrands) {
        for (const size of limitedSizes) {
          // Try multiple query formats for better results
          const searchQueries = [
            `${brand} diapers size ${size}`,
            `${brand} baby diapers ${size}`,
            `${brand} diaper size ${size}`
          ];
          
          let foundProducts = false;
          
          for (const searchQuery of searchQueries) {
            if (foundProducts) break; // Skip if we already found products
            
            // Get various URL patterns to try
            const searchUrls = this.getSearchUrls(searchQuery);
            
            // Limit to first 2 URLs to speed up testing
            const limitedUrls = searchUrls.slice(0, 2);
            
            for (const url of limitedUrls) {
              if (foundProducts) break; // Skip if we already found products
              
              try {
                console.log(`Searching Well.ca for: ${searchQuery} at ${url}`);
                
                // Use Puppeteer for browser-like behavior to bypass anti-scraping
                const result = await this.scrapeWithPuppeteer(url);
                
                if (!result.success || result.blocked || !result.html) {
                  console.log(`Puppeteer scraping failed for ${url}, trying next URL`);
                  continue;
                }
                
                // Parse the HTML content with cheerio
                const $ = this.loadHtml(result.html);
                
                // Product container selectors to try
                const productSelectors = [
                  '.product-listing .product-grid-item',
                  '.product-grid .product-item',
                  '.products-list .item',
                  '.products .product',
                  '[data-product-id]',
                  '.product-card',
                  '.product'  // More generic fallback
                ];
                
                // Try each product selector until we find products
                for (const selector of productSelectors) {
                  if (foundProducts) break;
                  
                  const products = $(selector);
                  console.log(`Found ${products.length} potential products with selector: ${selector}`);
                  
                  if (products.length === 0) continue;
                  
                  let productsFound = 0;
                  
                  products.each((i, element) => {
                    // Only process the first few results
                    if (i >= 8 || foundProducts) return false;
                    
                    // Try multiple title selectors
                    const titleSelectors = [
                      '.product-title',
                      '.product-name',
                      'h3',
                      '.title',
                      'a.name',
                      '[itemprop="name"]',
                      'h2',
                      '.name'
                    ];
                    
                    let title = '';
                    for (const titleSelector of titleSelectors) {
                      const foundTitle = $(element).find(titleSelector).first().text().trim();
                      if (foundTitle) {
                        title = foundTitle;
                        break;
                      }
                    }
                    
                    if (!title) return;
                    
                    console.log(`Found product with title: ${title}`);
                    
                    // Verify this is a diaper product of the correct brand
                    if (!this.isDiaperProduct(title, brand)) {
                      console.log(`Skipping product as it's not a diaper or not the right brand: ${title}`);
                      return;
                    }
                    
                    // Try multiple price selectors
                    const priceSelectors = [
                      '.product-price',
                      '.price',
                      '.special-price',
                      '.current-price',
                      '[data-price]',
                      '[itemprop="price"]',
                      '.money',
                      '.amount'
                    ];
                    
                    let price = null;
                    for (const priceSelector of priceSelectors) {
                      const priceElement = $(element).find(priceSelector).first();
                      if (priceElement.length) {
                        const priceText = priceElement.text().trim();
                        price = this.cleanPrice(priceText);
                        if (price) break;
                      } else if (priceSelector === '[data-price]' && $(element).attr('data-price')) {
                        // Some sites store the price in a data attribute
                        price = this.cleanPrice($(element).attr('data-price'));
                        if (price) break;
                      }
                    }
                    
                    if (!price) {
                      console.log(`No price found for product: ${title}`);
                      return;
                    }
                    
                    // Try to extract product ID and URL
                    let productUrl = '';
                    let productId = '';
                    
                    // Try various URL selectors
                    const urlSelectors = ['a', 'a.product-link', '.product-title a', '[itemprop="url"]'];
                    for (const urlSelector of urlSelectors) {
                      const linkElement = $(element).find(urlSelector).first();
                      if (linkElement.length && linkElement.attr('href')) {
                        productUrl = linkElement.attr('href');
                        break;
                      }
                    }
                    
                    // If still no URL, check if the element itself is a link
                    if (!productUrl && $(element).is('a') && $(element).attr('href')) {
                      productUrl = $(element).attr('href');
                    }
                    
                    // If we found a URL, extract ID from it or use a timestamp
                    if (productUrl) {
                      productId = productUrl.split('/').pop() || `well-${Date.now()}-${i}`;
                    } else {
                      // Try to find product ID in data attributes
                      productId = $(element).attr('data-product-id') || $(element).attr('id') || `well-${Date.now()}-${i}`;
                    }
                    
                    // Extract count from title
                    const count = this.extractCount(title);
                    if (!count) {
                      console.log(`Could not find diaper count in: ${title}`);
                      return;
                    }
                    
                    // Calculate price per diaper
                    const pricePerDiaper = this.calculatePricePerDiaper(price, count);
                    
                    // Generate full product URL
                    const fullUrl = productUrl.startsWith('http') ? productUrl : 
                      (productUrl.startsWith('/') ? `${this.baseUrl}${productUrl}` : `${this.baseUrl}/${productUrl}`);
                    
                    const diaperType = this.extractDiaperType(title, brand);
                    
                    console.log(`Found valid diaper product: ${brand} ${diaperType}, Size ${size}, ${count} count, $${price}`);
                    
                    results.push({
                      id: productId,
                      brand,
                      type: diaperType,
                      size,
                      count,
                      retailer: this.name,
                      price,
                      pricePerDiaper,
                      url: fullUrl,
                      lastUpdated: new Date()
                    });
                    
                    productsFound++;
                    if (productsFound >= 2) {
                      foundProducts = true;
                      return false; // Exit the .each() loop
                    }
                  });
                }
                
                // If we found products, no need to try more URLs
                if (foundProducts) break;
                
                // Add variable delay between requests
                const delay = 4000 + Math.random() * 3000;
                console.log(`Adding delay of ${Math.round(delay/1000)} seconds before next request`);
                await new Promise(resolve => setTimeout(resolve, delay));
                
              } catch (error) {
                console.error(`Error searching Well.ca with URL ${url}:`, error.message);
                continue; // Try the next URL
              }
            }
          }
          
          // Add a longer delay between different size searches
          await new Promise(resolve => setTimeout(resolve, 5000 + Math.random() * 3000));
        }
      }
      
      console.log(`Well.ca search complete. Found ${results.length} products.`);
      return results;
    } catch (error) {
      console.error('Error in Well.ca scraper:', error);
      return [];
    } finally {
      // Ensure browser is closed when we're done
      if (this.browser) {
        console.log('Closing Puppeteer browser');
        await this.browser.close();
        this.browser = null;
      }
    }
  }

  /**
   * Determine if a product is a diaper product of the specified brand
   * @param {string} title - Product title
   * @param {string} brand - Target brand
   * @returns {boolean} - True if this is a diaper product of the target brand
   */
  isDiaperProduct(title, brand) {
    if (!title) return false;
    
    const lowerTitle = title.toLowerCase();
    const lowerBrand = brand.toLowerCase();
    
    // Check if title contains the brand
    if (!lowerTitle.includes(lowerBrand)) return false;
    
    // Check if this is a diaper product
    const diaperKeywords = ['diaper', 'diapers', 'nappies', 'nappy'];
    const hasDiaperKeyword = diaperKeywords.some(keyword => lowerTitle.includes(keyword));
    
    // Exclude training pants, swim diapers, and wipes unless specifically searching for them
    const excludeKeywords = ['wipes', 'swim', 'training pants', 'pull-up', 'pull up', 'pullup'];
    const hasExcludeKeyword = excludeKeywords.some(keyword => lowerTitle.includes(keyword));
    
    return hasDiaperKeyword && !hasExcludeKeyword;
  }
  
  /**
   * Clean price text and convert to float
   * @param {string} priceText - Raw price text
   * @returns {number|null} - Cleaned price as a floating point number
   */
  cleanPrice(priceText) {
    if (!priceText) return null;
    
    // Remove currency symbols and commas, keep dots for decimal
    const cleaned = priceText.replace(/[^0-9.]/g, '');
    
    if (!cleaned) return null;
    
    const price = parseFloat(cleaned);
    return isNaN(price) ? null : price;
  }
  
  /**
   * Extract count of diapers from product title
   * @param {string} title - Product title
   * @returns {number|null} - Count of diapers in the pack
   */
  extractCount(title) {
    if (!title) return null;
    
    // Check for common count patterns in title
    // Look for patterns like "192 Count", "192-Count", "Count 192", "192ct", "192 ct"
    const countPatterns = [
      /(\d+)\s*-?\s*count/i,      // 192 Count or 192-Count
      /count\s*-?\s*(\d+)/i,     // Count 192 or Count-192
      /(\d+)\s*-?\s*ct\b/i,      // 192 ct or 192-ct
      /(\d+)\s*-?\s*pieces/i,    // 192 pieces or 192-pieces
      /(\d+)\s*-?\s*pack/i,      // 192 pack or 192-pack
      /(\d+)\s*-?\s*nappies/i,   // 192 nappies or 192-nappies
      /pack\s*of\s*(\d+)/i,      // Pack of 192
      /box\s*of\s*(\d+)/i,       // Box of 192
      /case\s*of\s*(\d+)/i       // Case of 192
    ];
    
    for (const pattern of countPatterns) {
      const match = title.match(pattern);
      if (match && match[1]) {
        const count = parseInt(match[1], 10);
        if (!isNaN(count) && count > 0) {
          return count;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Extract diaper type from product title
   * @param {string} title - Product title
   * @param {string} brand - Diaper brand
   * @returns {string} - Diaper type
   */
  extractDiaperType(title, brand) {
    const lowerTitle = title.toLowerCase();
    
    // Common diaper types by brand
    const typeMap = {
      'pampers': {
        'swaddlers': 'Swaddlers',
        'baby dry': 'Baby Dry',
        'cruisers': 'Cruisers',
        'pure': 'Pure'
      },
      'huggies': {
        'little snugglers': 'Little Snugglers',
        'snug & dry': 'Snug & Dry',
        'little movers': 'Little Movers',
        'special delivery': 'Special Delivery'
      },
      'seventh generation': {
        'free & clear': 'Free & Clear'
      }
    };
    
    const brandTypes = typeMap[brand.toLowerCase()];
    if (brandTypes) {
      for (const [typeKey, typeName] of Object.entries(brandTypes)) {
        if (lowerTitle.includes(typeKey)) {
          return typeName;
        }
      }
    }
    
    // Default case if we can't determine the type
    return 'Regular';
  }
}

module.exports = WellScraper;
