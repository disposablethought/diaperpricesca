const BaseScraper = require('./base-scraper');

/**
 * Scraper for Costco Canada
 */
class CostcoScraper extends BaseScraper {
  constructor() {
    super('Costco Canada', 'https://www.costco.ca');
  }
  
  /**
   * Try different search URL patterns for Costco
   * @param {string} searchQuery - The search query
   * @returns {Array} - Array of URLs to try
   */
  getSearchUrls(searchQuery) {
    const encodedQuery = encodeURIComponent(searchQuery);
    
    return [
      // Standard search
      `${this.baseUrl}/en-ca/search?keyword=${encodedQuery}`,
      // Baby category search
      `${this.baseUrl}/en-ca/category/baby?keyword=${encodedQuery}`,
      // Diaper & training pants category (if available)
      `${this.baseUrl}/en-ca/category/diapers-wipes-training-pants?keyword=${encodedQuery}`,
      // Sort by relevance
      `${this.baseUrl}/en-ca/search?keyword=${encodedQuery}&sortBy=relevance`,
      // Sort by price low to high
      `${this.baseUrl}/en-ca/search?keyword=${encodedQuery}&sortBy=price-asc`
    ];
  }

  /**
   * Search for diapers on Costco Canada with enhanced anti-blocking
   * @param {Object} params - Search parameters
   * @returns {Promise<Array>} - Array of diaper products
   */
  async searchDiapers(params = {}) {
    try {
      const brands = params.brands || ['Pampers', 'Huggies', 'Kirkland'];
      const sizes = params.sizes || ['1', '2', '3', '4', '5', '6'];
      const results = [];
      
      for (const brand of brands) {
        for (const size of sizes) {
          // Try multiple query formats
          const searchQueries = [
            `${brand} diapers size ${size}`,
            `${brand} baby diapers ${size}`,
            `${brand} size ${size} diapers`
          ];
          
          let foundProducts = false;
          
          for (const searchQuery of searchQueries) {
            if (foundProducts) break; // Skip if we already found products
            
            // Get various URL patterns to try
            const searchUrls = this.getSearchUrls(searchQuery);
            
            for (const url of searchUrls) {
              if (foundProducts) break; // Skip if we already found products
              
              try {
                console.log(`Searching Costco Canada for: ${searchQuery} at ${url}`);
                const response = await this.makeRequest(url);
                const $ = this.loadHtml(response.data);
                
                // Check if we're blocked or facing access issues
                if (response.data.includes('access denied') || response.data.includes('captcha') || 
                    response.data.includes('CAPTCHA') || response.data.includes('Too many requests')) {
                  console.log('Costco access denied or CAPTCHA detected - trying alternate URL');
                  continue; // Try the next URL pattern
                }
                
                // Try multiple product container selectors as Costco occasionally updates their HTML structure
                const productSelectors = [
                  '.product-tile-set',
                  '.product-tile',
                  '.product-list-item',
                  '.product-card',
                  '.grid-item'
                ];
                
                for (const selector of productSelectors) {
                  if (foundProducts) break;
                  
                  const products = $(selector);
                  if (products.length === 0) continue;
                  
                  let productsFound = 0;
                  
                  products.each((i, element) => {
                    // Only process the first 8 results
                    if (i >= 8 || foundProducts) return false;
                    
                    // Try multiple title selectors
                    const titleSelectors = [
                      '.description',
                      'a.product-link .description',
                      '.product-title',
                      '.product-name', 
                      'h2',
                      '.item-title'
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
                    
                    // Verify this is a diaper product of the correct brand
                    if (!this.isDiaperProduct(title, brand)) return;
                    
                    // Try multiple price selectors
                    const priceSelectors = [
                      '.product-price-set .product-price-amount',
                      '.price',
                      '.product-price',
                      '.base-price',
                      '.price-value'
                    ];
                    
                    let price = null;
                    for (const priceSelector of priceSelectors) {
                      const priceElement = $(element).find(priceSelector).first();
                      if (priceElement.length) {
                        const priceText = priceElement.text().trim();
                        price = this.cleanPrice(priceText);
                        if (price) break;
                      }
                    }
                    
                    if (!price) return;
                    
                    // Extract product URL using multiple selectors
                    const urlSelectors = ['a.product-link', 'a.product-name', 'a'];
                    let productUrl = '';
                    for (const urlSelector of urlSelectors) {
                      const foundUrl = $(element).find(urlSelector).attr('href') || '';
                      if (foundUrl) {
                        productUrl = foundUrl;
                        break;
                      }
                    }
                    
                    if (!productUrl) return;
                    
                    // Generate product ID from URL or create a unique identifier
                    const productId = productUrl.split('/').pop() || `costco-${Date.now()}-${i}`;
                    
                    // Extract count from title
                    const count = this.extractCount(title);
                    if (!count) return;
                    
                    // Calculate price per diaper
                    const pricePerDiaper = this.calculatePricePerDiaper(price, count);
                    
                    // Generate full product URL
                    const fullUrl = productUrl.startsWith('http') ? productUrl : `${this.baseUrl}${productUrl}`;
                    
                    results.push({
                      id: productId,
                      brand,
                      type: this.extractDiaperType(title, brand),
                      size,
                      count,
                      retailer: this.name,
                      price,
                      pricePerDiaper,
                      url: fullUrl,
                      lastUpdated: new Date()
                    });
                    
                    productsFound++;
                    if (productsFound >= 3) {
                      foundProducts = true;
                      return false; // Exit the .each() loop
                    }
                  });
                }
                
                // If we found products, no need to try more URLs
                if (foundProducts) break;
                
                // Add variable delay between requests
                await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
                
              } catch (error) {
                console.error(`Error searching Costco with URL ${url}:`, error.message);
                continue; // Try the next URL
              }
            }
          }
          
          // Add a longer delay between different size searches
          await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
        }
      }
      
      console.log(`Costco search complete. Found ${results.length} products.`);
      return results;
    } catch (error) {
      console.error('Error in Costco scraper:', error);
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
      'kirkland': {
        'signature': 'Signature'
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

module.exports = CostcoScraper;
