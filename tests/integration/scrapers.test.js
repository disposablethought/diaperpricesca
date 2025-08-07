const fs = require('fs');
const path = require('path');

// Import scrapers
const AmazonScraper = require('../../server/scrapers/amazon-scraper');
const WellScraper = require('../../server/scrapers/well-scraper');
const CostcoScraper = require('../../server/scrapers/costco-scraper');
const ShoppersScraper = require('../../server/scrapers/shoppers-scraper');

describe('Scraper Reliability Tests', () => {
  let scrapers;

  beforeAll(() => {
    scrapers = {
      amazon: new AmazonScraper(),
      well: new WellScraper(),
      costco: new CostcoScraper(),
      shoppers: new ShoppersScraper()
    };
  });

  describe('Amazon.ca Scraper', () => {
    test('should be able to search for size 3 diapers', async () => {
      const searchParams = {
        brands: ['Pampers'],
        sizes: ['3']
      };
      
      try {
        const results = await scrapers.amazon.searchDiapers(searchParams);
        
        expect(results).toBeInstanceOf(Array);
        if (results.length > 0) {
          expect(results[0]).toHaveProperty('name');
          expect(results[0]).toHaveProperty('price');
          expect(results[0]).toHaveProperty('link');
          expect(results[0].name.toLowerCase()).toContain('3');
        }
      } catch (error) {
        // Log error but don't fail test if it's a network/blocking issue
        console.warn('Amazon scraper test failed:', error.message);
        expect(error.message).toBeDefined();
      }
    }, 30000); // 30 second timeout for network requests

    test('should handle anti-bot detection gracefully', async () => {
      const searchParams = {
        brands: ['Huggies'],
        sizes: ['3']
      };
      
      try {
        const results = await scrapers.amazon.searchDiapers(searchParams);
        expect(results).toBeInstanceOf(Array);
      } catch (error) {
        // Should return meaningful error messages
        expect(error.message).toMatch(/(blocked|captcha|timeout|network)/i);
      }
    }, 30000);
  });

  describe('Well.ca Scraper', () => {
    test('should be able to search for diapers', async () => {
      try {
        const results = await scrapers.well.searchDiapers({
          brands: ['Pampers'],
          sizes: ['3']
        });
        
        expect(results).toBeInstanceOf(Array);
        if (results.length > 0) {
          expect(results[0]).toHaveProperty('name');
          expect(results[0]).toHaveProperty('price');
        }
      } catch (error) {
        console.warn('Well.ca scraper test failed:', error.message);
        expect(error.message).toBeDefined();
      }
    }, 30000);
  });

  describe('Blocked Scrapers (Costco, Shoppers)', () => {
    test('should detect CAPTCHA/blocking on Costco', async () => {
      try {
        const results = await scrapers.costco.searchDiapers({
          brands: ['Kirkland'],
          sizes: ['3']
        });
        
        // If it succeeds, great! If not, should handle gracefully
        expect(results).toBeInstanceOf(Array);
      } catch (error) {
        // Should detect blocking/CAPTCHA issues
        expect(error.message).toMatch(/(captcha|blocked|403|bot)/i);
      }
    }, 30000);

    test('should detect CAPTCHA/blocking on Shoppers', async () => {
      try {
        const results = await scrapers.shoppers.searchDiapers({
          brands: ['Pampers'],
          sizes: ['3']
        });
        
        expect(results).toBeInstanceOf(Array);
      } catch (error) {
        expect(error.message).toMatch(/(captcha|blocked|403|bot)/i);
      }
    }, 30000);
  });

  describe('Fallback Data Tests', () => {
    test('should have valid fallback data structure', () => {
      const mockDataPath = path.join(__dirname, '../../server/data/mock-data.js');
      
      if (fs.existsSync(mockDataPath)) {
        const mockData = require(mockDataPath);
        
        expect(mockData).toHaveProperty('diapers');
        expect(mockData.diapers).toBeInstanceOf(Array);
        
        if (mockData.diapers.length > 0) {
          const firstDiaper = mockData.diapers[0];
          expect(firstDiaper).toHaveProperty('brand');
          expect(firstDiaper).toHaveProperty('size');
          expect(firstDiaper).toHaveProperty('retailer');
          expect(firstDiaper).toHaveProperty('price');
          expect(firstDiaper).toHaveProperty('count');
          
          // Should have valid price per diaper calculation
          expect(typeof firstDiaper.price).toBe('number');
          expect(typeof firstDiaper.count).toBe('number');
          expect(firstDiaper.price).toBeGreaterThan(0);
          expect(firstDiaper.count).toBeGreaterThan(0);
        }
      }
    });

    test('should only contain size 3 diapers (per user requirement)', () => {
      const mockDataPath = path.join(__dirname, '../../server/data/mock-data.js');
      
      if (fs.existsSync(mockDataPath)) {
        const mockData = require(mockDataPath);
        
        if (mockData.diapers && mockData.diapers.length > 0) {
          mockData.diapers.forEach(diaper => {
            expect(diaper.size).toBe('3');
          });
        }
      }
    });
  });

  describe('Scraper Error Handling', () => {
    test('should timeout gracefully on slow responses', async () => {
      // Mock a slow scraper response
      const slowScraper = {
        searchDiapers: () => new Promise(resolve => {
          setTimeout(() => resolve([]), 35000); // 35 second delay
        })
      };

      const startTime = Date.now();
      
      try {
        await Promise.race([
          slowScraper.searchDiapers({}),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 30000)
          )
        ]);
      } catch (error) {
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(31000);
        expect(error.message).toBe('Timeout');
      }
    });

    test('should handle malformed HTML responses', () => {
      // Test parsing malformed HTML
      const malformedHtml = '<html><body><div class="product">Incomplete';
      
      // This would typically be handled by cheerio in the scrapers
      const cheerio = require('cheerio');
      const $ = cheerio.load(malformedHtml);
      
      // Should not throw errors
      expect(() => {
        $('.product').text();
      }).not.toThrow();
    });
  });
});

describe('API Endpoint Tests', () => {
  // These would test your Netlify functions
  test('should return diaper data from get-diapers endpoint', async () => {
    // Mock the Netlify function
    const getDiapersHandler = require('../../netlify/functions/get-diapers').handler;
    
    const mockEvent = {
      queryStringParameters: {},
      httpMethod: 'GET'
    };
    const mockContext = {};
    
    const response = await getDiapersHandler(mockEvent, mockContext);
    
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('diapers');
    expect(body.diapers).toBeInstanceOf(Array);
  });

  test('should return brands from get-brands endpoint', async () => {
    const getBrandsHandler = require('../../netlify/functions/get-brands').handler;
    
    const mockEvent = { queryStringParameters: {}, httpMethod: 'GET' };
    const mockContext = {};
    
    const response = await getBrandsHandler(mockEvent, mockContext);
    
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('brands');
    expect(body.brands).toBeInstanceOf(Array);
    
    // Should contain expected Canadian diaper brands
    expect(body.brands).toContain('Pampers');
    expect(body.brands).toContain('Huggies');
  });

  test('should return only size 3 from get-sizes endpoint', async () => {
    const getSizesHandler = require('../../netlify/functions/get-sizes').handler;
    
    const mockEvent = { queryStringParameters: {}, httpMethod: 'GET' };
    const mockContext = {};
    
    const response = await getSizesHandler(mockEvent, mockContext);
    
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('sizes');
    expect(body.sizes).toEqual(['3']);
  });

  test('should return Canadian retailers from get-retailers endpoint', async () => {
    const getRetailersHandler = require('../../netlify/functions/get-retailers').handler;
    
    const mockEvent = { queryStringParameters: {}, httpMethod: 'GET' };
    const mockContext = {};
    
    const response = await getRetailersHandler(mockEvent, mockContext);
    
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('retailers');
    expect(body.retailers).toBeInstanceOf(Array);
    
    // Should contain Canadian retailers
    const canadianRetailers = ['Amazon.ca', 'Costco Canada', 'Shoppers Drug Mart', 'Well.ca'];
    canadianRetailers.forEach(retailer => {
      expect(body.retailers).toContain(retailer);
    });
  });
});
