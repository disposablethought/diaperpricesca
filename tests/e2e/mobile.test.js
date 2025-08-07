const puppeteer = require('puppeteer');

describe('Mobile Compatibility Tests', () => {
  let browser;
  let page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    // Set mobile viewport
    await page.setViewport({
      width: 375,
      height: 667,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2
    });
  });

  afterEach(async () => {
    await page.close();
  });

  test('should load homepage on mobile', async () => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    
    const title = await page.title();
    expect(title).toContain('Canadian Diaper Pricer');
    
    // Check if main elements are visible
    const heroSection = await page.$('.hero');
    expect(heroSection).toBeTruthy();
    
    const searchSection = await page.$('.search-section');
    expect(searchSection).toBeTruthy();
  });

  test('should have touch-friendly filter buttons', async () => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    
    // Wait for filters to load
    await page.waitForSelector('.filter-item', { timeout: 10000 });
    
    // Check filter button dimensions (minimum 44px for touch)
    const filterButton = await page.$('.filter-item');
    const boundingBox = await filterButton.boundingBox();
    
    expect(boundingBox.height).toBeGreaterThanOrEqual(44);
    expect(boundingBox.width).toBeGreaterThanOrEqual(44);
  });

  test('should handle horizontal scrolling on filter lists', async () => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    
    await page.waitForSelector('.brand-list', { timeout: 10000 });
    
    // Check if brand list is scrollable horizontally
    const brandList = await page.$('.brand-list');
    const scrollWidth = await page.evaluate(el => el.scrollWidth, brandList);
    const clientWidth = await page.evaluate(el => el.clientWidth, brandList);
    
    // Should be scrollable if content overflows
    if (scrollWidth > clientWidth) {
      // Test scrolling
      await page.evaluate(el => {
        el.scrollLeft = 100;
      }, brandList);
      
      const newScrollLeft = await page.evaluate(el => el.scrollLeft, brandList);
      expect(newScrollLeft).toBeGreaterThan(0);
    }
  });

  test('should stack diaper cards vertically on mobile', async () => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    
    // Wait for diaper results to load
    await page.waitForSelector('.diaper-card', { timeout: 15000 });
    
    const diaperCards = await page.$$('.diaper-card');
    expect(diaperCards.length).toBeGreaterThan(0);
    
    // Check if cards are stacked (flex-direction: column)
    const cardStyle = await page.evaluate(() => {
      const card = document.querySelector('.diaper-card');
      return window.getComputedStyle(card).flexDirection;
    });
    
    expect(cardStyle).toBe('column');
  });

  test('should have accessible navigation on mobile', async () => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement.tagName);
    
    // Should be able to navigate to interactive elements
    expect(['A', 'BUTTON', 'INPUT', 'SELECT']).toContain(focusedElement);
  });

  test('should handle viewport changes gracefully', async () => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    
    // Test different mobile viewports
    const viewports = [
      { width: 320, height: 568 }, // iPhone 5
      { width: 375, height: 667 }, // iPhone 6/7/8
      { width: 414, height: 896 }, // iPhone 11
      { width: 360, height: 640 }  // Samsung Galaxy
    ];
    
    for (const viewport of viewports) {
      await page.setViewport({
        ...viewport,
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2
      });
      
      // Wait for layout changes
      await page.waitForTimeout(500);
      
      // Check if layout doesn't break
      const bodyOverflow = await page.evaluate(() => {
        return window.getComputedStyle(document.body).overflowX;
      });
      
      expect(bodyOverflow).not.toBe('scroll'); // No horizontal scroll
    }
  });

  test('should load quickly on mobile connection', async () => {
    // Simulate slow 3G
    await page.emulateNetworkConditions({
      offline: false,
      downloadThroughput: 500 * 1024 / 8, // 500kb/s
      uploadThroughput: 500 * 1024 / 8,
      latency: 400
    });

    const startTime = Date.now();
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    const loadTime = Date.now() - startTime;
    
    // Should load within 5 seconds on slow connection
    expect(loadTime).toBeLessThan(5000);
  });
});

describe('Accessibility Tests', () => {
  let browser;
  let page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
  });

  afterEach(async () => {
    await page.close();
  });

  test('should have proper heading structure', async () => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    
    const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', headers => 
      headers.map(h => ({ tag: h.tagName, text: h.textContent.trim() }))
    );
    
    // Should have one h1
    const h1Count = headings.filter(h => h.tag === 'H1').length;
    expect(h1Count).toBe(1);
    
    // Should have logical heading hierarchy
    expect(headings.length).toBeGreaterThan(1);
  });

  test('should have alt text for all images', async () => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    
    const imagesWithoutAlt = await page.$$eval('img:not([alt])', imgs => imgs.length);
    expect(imagesWithoutAlt).toBe(0);
  });

  test('should be keyboard navigable', async () => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    
    await page.waitForSelector('.filter-item', { timeout: 10000 });
    
    // Test tab navigation through interactive elements
    const interactiveElements = await page.$$eval(
      'a, button, input, select, [tabindex]',
      elements => elements.length
    );
    
    expect(interactiveElements).toBeGreaterThan(0);
    
    // Test focus visibility
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => {
      const focused = document.activeElement;
      const styles = window.getComputedStyle(focused);
      return {
        outline: styles.outline,
        outlineWidth: styles.outlineWidth,
        boxShadow: styles.boxShadow
      };
    });
    
    // Should have visible focus indicator
    const hasFocusIndicator = focusedElement.outline !== 'none' || 
                             focusedElement.outlineWidth !== '0px' || 
                             focusedElement.boxShadow !== 'none';
    expect(hasFocusIndicator).toBe(true);
  });

  test('should have proper ARIA labels', async () => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    
    await page.waitForSelector('.filter-item', { timeout: 10000 });
    
    // Check for ARIA labels on interactive elements
    const ariaLabels = await page.$$eval('[aria-label], [aria-labelledby]', 
      elements => elements.length
    );
    
    // Should have some ARIA labels for accessibility
    expect(ariaLabels).toBeGreaterThan(0);
  });
});
