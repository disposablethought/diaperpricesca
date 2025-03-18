const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');
const HttpsProxyAgent = require('https-proxy-agent');

/**
 * Base Scraper class that provides common functionality for all retailer scrapers
 */
class BaseScraper {
  constructor(name, baseUrl, userAgent) {
    this.name = name;
    this.baseUrl = baseUrl;
    this.userAgent = userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
    this.retryCount = 3;
    this.retryDelay = 1500;
    
    // List of potential headers to rotate through
    this.userAgents = [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    ];
    
    // Configure axios with enhanced settings to avoid detection
    this.configureAxios();
  }
  
  /**
   * Configure axios with settings to avoid bot detection
   */
  configureAxios() {
    // Create HTTPS agent that ignores certificate errors
    const httpsAgent = new https.Agent({ 
      rejectUnauthorized: false,
      keepAlive: true
    });
    
    this.axiosInstance = axios.create({
      headers: this.getRandomHeaders(),
      timeout: 15000,
      httpsAgent,
      maxRedirects: 5,
      validateStatus: function (status) {
        return status >= 200 && status < 500; // Accept all responses except server errors
      }
    });
  }
  
  /**
   * Get random user agent from the list
   * @returns {string} - Random user agent
   */
  getRandomUserAgent() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }
  
  /**
   * Get headers that mimic real browser behavior
   * @returns {Object} - Headers object
   */
  getRandomHeaders() {
    return {
      'User-Agent': this.getRandomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-CA,en-US;q=0.9,en;q=0.8,fr;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://www.google.ca/',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'cross-site',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
      'sec-ch-ua': '"Chromium";v="122", "Google Chrome";v="122", "Not:A-Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"'
    };
  }

  /**
   * Make an HTTP request to the specified URL with advanced anti-blocking techniques
   * @param {string} url - The URL to fetch
   * @returns {Promise<Object>} - The HTTP response
   */
  async makeRequest(url) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.retryCount; attempt++) {
      try {
        console.log(`Fetching ${url} from ${this.name} (Attempt ${attempt}/${this.retryCount})`);
        
        // Use exponential backoff strategy with jitter
        const jitter = Math.random() * 500;
        const delay = Math.min(((this.retryDelay * Math.pow(1.5, attempt - 1)) + jitter), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Rotate headers on each attempt
        this.axiosInstance.defaults.headers = this.getRandomHeaders();
        
        const response = await this.axiosInstance.get(url);
        
        // Check if we got a CAPTCHA or empty response
        if (response.data.includes('captcha') || response.data.includes('CAPTCHA') || response.data.length < 1000) {
          console.log(`Detected potential CAPTCHA or blocked response from ${this.name}`);
          throw new Error('CAPTCHA detected or blocked response');
        }
        
        return response;
      } catch (error) {
        lastError = error;
        console.error(`Attempt ${attempt} for ${this.name} failed: ${error.message}`);
        
        // If we have retries left, we'll try again after a delay
        if (attempt < this.retryCount) {
          continue;
        }
      }
    }
    
    // All retries failed
    console.error(`All ${this.retryCount} attempts to fetch from ${this.name} failed`);
    throw lastError || new Error(`Failed to fetch from ${this.name} after ${this.retryCount} attempts`);
  }

  /**
   * Load HTML content with Cheerio for parsing
   * @param {string} html - HTML content to parse
   * @returns {Object} - Cheerio object for querying
   */
  loadHtml(html) {
    return cheerio.load(html);
  }

  /**
   * Calculate price per diaper
   * @param {number} price - Total price
   * @param {number} count - Number of diapers
   * @returns {number} - Price per diaper
   */
  calculatePricePerDiaper(price, count) {
    if (!price || !count || count === 0) {
      return null;
    }
    return parseFloat((price / count).toFixed(2));
  }

  /**
   * Clean price string and convert to number
   * @param {string} priceStr - Price string (e.g. "$19.99" or "19,99 $")
   * @returns {number} - Price as a number
   */
  cleanPrice(priceStr) {
    if (!priceStr) return null;
    
    // Remove currency symbols, commas, and other non-numeric characters except for decimal point
    const cleaned = priceStr.replace(/[^\d.]/g, '');
    return parseFloat(cleaned);
  }

  /**
   * Extract number from string (e.g. "198 count" -> 198)
   * @param {string} str - String containing a number
   * @returns {number} - Extracted number
   */
  extractNumber(str) {
    if (!str) return null;
    
    const matches = str.match(/\d+/);
    if (matches && matches.length > 0) {
      return parseInt(matches[0], 10);
    }
    return null;
  }

  /**
   * Search for diapers - should be implemented by each retailer
   * @param {Object} searchParams - Search parameters
   * @returns {Promise<Array>} - Array of diaper products
   */
  async searchDiapers(searchParams) {
    throw new Error('Method searchDiapers must be implemented by subclass');
  }
}

module.exports = BaseScraper;
