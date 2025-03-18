const express = require('express');
const router = express.Router();
const scraperManager = require('../scrapers');

// In-memory cache for our data to avoid excessive scraping
let cachedDiapers = [];
let lastCacheUpdate = null;
const CACHE_DURATION = 3600000; // 1 hour in milliseconds

// Helper function to determine if cache is valid
const isCacheValid = () => {
  return (
    cachedDiapers.length > 0 &&
    lastCacheUpdate &&
    Date.now() - lastCacheUpdate < CACHE_DURATION
  );
};

// Helper function to update the cache
const updateCache = async () => {
  try {
    console.log('Updating diaper price cache...');
    const startTime = Date.now();
    
    // This will scrape all retailers
    const freshData = await scraperManager.runScrapingJob();
    
    if (freshData && freshData.length > 0) {
      cachedDiapers = freshData;
      lastCacheUpdate = Date.now();
      
      const duration = (Date.now() - startTime) / 1000;
      console.log(`Cache updated with ${freshData.length} products in ${duration.toFixed(2)} seconds`);
    } else {
      console.log('No data returned from scrapers, keeping existing cache');
    }
  } catch (error) {
    console.error('Error updating cache:', error);
    // If cache update fails but we have existing data, keep using it
    if (cachedDiapers.length === 0) {
      // Fallback to demo data if we have no cache and scraping failed
      console.log('Using fallback demo data');
      cachedDiapers = [
        {
          id: 1,
          brand: "Pampers",
          type: "Swaddlers",
          size: "1",
          count: 198,
          retailer: "Amazon.ca",
          price: 69.99,
          pricePerDiaper: 0.35,
          url: "https://www.amazon.ca/example-link",
          lastUpdated: new Date()
        },
        {
          id: 2,
          brand: "Huggies",
          type: "Little Snugglers",
          size: "1",
          count: 186,
          retailer: "Walmart Canada",
          price: 64.97,
          pricePerDiaper: 0.35,
          url: "https://www.walmart.ca/example-link",
          lastUpdated: new Date()
        }
      ];
      lastCacheUpdate = Date.now();
    }
  }
};

// Middleware to ensure we have fresh data
const ensureFreshData = async (req, res, next) => {
  if (!isCacheValid()) {
    await updateCache();
  }
  next();
};

// Force update cache
router.get('/update-cache', async (req, res) => {
  try {
    await updateCache();
    res.json({ 
      success: true, 
      message: `Cache updated with ${cachedDiapers.length} products`,
      lastUpdate: lastCacheUpdate
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error updating cache',
      error: error.message
    });
  }
});

// Get all diapers
router.get('/diapers', ensureFreshData, (req, res) => {
  res.json(cachedDiapers);
});

// Get diapers by brand
router.get('/diapers/brand/:brand', ensureFreshData, (req, res) => {
  const brand = req.params.brand;
  const filteredDiapers = cachedDiapers.filter(diaper => 
    diaper.brand.toLowerCase() === brand.toLowerCase()
  );
  res.json(filteredDiapers);
});

// Get diapers by size
router.get('/diapers/size/:size', ensureFreshData, (req, res) => {
  const size = req.params.size;
  const filteredDiapers = cachedDiapers.filter(diaper => 
    diaper.size === size
  );
  res.json(filteredDiapers);
});

// Get diapers by retailer
router.get('/diapers/retailer/:retailer', ensureFreshData, (req, res) => {
  const retailer = req.params.retailer;
  const filteredDiapers = cachedDiapers.filter(diaper => 
    diaper.retailer.toLowerCase().includes(retailer.toLowerCase())
  );
  res.json(filteredDiapers);
});

// Get list of all available retailers
router.get('/retailers', ensureFreshData, (req, res) => {
  const retailers = [...new Set(cachedDiapers.map(diaper => diaper.retailer))];
  res.json(retailers);
});

// Get list of all available brands
router.get('/brands', ensureFreshData, (req, res) => {
  const brands = [...new Set(cachedDiapers.map(diaper => diaper.brand))];
  res.json(brands);
});

// Get list of all available sizes
router.get('/sizes', ensureFreshData, (req, res) => {
  const sizes = [...new Set(cachedDiapers.map(diaper => diaper.size))];
  res.json(sizes);
});

// Trigger a custom search with specific parameters
router.post('/search', async (req, res) => {
  try {
    const { brands, sizes, retailers } = req.body;
    
    // Validate input
    if ((!brands || !brands.length) && (!sizes || !sizes.length) && (!retailers || !retailers.length)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide at least one search parameter (brands, sizes, or retailers)'
      });
    }
    
    const searchParams = {};
    if (brands && brands.length) searchParams.brands = brands;
    if (sizes && sizes.length) searchParams.sizes = sizes;
    if (retailers && retailers.length) searchParams.retailers = retailers;
    
    console.log('Running custom search with params:', searchParams);
    const results = await scraperManager.searchDiapers(searchParams);
    
    res.json(results);
  } catch (error) {
    console.error('Error in custom search:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error performing search',
      error: error.message
    });
  }
});

// Test endpoint for testing scrapers directly
router.get('/test-scraper', async (req, res) => {
  try {
    const { retailer, brand, size } = req.query;
    
    if (!retailer) {
      return res.status(400).json({
        success: false,
        message: 'Please specify a retailer to test (e.g., ?retailer=walmart&brand=Pampers&size=2)'
      });
    }
    
    // Import the specific scraper to test
    let scraper;
    const retailerLower = retailer.toLowerCase();
    
    if (retailerLower.includes('well')) {
      const WellScraper = require('../scrapers/well-scraper');
      scraper = new WellScraper();
    } else if (retailerLower.includes('walmart')) {
      const WalmartScraper = require('../scrapers/walmart-scraper');
      scraper = new WalmartScraper();
    } else if (retailerLower.includes('amazon')) {
      const AmazonScraper = require('../scrapers/amazon-scraper');
      scraper = new AmazonScraper();
    } else if (retailerLower.includes('costco')) {
      const CostcoScraper = require('../scrapers/costco-scraper');
      scraper = new CostcoScraper();
    } else {
      return res.status(400).json({
        success: false,
        message: `Unsupported retailer: ${retailer}. Available options: well, walmart, amazon, costco`
      });
    }
    
    console.log(`Testing ${retailer} scraper with brand=${brand}, size=${size}`);
    
    const searchParams = {};
    if (brand) searchParams.brands = [brand];
    if (size) searchParams.sizes = [size];
    
    // Search for diapers using the specified scraper
    const startTime = Date.now();
    const results = await scraper.searchDiapers(searchParams);
    const duration = (Date.now() - startTime) / 1000;
    
    res.json({
      success: true,
      retailer,
      searchParams,
      durationSeconds: duration.toFixed(2),
      resultsCount: results.length,
      results
    });
  } catch (error) {
    console.error('Error testing scraper:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing scraper',
      error: error.toString(),
      stack: error.stack
    });
  }
});

module.exports = router;
