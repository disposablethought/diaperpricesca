const BaseScraper = require('./base-scraper');

/**
 * Scraper for Amazon.ca
 */
class AmazonScraper extends BaseScraper {
  constructor() {
    super('Amazon.ca', 'https://www.amazon.ca', 
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  }

  /**
   * Try different search URL patterns for Amazon
   * @param {string} searchQuery - The search query
   * @returns {Array} - Array of URLs to try
   */
  getSearchUrls(searchQuery) {
    const encodedQuery = encodeURIComponent(searchQuery);
    
    return [
      // Standard search
      `${this.baseUrl}/s?k=${encodedQuery}&ref=nb_sb_noss`,
      // Baby department search
      `${this.baseUrl}/s?k=${encodedQuery}&i=baby&ref=nb_sb_noss`,
      // Diapers & wipes category search
      `${this.baseUrl}/s?k=${encodedQuery}&i=baby-products&rh=n%3A2224207011&ref=nb_sb_noss`,
      // Sort by featured
      `${this.baseUrl}/s?k=${encodedQuery}&s=featured-rank&ref=nb_sb_ss_ts-doa-p_1_5`,
      // Sort by price low to high
      `${this.baseUrl}/s?k=${encodedQuery}&s=price-asc-rank&ref=nb_sb_ss_ts-doa-p_1_5`
    ];
  }

  /**
   * Search for diapers on Amazon.ca with enhanced anti-blocking
   * @param {Object} params - Search parameters
   * @returns {Promise<Array>} - Array of diaper products
   */
  async searchDiapers(params = {}) {
    try {
      const brands = params.brands || ['Pampers', 'Huggies', 'Kirkland', 'Parents Choice'];
      const sizes = params.sizes || ['1', '2', '3', '4', '5', '6'];
      const results = [];

      // Process one brand and size combination at a time
      for (const brand of brands) {
        for (const size of sizes) {
          // Try multiple query formats
          const searchQueries = [
            `${brand} diapers size ${size}`,
            `${brand} baby diapers ${size}`,
            `${brand} diaper size ${size} pack`
          ];
          
          let foundProducts = false;
          
          for (const searchQuery of searchQueries) {
            if (foundProducts) break; // Skip if we already found products
            
            // Get various URL patterns to try
            const searchUrls = this.getSearchUrls(searchQuery);
            
            for (const url of searchUrls) {
              if (foundProducts) break; // Skip if we already found products
              
              try {
                console.log(`Searching Amazon.ca for: ${searchQuery} at ${url}`);
                const response = await this.makeRequest(url);
                const $ = this.loadHtml(response.data);
                
                // Check if we're blocked or seeing a captcha
                if (response.data.includes('captcha') || response.data.includes('CAPTCHA')) {
                  console.log('Amazon returned a CAPTCHA page - trying alternate URL');
                  continue; // Try the next URL pattern
                }
                
                // Try multiple selectors for product items (Amazon frequently changes their structure)
                const productSelectors = [
                  '.s-result-item[data-asin]',
                  '.sg-col-4-of-24.sg-col-4-of-12',
                  '.sg-col-20-of-24.s-result-item',
                  '.a-section.a-spacing-base',
                  '[data-component-type="s-search-result"]'
                ];
                
                for (const selector of productSelectors) {
                  if (foundProducts) break;
                  
                  const products = $(selector);
                  if (products.length === 0) continue;
                  
                  products.each((i, element) => {
                    // Only process the first 8 results
                    if (i >= 8 || foundProducts) return false;
                    
                    const asin = $(element).attr('data-asin') || $(element).find('[data-asin]').attr('data-asin');
                    if (!asin || asin === '') return;
                    
                    // Try multiple selectors for title
                    const titleSelectors = [
                      'h2 .a-link-normal',
                      '.a-size-base-plus.a-color-base.a-text-normal',
                      '.a-size-medium.a-color-base.a-text-normal',
                      'h2 a span',
                      '.a-text-normal'
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
                    
                    // Extract price using multiple selectors
                    const priceSelectors = [
                      '.a-price .a-offscreen',
                      '.a-price',
                      '.a-color-price',
                      '.a-price-whole'
                    ];
                    
                    let price = null;
                    for (const priceSelector of priceSelectors) {
                      const priceElement = $(element).find(priceSelector).first();
                      
                      if (priceElement.length) {
                        // For offscreen price, it's formatted as "$XX.XX"
                        if (priceSelector === '.a-price .a-offscreen') {
                          const priceText = priceElement.text().trim();
                          price = this.cleanPrice(priceText);
                          break;
                        }
                        // For other price formats
                        else if (priceSelector === '.a-price') {
                          const priceWhole = $(priceElement).find('.a-price-whole').first().text().trim();
                          const priceFraction = $(priceElement).find('.a-price-fraction').first().text().trim();
                          if (priceWhole || priceFraction) {
                            price = parseFloat(`${priceWhole || '0'}.${priceFraction || '00'}`);
                            break;
                          }
                        }
                        // For other price formats
                        else {
                          const priceText = priceElement.text().trim();
                          price = this.cleanPrice(priceText);
                          if (price) break;
                        }
                      }
                    }
                    
                    if (!price) return;
                    
                    // Extract count from title
                    const count = this.extractCount(title);
                    if (!count) return;
                    
                    // Calculate price per diaper
                    const pricePerDiaper = this.calculatePricePerDiaper(price, count);
                    
                    // Generate product URL
                    const productUrl = `${this.baseUrl}/dp/${asin}`;
                    
                    results.push({
                      id: asin,
                      brand,
                      type: this.extractDiaperType(title, brand),
                      size,
                      count,
                      retailer: this.name,
                      price,
                      pricePerDiaper,
                      url: productUrl,
                      lastUpdated: new Date()
                    });
                    
                    foundProducts = true;
                  });
                }
                
                // If we found products, no need to try more URLs
                if (foundProducts) break;
                
                // Add variable delay between requests
                await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
                
              } catch (error) {
                console.error(`Error searching Amazon with URL ${url}:`, error.message);
                continue; // Try the next URL
              }
            }
          }
          
          // Add a longer delay between different size searches
          await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
        }
      }
      
      console.log(`Amazon search complete. Found ${results.length} products.`);
      return results;
    } catch (error) {
      console.error('Error in Amazon scraper:', error);
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

module.exports = AmazonScraper;
