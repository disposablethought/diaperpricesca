const WalmartScraper = require('./walmart-scraper');

describe('WalmartScraper', () => {
    jest.setTimeout(300000);
  let scraper;

  beforeEach(() => {
    scraper = new WalmartScraper();
  });

  it('should fetch diaper products for a given brand and size', async () => {
    const params = { brand: 'huggies', size: '4' };
    const results = await scraper.searchDiapers(params);

    console.log('Test Results:', results);

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);

    const product = results[0];
    expect(product).toHaveProperty('id');
    expect(product).toHaveProperty('brand', 'huggies');
    expect(product).toHaveProperty('size', '4');
    expect(product).toHaveProperty('count');
    expect(product).toHaveProperty('price');
    expect(product).toHaveProperty('pricePerDiaper');
    expect(product).toHaveProperty('url');
    expect(product).toHaveProperty('retailer', 'Walmart');
  }, 30000); // 30 second timeout for the test
});
