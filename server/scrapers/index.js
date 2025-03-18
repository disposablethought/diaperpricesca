const generateMockData = require('../data/mock-data');

/**
 * ScraperManager provides a unified interface to access diaper pricing data
 * While originally designed to coordinate real web scrapers, this version uses
 * mock data to ensure reliable operation even when web scraping is blocked
 */
class ScraperManager {
  constructor() {
    // Generate our mock data once at startup
    this.allProducts = generateMockData();
    
    // Extract all unique retailers from the data
    this.retailers = [...new Set(this.allProducts.map(product => product.retailer))].sort();
    
    console.log(`Initialized with ${this.allProducts.length} mock diaper products from ${this.retailers.length} retailers`);
  }

  /**
   * Get an array of all available retailer names
   * @returns {Array<string>} - Array of retailer names
   */
  getRetailers() {
    return this.retailers;
  }

  /**
   * Filter products based on search parameters
   * @param {Array} products - Array of products to filter
   * @param {Object} params - Search parameters
   * @returns {Array} - Filtered array of products
   */
  filterProducts(products, params = {}) {
    const { brands, sizes, retailers } = params;
    
    return products.filter(product => {
      // Filter by brand if specified
      if (brands && brands.length > 0) {
        if (!brands.some(brand => 
          product.brand.toLowerCase().includes(brand.toLowerCase())
        )) {
          return false;
        }
      }
      
      // Filter by size if specified
      if (sizes && sizes.length > 0) {
        if (!sizes.includes(product.size)) {
          return false;
        }
      }
      
      // Filter by retailer if specified
      if (retailers && retailers.length > 0) {
        if (!retailers.some(retailer => 
          product.retailer.toLowerCase().includes(retailer.toLowerCase())
        )) {
          return false;
        }
      }
      
      return true;
    });
  }

  /**
   * Search for diapers across all retailers or specified retailers
   * @param {Object} params - Search parameters
   * @param {Array<string>} [params.retailers] - Optional list of retailers to search
   * @param {Array<string>} [params.brands] - Optional list of brands to search for
   * @param {Array<string>} [params.sizes] - Optional list of sizes to search for
   * @returns {Promise<Array>} - Array of diaper products from all retailers
   */
  async searchDiapers(params = {}) {
    console.log(`Searching for diapers with params:`, params);
    
    try {
      // Apply filters to our mock data
      const filteredResults = this.filterProducts(this.allProducts, params);
      
      console.log(`Found ${filteredResults.length} diaper products matching search criteria`);
      
      // Simulate network delay for realism
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return filteredResults;
    } catch (error) {
      console.error('Error in diaper search:', error);
      return [];
    }
  }

  /**
   * Run a job to fetch all diaper data (or filtered subset)
   * @param {Object} options - Options for the search job
   * @returns {Promise<Array>} - Results of the search job
   */
  async runScrapingJob(options = {}) {
    console.log('Starting diaper price data retrieval...');
    const startTime = Date.now();
    
    const results = await this.searchDiapers(options);
    
    const endTime = Date.now();
    const durationSeconds = (endTime - startTime) / 1000;
    
    console.log(`Data retrieval completed in ${durationSeconds.toFixed(2)} seconds. Found ${results.length} products.`);
    
    return results;
  }
}

module.exports = new ScraperManager();
