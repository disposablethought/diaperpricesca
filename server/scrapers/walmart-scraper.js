const BaseScraper = require('./base-scraper');

/**
 * Scraper for Walmart Canada
 */
class WalmartScraper extends BaseScraper {
  constructor() {
    super('Walmart Canada', 'https://www.walmart.ca',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  }

  /**
   * Use Walmart's product API instead of HTML scraping
   * @param {string} searchQuery - The search query
   * @returns {Promise<Object>} - Search results JSON
   */
  async fetchProductDataAPI(searchQuery) {
    const encodedQuery = encodeURIComponent(searchQuery);
    
    // Using Walmart's internal API endpoints which are less likely to be blocked
    const url = `${this.baseUrl}/api/wcs/v2/search/preso?q=${encodedQuery}&sort=price_asc&ps=20&p=1&lang=en`;
    
    console.log(`Fetching Walmart API data for: ${searchQuery}`);
    
    // Add specific API headers
    const originalHeaders = {...this.axiosInstance.defaults.headers};
    this.axiosInstance.defaults.headers = {
      ...this.getRandomHeaders(),
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': `${this.baseUrl}/en/search?q=${encodedQuery}`,
      'Origin': this.baseUrl
    };
    
    try {
      const response = await this.axiosInstance.get(url);
      // Restore original headers
      this.axiosInstance.defaults.headers = originalHeaders;
      
      if (response.data && response.data.products) {
        return response.data;
      }
      throw new Error('Invalid response format from Walmart API');
    } catch (error) {
      // Restore original headers
      this.axiosInstance.defaults.headers = originalHeaders;
      throw error;
    }
  }

  /**
   * Search for diapers on Walmart Canada
   * @param {Object} params - Search parameters
   * @returns {Promise<Array>} - Array of diaper products
   */
  async searchDiapers(params = {}) {
    try {
      const brands = params.brands || ['Pampers', 'Huggies', 'Parents Choice'];
      const sizes = params.sizes || ['1', '2', '3', '4', '5', '6'];
      const results = [];

      for (const brand of brands) {
        for (const size of sizes) {
          // Try different query formats to find products
          const searchQueries = [
            `${brand} diapers size ${size}`,
            `${brand} baby diapers ${size}`,
            `${brand} diaper size ${size}`
          ];
          
          let foundProducts = false;
          
          for (const searchQuery of searchQueries) {
            if (foundProducts) break; // Skip if we already found products with a previous query
            
            try {
              console.log(`Searching Walmart.ca for: ${searchQuery}`);
              
              // Try API approach first
              try {
                const apiData = await this.fetchProductDataAPI(searchQuery);
                
                if (apiData.products && apiData.products.length > 0) {
                  // Process API results
                  for (const product of apiData.products.slice(0, 8)) { // Process up to 8 products
                    // Validate that this is actually a diaper product
                    const title = product.displayName || '';
                    
                    // Skip if not clearly a diaper product of the right brand
                    if (!this.isDiaperProduct(title, brand)) continue;
                    
                    // Extract price
                    let price = null;
                    if (product.currentPrice) {
                      price = parseFloat(product.currentPrice);
                    }
                    
                    if (!price) continue;
                    
                    // Extract count
                    const count = this.extractCount(title);
                    if (!count) continue; // Skip if we can't determine count
                    
                    // Extract product details
                    const productId = product.productId || `walmart-${Date.now()}-${product.id}`;
                    const productUrl = product.productUrl ? 
                      (product.productUrl.startsWith('http') ? product.productUrl : `${this.baseUrl}${product.productUrl}`) : 
                      '';
                    
                    // Calculate price per diaper
                    const pricePerDiaper = this.calculatePricePerDiaper(price, count);
                    
                    results.push({
                      id: productId,
                      brand,
                      type: this.extractDiaperType(title, brand),
                      size: size,
                      count,
                      retailer: this.name,
                      price,
                      pricePerDiaper,
                      url: productUrl,
                      lastUpdated: new Date()
                    });
                    
                    foundProducts = true;
                  }
                }
              } catch (apiError) {
                console.error(`API approach failed for ${searchQuery}:`, apiError.message);
                // Fall back to HTML scraping if API fails
              }
              
              // If API approach didn't work, try HTML scraping
              if (!foundProducts) {
                const encodedQuery = encodeURIComponent(searchQuery);
                const url = `${this.baseUrl}/en/search?q=${encodedQuery}`;
                
                const response = await this.makeRequest(url);
                const $ = this.loadHtml(response.data);
                
                // Process search results - try multiple possible selectors
                const productSelectors = [
                  'div[data-automation="product-tile"]',
                  '.product-tile',
                  'div[data-testid="product-tile"]',
                  '.shelf-item'
                ];
                
                for (const selector of productSelectors) {
                  if (foundProducts) break;
                  
                  $(selector).each((i, element) => {
                    // Only process the first 8 results
                    if (i >= 8) return false;
                    
                    // Extract product information - try multiple selectors
                    const title = $(element).find('[data-automation="name"], .product-name, h3, .product-title').first().text().trim();
                    
                    // Skip if not relevant to diapers or not the right brand
                    if (!this.isDiaperProduct(title, brand)) return;
                    
                    // Extract price - try multiple selectors
                    const priceText = $(element).find('[data-automation="current-price"], .price, .price-current, .product-price').first().text().trim();
                    const price = this.cleanPrice(priceText);
                    
                    if (!price) return;
                    
                    // Extract product ID
                    const productId = $(element).attr('data-product-id') || $(element).attr('id') || `walmart-${Date.now()}-${i}`;
                    
                    // Extract count 
                    const count = this.extractCount(title);
                    if (!count) return;
                    
                    // Calculate price per diaper
                    const pricePerDiaper = this.calculatePricePerDiaper(price, count);
                    
                    // Generate product URL
                    const productUrl = $(element).find('a').attr('href');
                    const fullUrl = productUrl ? (productUrl.startsWith('http') ? productUrl : `${this.baseUrl}${productUrl}`) : '';
                    
                    results.push({
                      id: productId,
                      brand,
                      type: this.extractDiaperType(title, brand),
                      size: size,
                      count,
                      retailer: this.name,
                      price,
                      pricePerDiaper,
                      url: fullUrl,
                      lastUpdated: new Date()
                    });
                    
                    foundProducts = true;
                  });
                }
              }
              
              // If we found products with this query, we can break the query loop
              if (foundProducts) break;
              
            } catch (error) {
              console.error(`Error searching Walmart for ${searchQuery}:`, error.message);
              // Continue to the next search even if one fails
              continue;
            }
          }
          
          // Wait between size searches to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
        }
      }
      
      console.log(`Walmart search complete. Found ${results.length} products.`);
      return results;
    } catch (error) {
      console.error('Error in Walmart scraper:', error);
      return [];
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
      'parents choice': {
        'premium': 'Premium'
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

module.exports = WalmartScraper;
