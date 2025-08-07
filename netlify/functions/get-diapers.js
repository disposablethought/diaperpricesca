// Netlify serverless function to fetch diaper data from Neon database
const path = require('path');
const fs = require('fs');

// Import database service and scrapers
const DatabaseService = require('../../database/db-service.js');
const db = new DatabaseService();

// Import individual scrapers for serverless environment
let amazonScraper;
try {
  const AmazonScraper = require('../../server/scrapers/amazon-scraper.js');
  amazonScraper = new AmazonScraper();
  console.log('Amazon scraper loaded successfully');
} catch (error) {
  console.log('Could not load Amazon scraper:', error.message);
}

// Configurable scraping frequency (default: twice daily = 12 hours)
const SCRAPING_INTERVAL = process.env.SCRAPING_INTERVAL_HOURS ? 
  parseInt(process.env.SCRAPING_INTERVAL_HOURS) * 60 * 60 * 1000 : 
  12 * 60 * 60 * 1000; // 12 hours in milliseconds

console.log(`Scraping interval set to ${SCRAPING_INTERVAL / (60 * 60 * 1000)} hours`);

// Last scraping timestamp (stored in memory, could be moved to DB)
let lastScrapingTime = null;

exports.handler = async function(event, context) {
  try {
    // Get query parameters for filtering
    const params = event.queryStringParameters || {};
    const filters = {
      brand: params.brand || 'all',
      size: params.size || 'all', 
      retailer: params.retailer || 'all',
      sortBy: params.sortBy || 'pricePerDiaper',
      sortOrder: params.sortOrder || 'asc'
    };
    
    console.log('Fetching diapers with filters:', filters);
    
    // Check if we should run scheduled scraping
    const now = Date.now();
    const shouldScrape = !lastScrapingTime || (now - lastScrapingTime) >= SCRAPING_INTERVAL;
    
    if (shouldScrape) {
      console.log('Running scheduled scraping...');
      await runScheduledScraping();
      lastScrapingTime = now;
    }
    
    // Get diapers from database with filters
    let diapers = await db.getAllDiapers(filters);
    
    // Transform database results to match frontend expectations
    const transformedDiapers = diapers.map(diaper => ({
      brand: diaper.brand,
      type: diaper.type,
      size: diaper.size,
      count: diaper.count,
      retailer: diaper.retailer,
      price: parseFloat(diaper.price),
      pricePerDiaper: parseFloat(diaper.price_per_diaper),
      url: diaper.url,
      inStock: diaper.in_stock,
      lastUpdated: diaper.updated_at || diaper.last_scraped
    }));
    
    console.log(`Retrieved ${transformedDiapers.length} diapers from database`);
    
    // Return the filtered and sorted data
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        diapers: transformedDiapers,
        count: transformedDiapers.length,
        timestamp: new Date().toISOString(),
        dataSource: 'database'
      })
    };
    
  } catch (error) {
    console.error('Error in get-diapers handler:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Failed to fetch diaper data',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};

// Scheduled scraping function
async function runScheduledScraping() {
  console.log('Starting scheduled scraping of Canadian diaper retailers...');
  
  if (amazonScraper) {
    try {
      const startTime = Date.now();
      console.log('Scraping Amazon.ca for fresh diaper data...');
      
      const scrapingParams = {
        brands: ['Pampers', 'Huggies'], // Key brands
        sizes: ['3'] // Size 3 only
      };
      
      const liveData = await amazonScraper.searchDiapers(scrapingParams);
      const executionTime = Date.now() - startTime;
      
      if (liveData && liveData.length > 0) {
        // Transform scraped data for database
        const diaperData = liveData.map(item => {
          const count = extractCount(item.name);
          if (!count) return null; // Skip items without valid count
          
          return {
            brand: item.brand,
            type: item.name || 'Diapers',
            size: item.size,
            count: count,
            retailer: item.retailer,
            price: item.price,
            pricePerDiaper: item.price / count,
            url: item.url || item.link,
            inStock: item.inStock !== false
          };
        }).filter(item => item !== null);
        
        // Batch upsert to database
        if (diaperData.length > 0) {
          await db.batchUpsertDiapers(diaperData);
          console.log(`Successfully updated ${diaperData.length} products from Amazon.ca`);
        }
        
        // Log successful scraping
        await db.logScrapingSession('Amazon.ca', diaperData.length, true, null, executionTime);
        
      } else {
        console.log('No fresh data from Amazon scraper');
        await db.logScrapingSession('Amazon.ca', 0, false, 'No data returned', executionTime);
      }
      
    } catch (error) {
      console.error('Error during Amazon scraping:', error);
      await db.logScrapingSession('Amazon.ca', 0, false, error.message, null);
    }
  }
  
  console.log('Scheduled scraping completed');
}

// Enhanced count extraction from product name - moved from legacy cache system
function extractCount(name) {
  if (!name) return null;
  
  console.log('Extracting count from:', name);
  
  // Comprehensive regex patterns for diaper counts
  const patterns = [
    /(\d+)\s*(count|ct|pack|pcs?|pieces?|diapers?)(?![\d\.])/i,
    /size\s*\d+[^\d]*(\d+)\s*(count|ct|pack)/i,
    /[\(\[]\s*(\d+)\s*(count|ct|pack|pcs?)[\)\]]/i,
    /-\s*(\d+)\s*(?:ct|count|pack)/i,
    /(\d+)\s+(?:disposable\s+)?(?:diapers?|pieces?)/i,
    /(?:box|case)\s*(?:of\s*)?(\d+)/i,
    /month\s+supply[^\d]*(\d+)/i,
    /(?:giant|mega|super|jumbo)\s+pack[^\d]*(\d+)/i
  ];
  
  // Try each pattern
  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match) {
      const count = parseInt(match[1], 10);
      if (count >= 12 && count <= 300) { // Reasonable range for diaper packs
        console.log(`Count extracted: ${count} using pattern: ${pattern}`);
        return count;
      }
    }
  }
  
  // Fallback: Look for any reasonable number in the product name
  const allNumbers = name.match(/\b(\d{2,3})\b/g);
  if (allNumbers) {
    for (const numStr of allNumbers) {
      const num = parseInt(numStr, 10);
      if (num >= 20 && num <= 300) {
        console.log(`Fallback count extracted: ${num}`);
        return num;
      }
    }
  }
  
  // Smart defaults based on product name keywords
  const nameLower = name.toLowerCase();
  if (nameLower.includes('mega') || nameLower.includes('family')) {
    console.log('Using mega/family default: 144');
    return 144;
  }
  if (nameLower.includes('jumbo') || nameLower.includes('giant')) {
    console.log('Using jumbo/giant default: 120');
    return 120;
  }
  if (nameLower.includes('super') || nameLower.includes('economy')) {
    console.log('Using super/economy default: 96');
    return 96;
  }
  if (nameLower.includes('newborn') || nameLower.includes('preemie')) {
    console.log('Using newborn default: 84');
    return 84;
  }
  
  console.log('No count found, returning null for:', name);
  return null;
}

// Legacy getFallbackData function removed - data now stored in Neon database
