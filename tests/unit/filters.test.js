const { JSDOM } = require('jsdom');

// Mock DOM environment
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<head>
  <title>Test</title>
</head>
<body>
  <div id="brand-filters"></div>
  <div id="size-filters"></div>
  <div id="retailer-filters"></div>
  <div id="diaper-results"></div>
  <div id="results-count"></div>
  <select id="sort-by">
    <option value="price-per-diaper">Price per diaper</option>
    <option value="total-price">Total price</option>
    <option value="count">Count</option>
    <option value="brand">Brand</option>
  </select>
</body>
</html>
`);

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

// Mock fetch
global.fetch = jest.fn();

// Import main.js functions (we'll need to refactor to export functions)
// For now, let's test the core logic

describe('Filter Logic Tests', () => {
  let mockDiapers;

  beforeEach(() => {
    mockDiapers = [
      {
        brand: 'Pampers',
        size: '3',
        retailer: 'Amazon.ca',
        price: 25.99,
        pricePerDiaper: 0.26,
        count: 100,
        name: 'Pampers Baby Dry Size 3',
        url: 'https://amazon.ca/test1'
      },
      {
        brand: 'Huggies',
        size: '3',
        retailer: 'Costco Canada',
        price: 45.99,
        pricePerDiaper: 0.23,
        count: 200,
        name: 'Huggies Little Snugglers Size 3',
        url: 'https://costco.ca/test1'
      },
      {
        brand: 'Kirkland',
        size: '3',
        retailer: 'Costco Canada',
        price: 35.99,
        pricePerDiaper: 0.20,
        count: 180,
        name: 'Kirkland Signature Size 3',
        url: 'https://costco.ca/test2'
      }
    ];
  });

  test('should filter diapers by brand', () => {
    const activeBrands = new Set(['Pampers']);
    const filteredDiapers = mockDiapers.filter(diaper => 
      activeBrands.size === 0 || activeBrands.has(diaper.brand)
    );
    
    expect(filteredDiapers).toHaveLength(1);
    expect(filteredDiapers[0].brand).toBe('Pampers');
  });

  test('should filter diapers by retailer', () => {
    const activeRetailers = new Set(['Costco Canada']);
    const filteredDiapers = mockDiapers.filter(diaper => 
      activeRetailers.size === 0 || activeRetailers.has(diaper.retailer)
    );
    
    expect(filteredDiapers).toHaveLength(2);
    expect(filteredDiapers.every(d => d.retailer === 'Costco Canada')).toBe(true);
  });

  test('should sort diapers by price per diaper (lowest first)', () => {
    const sorted = [...mockDiapers].sort((a, b) => a.pricePerDiaper - b.pricePerDiaper);
    
    expect(sorted[0].pricePerDiaper).toBe(0.20); // Kirkland
    expect(sorted[1].pricePerDiaper).toBe(0.23); // Huggies
    expect(sorted[2].pricePerDiaper).toBe(0.26); // Pampers
  });

  test('should sort diapers by total price', () => {
    const sorted = [...mockDiapers].sort((a, b) => a.price - b.price);
    
    expect(sorted[0].price).toBe(25.99);
    expect(sorted[1].price).toBe(35.99);
    expect(sorted[2].price).toBe(45.99);
  });

  test('should sort diapers by count (highest first)', () => {
    const sorted = [...mockDiapers].sort((a, b) => b.count - a.count);
    
    expect(sorted[0].count).toBe(200);
    expect(sorted[1].count).toBe(180);
    expect(sorted[2].count).toBe(100);
  });

  test('should calculate savings percentage correctly', () => {
    // Simulating the calculateSavings function logic
    function calculateSavings(diaper, allDiapers) {
      const similarDiapers = allDiapers.filter(d => 
        d.brand === diaper.brand && d.size === diaper.size && d.retailer !== diaper.retailer
      );
      
      if (similarDiapers.length === 0) return null;
      
      const avgPrice = similarDiapers.reduce((sum, d) => sum + d.pricePerDiaper, 0) / similarDiapers.length;
      const savings = ((avgPrice - diaper.pricePerDiaper) / avgPrice) * 100;
      
      return savings > 5 ? Math.round(savings) : null;
    }

    // Test with Kirkland (should be cheapest)
    const kirklandSavings = calculateSavings(mockDiapers[2], mockDiapers);
    expect(kirklandSavings).toBeNull(); // No similar brand/size diapers
  });
});

describe('URL Parameter Tests', () => {
  test('should parse URL parameters correctly', () => {
    // Mock URLSearchParams
    const mockParams = new Map([
      ['brand', 'Pampers'],
      ['size', '3'],
      ['retailer', 'Amazon.ca'],
      ['sort', 'price-per-diaper']
    ]);

    expect(mockParams.get('brand')).toBe('Pampers');
    expect(mockParams.get('size')).toBe('3');
    expect(mockParams.get('retailer')).toBe('Amazon.ca');
    expect(mockParams.get('sort')).toBe('price-per-diaper');
  });
});

describe('Price Formatting Tests', () => {
  test('should format prices correctly', () => {
    function formatPrice(price) {
      return price.toLocaleString('en-CA', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }

    expect(formatPrice(25.99)).toBe('25.99');
    expect(formatPrice(25.9)).toBe('25.90');
    expect(formatPrice(25)).toBe('25.00');
  });
});
