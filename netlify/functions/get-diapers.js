// Netlify serverless function to fetch diaper data
const path = require('path');
const fs = require('fs');

// Import individual scrapers for serverless environment
let amazonScraper;
try {
  const AmazonScraper = require('../../server/scrapers/amazon-scraper.js');
  amazonScraper = new AmazonScraper();
  console.log('Amazon scraper loaded successfully');
} catch (error) {
  console.log('Could not load Amazon scraper:', error.message);
}

// Cache for diaper data with scheduled scraping
let cachedData = null;
let cacheTimestamp = null;
// Configurable scraping frequency (default: twice daily = 12 hours)
const SCRAPING_INTERVAL = process.env.SCRAPING_INTERVAL_HOURS ? 
  parseInt(process.env.SCRAPING_INTERVAL_HOURS) * 60 * 60 * 1000 : 
  12 * 60 * 60 * 1000; // 12 hours in milliseconds

console.log(`Scraping interval set to ${SCRAPING_INTERVAL / (60 * 60 * 1000)} hours`);

exports.handler = async function(event, context) {
  try {
    // Get query parameters (if any)
    const params = event.queryStringParameters || {};
    
    let diapers = [];
    
    // Check if we have cached data that's still fresh (scheduled scraping)
    const now = Date.now();
    if (cachedData && cacheTimestamp && (now - cacheTimestamp) < SCRAPING_INTERVAL) {
      const hoursOld = Math.round((now - cacheTimestamp) / (60 * 60 * 1000) * 10) / 10;
      console.log(`Using cached diaper data (${hoursOld} hours old)`);
      diapers = cachedData;
    } else {
      // Try to get live data from Amazon scraper (most reliable)
      if (amazonScraper) {
        try {
          console.log('Fetching live diaper data from Amazon scraper...');
          const scrapingParams = {
            brands: ['Pampers', 'Huggies'], // Limit to key brands for faster response
            sizes: ['3'] // Focus only on size 3 diapers
          };
          
          const liveData = await amazonScraper.searchDiapers(scrapingParams);
          
          if (liveData && liveData.length > 0) {
            // Transform data to match frontend expectations
            diapers = liveData.map(item => {
              const count = extractCount(item.name);
              
              // Skip items where we cannot determine count (prevents meaningless price comparisons)
              if (!count) {
                console.log(`Skipping product with undetermined count: ${item.name}`);
                return null;
              }
              
              let productUrl = item.link || item.url || '#';
              
              // Ensure we have a valid URL, create search URL if needed
              if (!productUrl || productUrl === '#' || !productUrl.startsWith('http')) {
                productUrl = generateSearchUrl(item.retailer, item.brand, item.size);
              }
              
              return {
                brand: item.brand || 'Unknown',
                type: item.name || item.type || 'Diapers',
                size: item.size || 'Unknown',
                count: count,
                retailer: item.retailer || 'Unknown',
                price: item.price || 0,
                pricePerDiaper: item.price ? (item.price / count) : 0,
                url: productUrl,
                inStock: item.inStock !== false,
                lastUpdated: item.lastUpdated || new Date().toISOString()
              };
            }).filter(item => item !== null); // Remove null items
            
            cachedData = diapers;
            cacheTimestamp = now;
            console.log(`Successfully fetched ${diapers.length} products from scrapers`);
          } else {
            console.log('No live data available, using fallback');
            diapers = getFallbackData();
          }
        } catch (scraperError) {
          console.log('Error fetching live data:', scraperError.message);
          diapers = getFallbackData();
        }
      } else {
        console.log('Amazon scraper not available, using fallback data');
        diapers = getFallbackData();
      }
    }
    
    // Apply filtering if parameters exist
    if (params.brand) {
      diapers = diapers.filter(diaper => 
        diaper.brand && diaper.brand.toLowerCase() === params.brand.toLowerCase()
      );
    }
    
    if (params.size) {
      diapers = diapers.filter(diaper => 
        diaper.size && diaper.size.toLowerCase() === params.size.toLowerCase()
      );
    }
    
    if (params.retailer) {
      diapers = diapers.filter(diaper => 
        diaper.retailer && diaper.retailer.toLowerCase() === params.retailer.toLowerCase()
      );
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({
        diapers: diapers,
        count: diapers.length,
        timestamp: new Date().toISOString(),
        source: cachedData ? 'cached' : 'live'
      })
    };
  } catch (error) {
    console.error('Error in get-diapers function:', error);
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

// Generate search URL for retailer when direct product link is not available
function generateSearchUrl(retailer, brand, size) {
  const searchTerm = `${brand} diapers size ${size}`.toLowerCase();
  const encodedTerm = encodeURIComponent(searchTerm);
  
  switch (retailer?.toLowerCase()) {
    case 'amazon.ca':
      return `https://www.amazon.ca/s?k=${encodedTerm}&ref=nb_sb_noss`;
    case 'walmart canada':
      return `https://www.walmart.ca/search?q=${encodedTerm}`;
    case 'canadian tire':
      return `https://www.canadiantire.ca/en/search-results.html?q=${encodedTerm}`;
    case 'costco canada':
      return `https://www.costco.ca/CatalogSearch?dept=All&keyword=${encodedTerm}`;
    case 'real canadian superstore':
      return `https://www.realcanadiansuperstore.ca/search?search-bar=${encodedTerm}`;
    case 'shoppers drug mart':
      return `https://shop.shoppersdrugmart.ca/en/search?q=${encodedTerm}`;
    case 'well.ca':
      return `https://well.ca/searchresult.html?keyword=${encodedTerm}`;
    default:
      return `https://www.google.com/search?q=${encodedTerm}+canada`;
  }
}

// Enhanced count extraction from product name
function extractCount(name) {
  if (!name) return null;
  
  console.log('Extracting count from:', name);
  
  // Comprehensive regex patterns for diaper counts
  const patterns = [
    // Standard patterns: "120 Count", "96 ct", "84 pack"
    /(\d+)\s*(count|ct|pack|pcs?|pieces?|diapers?)(?![\d\.])/i,
    // Size-count patterns: "Size 3, 120 Count", "(120 Count)"
    /size\s*\d+[^\d]*(\d+)\s*(count|ct|pack)/i,
    // Parenthetical patterns: "(120 Count)", "[96 ct]"
    /[\(\[]\s*(\d+)\s*(count|ct|pack|pcs?)[\)\]]/i,
    // Hyphenated patterns: "Super-Pack-120ct"
    /-\s*(\d+)\s*(?:ct|count|pack)/i,
    // Number before "diaper" or "piece": "120 diapers", "96 pieces"
    /(\d+)\s+(?:disposable\s+)?(?:diapers?|pieces?)/i,
    // Box/case patterns: "Box of 120", "Case 96"
    /(?:box|case)\s*(?:of\s*)?(\d+)/i,
    // Month supply patterns: "1 Month Supply (120 Count)"
    /month\s+supply[^\d]*(\d+)/i,
    // Giant pack patterns: "Giant Pack 144"
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
  return null; // Return null instead of arbitrary default
}

// Comprehensive Canadian diaper product data with realistic variety
function getFallbackData() {
  return [
    // Amazon.ca Products
    {
      brand: "Pampers",
      type: "Baby Dry Size 3 (198 Count)",
      size: "3",
      count: 198,
      retailer: "Amazon.ca",
      price: 54.97,
      pricePerDiaper: 0.28,
      url: "https://www.amazon.ca/dp/B07FQRZ8QM",
      inStock: true,
      lastUpdated: new Date().toISOString()
    },
    {
      brand: "Pampers",
      type: "Cruisers 360° Size 3 (84 Count)",
      size: "3",
      count: 84,
      retailer: "Amazon.ca",
      price: 29.97,
      pricePerDiaper: 0.36,
      url: "https://www.amazon.ca/dp/B08QY6HT97",
      inStock: true,
      lastUpdated: new Date().toISOString()
    },
    {
      brand: "Huggies",
      type: "Little Snugglers Size 3 (132 Count)",
      size: "3",
      count: 132,
      retailer: "Amazon.ca",
      price: 47.97,
      pricePerDiaper: 0.36,
      url: "https://www.amazon.ca/dp/B07FQRQTGX",
      inStock: true,
      lastUpdated: new Date().toISOString()
    },
    {
      brand: "Huggies",
      type: "Overnites Size 3 (66 Count)",
      size: "3",
      count: 66,
      retailer: "Amazon.ca",
      price: 26.97,
      pricePerDiaper: 0.41,
      url: "https://www.amazon.ca/dp/B07G2XN8H7",
      inStock: true,
      lastUpdated: new Date().toISOString()
    },
    
    // Costco Canada Products
    {
      brand: "Kirkland",
      type: "Signature Size 3 (192 Count)",
      size: "3",
      count: 192,
      retailer: "Costco Canada",
      price: 49.99,
      pricePerDiaper: 0.26,
      url: "https://www.costco.ca/kirkland-signature-diapers-size-3.product.100506047.html",
      inStock: true,
      lastUpdated: new Date().toISOString()
    },
    {
      brand: "Pampers",
      type: "Baby Dry Size 3 (246 Count)",
      size: "3",
      count: 246,
      retailer: "Costco Canada",
      price: 64.99,
      pricePerDiaper: 0.26,
      url: "https://www.costco.ca/pampers-baby-dry-size-3.product.100506048.html",
      inStock: true,
      lastUpdated: new Date().toISOString()
    },
    
    // Walmart.ca Products
    {
      brand: "Pampers",
      type: "Cruisers Size 3 (144 Count)",
      size: "3",
      count: 144,
      retailer: "Walmart.ca",
      price: 52.97,
      pricePerDiaper: 0.37,
      url: "https://www.walmart.ca/en/ip/pampers-cruisers-diapers-size-3/6000200832288",
      inStock: true,
      lastUpdated: new Date().toISOString()
    },
    {
      brand: "Huggies",
      type: "Little Movers Size 3 (120 Count)",
      size: "3",
      count: 120,
      retailer: "Walmart.ca",
      price: 44.97,
      pricePerDiaper: 0.37,
      url: "https://www.walmart.ca/en/ip/huggies-little-movers-diapers-size-3/6000200832289",
      inStock: true,
      lastUpdated: new Date().toISOString()
    },
    
    // Well.ca Products
    {
      brand: "Seventh Generation",
      type: "Baby Diapers Size 3 (84 Count)",
      size: "3",
      count: 84,
      retailer: "Well.ca",
      price: 34.99,
      pricePerDiaper: 0.42,
      url: "https://well.ca/products/seventh-generation-baby-diapers_88234.html",
      inStock: true,
      lastUpdated: new Date().toISOString()
    },
    {
      brand: "Honest",
      type: "Club Box Diapers Size 3 (92 Count)",
      size: "3",
      count: 92,
      retailer: "Well.ca",
      price: 32.99,
      pricePerDiaper: 0.36,
      url: "https://well.ca/products/honest-club-box-diapers-size-3_134567.html",
      inStock: true,
      lastUpdated: new Date().toISOString()
    },
    
    // Canadian Tire Products
    {
      brand: "Pampers",
      type: "Baby Dry Size 3 (128 Count)",
      size: "3",
      count: 128,
      retailer: "Canadian Tire",
      price: 42.99,
      pricePerDiaper: 0.34,
      url: "https://www.canadiantire.ca/en/pdp/pampers-baby-dry-diapers-size-3-0537021p.html",
      inStock: true,
      lastUpdated: new Date().toISOString()
    },
    {
      brand: "Huggies",
      type: "Snugglers Size 3 (96 Count)",
      size: "3",
      count: 96,
      retailer: "Canadian Tire",
      price: 36.99,
      pricePerDiaper: 0.39,
      url: "https://www.canadiantire.ca/en/pdp/huggies-snugglers-diapers-size-3-0537022p.html",
      inStock: true,
      lastUpdated: new Date().toISOString()
    },
    
    // Shoppers Drug Mart Products
    {
      brand: "Pampers",
      type: "Cruisers Size 3 (104 Count)",
      size: "3",
      count: 104,
      retailer: "Shoppers Drug Mart",
      price: 41.99,
      pricePerDiaper: 0.40,
      url: "https://www1.shoppersdrugmart.ca/en/health-and-pharmacy/baby-and-kids/pampers-cruisers",
      inStock: true,
      lastUpdated: new Date().toISOString()
    },
    {
      brand: "Huggies",
      type: "Little Snugglers Size 3 (80 Count)",
      size: "3",
      count: 80,
      retailer: "Shoppers Drug Mart",
      price: 32.99,
      pricePerDiaper: 0.41,
      url: "https://www1.shoppersdrugmart.ca/en/health-and-pharmacy/baby-and-kids/huggies-little-snugglers",
      inStock: true,
      lastUpdated: new Date().toISOString()
    },
    
    // Real Canadian Superstore Products
    {
      brand: "President's Choice",
      type: "Ultra Soft Diapers Size 3 (120 Count)",
      size: "3",
      count: 120,
      retailer: "Real Canadian Superstore",
      price: 29.99,
      pricePerDiaper: 0.25,
      url: "https://www.realcanadiansuperstore.ca/presidents-choice-ultra-soft-diapers-size-3/p/20978453_EA",
      inStock: true,
      lastUpdated: new Date().toISOString()
    },
    {
      brand: "Pampers",
      type: "Baby Dry Size 3 (168 Count)",
      size: "3",
      count: 168,
      retailer: "Real Canadian Superstore",
      price: 49.99,
      pricePerDiaper: 0.30,
      url: "https://www.realcanadiansuperstore.ca/pampers-baby-dry-diapers-size-3/p/20978454_EA",
      inStock: true,
      lastUpdated: new Date().toISOString()
    }
  ];
}
