const BaseScraper = require('./base-scraper');

/**
 * Scraper for Shoppers Drug Mart with enhanced anti-blocking
 */
class ShoppersScraper extends BaseScraper {
  constructor() {
    super('Shoppers Drug Mart', 'https://shop.shoppersdrugmart.ca',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  }

  /**
   * Get multiple search URL patterns for Shoppers Drug Mart
   * @param {string} searchQuery - The search query
   * @returns {Array} - Array of URLs to try
   */
  getSearchUrls(searchQuery) {
    const encodedQuery = encodeURIComponent(searchQuery);
    
    return [
      // Standard search
      `${this.baseUrl}/en/search?q=${encodedQuery}`,
      // Baby category search
      `${this.baseUrl}/en/search?q=${encodedQuery}&category=baby`,
      // Health & wellness search
      `${this.baseUrl}/en/search?q=${encodedQuery}&category=health-wellness`,
      // Sort by relevance
      `${this.baseUrl}/en/search?q=${encodedQuery}&sort=relevance`,
      // Sort by price low to high
      `${this.baseUrl}/en/search?q=${encodedQuery}&sort=price-asc`
    ];
  }

  /**
   * Search for diapers on Shoppers Drug Mart with enhanced anti-blocking
   * @param {Object} params - Search parameters
   * @returns {Promise<Array>} - Array of diaper products
   */
  async searchDiapers(params = {}) {
    try {
      const brands = params.brands || ['Pampers', 'Huggies', 'Life Brand', 'Honest Company'];
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
            if (foundProducts) break;
            
            const searchUrls = this.getSearchUrls(searchQuery);
            
            for (const url of searchUrls) {
              if (foundProducts) break;
              
              try {
                console.log(`Searching Shoppers Drug Mart for: ${searchQuery} at ${url}`);
                const response = await this.makeRequest(url);
                const $ = this.loadHtml(response.data);
                
                // Check for blocking or errors
                if (response.data.includes('blocked') || response.data.includes('captcha')) {
                  console.log('Shoppers Drug Mart returned blocking page - trying alternate URL');
                  continue;
                }
                
                // Try multiple selectors for product items
                const productSelectors = [
                  '.product-card',
                  '.product-tile',
                  '.search-result-item',
                  '.product-item'
                ];
                
                for (const selector of productSelectors) {
                  if (foundProducts) break;
                  
                  const products = $(selector);
                  if (products.length === 0) continue;
                  
                  products.each((i, element) => {
                    // Only process the first 5 results
                    if (i >= 5 || foundProducts) return false;
                    
                    // Try multiple selectors for title
                    const titleSelectors = ['.product-card__title', '.product-title', '.item-name', 'h3', 'h4'];
                    let title = '';
                    
                    for (const titleSelector of titleSelectors) {
                      title = $(element).find(titleSelector).text().trim();
                      if (title) break;
                    }
                    
                    if (!title) return;
                    
                    // Skip if not relevant to diapers or not the right brand
                    if (!title.toLowerCase().includes('diaper') || !title.toLowerCase().includes(brand.toLowerCase())) {
                      return;
                    }
                    
                    // Try multiple selectors for price
                    const priceSelectors = ['.price__value', '.product-price', '.current-price', '.sale-price'];
                    let priceText = '';
                    
                    for (const priceSelector of priceSelectors) {
                      priceText = $(element).find(priceSelector).first().text().trim();
                      if (priceText) break;
                    }
                    
                    const price = this.cleanPrice(priceText);
                    
                    if (!price) return;
                    
                    // Try multiple selectors for link
                    const linkSelectors = ['a', '.product-link', '.item-link'];
                    let link = '';
                    
                    for (const linkSelector of linkSelectors) {
                      const linkEl = $(element).find(linkSelector).first();
                      link = linkEl.attr('href');
                      if (link) break;
                    }
                    
                    const fullLink = link && link.startsWith('http') ? link : `${this.baseUrl}${link}`;
                    
                    // Try multiple selectors for image
                    const imageSelectors = ['img', '.product-image img', '.item-image img'];
                    let imageUrl = '';
                    
                    for (const imageSelector of imageSelectors) {
                      const imgEl = $(element).find(imageSelector).first();
                      imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-lazy');
                      if (imageUrl) break;
                    }
                    
                    const fullImageUrl = imageUrl && imageUrl.startsWith('http') ? imageUrl : `${this.baseUrl}${imageUrl}`;
                    
                    if (price && price > 0) {
                      const product = {
                        name: title,
                        price: price,
                        retailer: this.name,
                        brand: brand,
                        size: size,
                        link: fullLink,
                        image: fullImageUrl,
                        inStock: true,
                        lastUpdated: new Date().toISOString()
                      };
                      
                      results.push(product);
                      foundProducts = true;
                      console.log(`Found ${this.name} product: ${title} - $${price}`);
                    }
                  });
                  
                  if (foundProducts) break;
                }
                
                // Add delay between requests
                await this.delay(this.getRandomDelay(800, 1500));
                
              } catch (error) {
                console.error(`Error searching ${this.name} for ${searchQuery} at ${url}:`, error.message);
                // Continue with next URL
              }
            }
          }
        }
      }
      
      console.log(`${this.name} scraping completed. Found ${results.length} products.`);
      return results;
      
    } catch (error) {
      console.error(`Error in ${this.name} scraper:`, error);
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
      'life brand': {
        'ultra dry': 'Ultra Dry',
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

module.exports = ShoppersScraper;
