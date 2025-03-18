const BaseScraper = require('./base-scraper');

/**
 * Scraper for Real Canadian Superstore
 */
class SuperstoreScraper extends BaseScraper {
  constructor() {
    super('Real Canadian Superstore', 'https://www.realcanadiansuperstore.ca',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  }

  /**
   * Search for diapers on Real Canadian Superstore
   * @param {Object} params - Search parameters
   * @returns {Promise<Array>} - Array of diaper products
   */
  async searchDiapers(params = {}) {
    try {
      const brands = params.brands || ['Pampers', 'Huggies', 'Presidents Choice'];
      const sizes = params.sizes || ['1', '2', '3', '4', '5', '6'];
      const results = [];

      for (const brand of brands) {
        for (const size of sizes) {
          const searchQuery = `${brand} diapers size ${size}`;
          const encodedQuery = encodeURIComponent(searchQuery);
          const url = `${this.baseUrl}/en/search?search-bar=${encodedQuery}`;
          
          try {
            console.log(`Searching Real Canadian Superstore for: ${searchQuery}`);
            const response = await this.makeRequest(url);
            const $ = this.loadHtml(response.data);
            
            // Process search results
            $('.product-tile').each((i, element) => {
              // Only process the first 5 results
              if (i >= 5) return false;
              
              // Extract product information
              const title = $(element).find('.product-name__item--name').text().trim();
              
              // Skip if not relevant to diapers or not the right brand
              if (!title.toLowerCase().includes('diaper') || !title.toLowerCase().includes(brand.toLowerCase())) {
                return;
              }
              
              // Extract price
              const priceText = $(element).find('.price__amount').first().text().trim();
              const price = this.cleanPrice(priceText);
              
              if (!price) return;
              
              // Extract product ID
              const productUrl = $(element).find('a.product-tile__thumbnail__link').attr('href') || '';
              const productId = productUrl.split('/').pop() || `superstore-${Date.now()}-${i}`;
              
              // Extract count (number of diapers)
              let count = null;
              // Look for count in the title (e.g., "198 Count")
              const countMatch = title.match(/(\d+)\s*(count|ct|pack)/i);
              if (countMatch) {
                count = parseInt(countMatch[1], 10);
              }
              
              // Skip if we couldn't find a count
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
            });
            
            // Wait between requests to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 3000));
            
          } catch (error) {
            console.error(`Error searching Superstore for ${searchQuery}:`, error.message);
            // Continue to the next search even if one fails
            continue;
          }
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error in Superstore scraper:', error);
      return [];
    }
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
      'presidents choice': {
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

module.exports = SuperstoreScraper;
