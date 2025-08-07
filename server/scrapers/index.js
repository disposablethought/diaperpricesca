const fs = require('fs');
const path = require('path');

/**
 * ScraperManager coordinates all the individual retailer scrapers
 * It dynamically loads all available scrapers, runs them in parallel,
 * and aggregates the results
 */
class ScraperManager {
  constructor() {
    this.scrapers = [];
    this.loadScrapers();
  }

  /**
   * Dynamically load all scraper files from this directory
   */
  loadScrapers() {
    const scraperFiles = fs.readdirSync(__dirname)
      .filter(file => file.endsWith('-scraper.js') && file !== 'base-scraper.js');

    for (const file of scraperFiles) {
      try {
        const ScraperClass = require(path.join(__dirname, file));
        const scraperInstance = new ScraperClass();
        this.scrapers.push(scraperInstance);
        console.log(`Loaded scraper: ${scraperInstance.name}`);
      } catch (error) {
        console.error(`Error loading scraper from ${file}:`, error);
      }
    }
  }

  /**
   * Get an array of all available retailer names
   * @returns {Array<string>} - Array of retailer names
   */
  getRetailers() {
    return this.scrapers.map(s => s.name).sort();
  }

  /**
   * Run a job to fetch all diaper data from all scrapers
   * @param {Object} options - Options for the search job
   * @returns {Promise<Array>} - Results of the search job
   */
  async runScrapingJob(options = {}) {
    console.log('Starting diaper price scraping job...');
    const startTime = Date.now();
    let allProducts = [];

    const scrapingPromises = this.scrapers.map(scraper =>
      scraper.searchDiapers(options)
        .then(products => {
          console.log(`[${scraper.name}] Found ${products.length} products`);
          return products;
        })
        .catch(error => {
          console.error(`Error running scraper for ${scraper.name}:`, error);
          return []; // Return empty array on error to not fail the whole job
        })
    );

    const results = await Promise.all(scrapingPromises);
    allProducts = [].concat(...results);

    const duration = (Date.now() - startTime) / 1000;
    console.log(`Scraping job finished in ${duration.toFixed(2)}s. Total products found: ${allProducts.length}`);

    return allProducts;
  }
}

module.exports = new ScraperManager();
