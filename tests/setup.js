// Global test setup
global.console = {
  ...console,
  // Suppress console.warn in tests unless explicitly needed
  warn: jest.fn(),
  log: jest.fn(),
  error: console.error // Keep errors visible
};

// Mock fetch globally
global.fetch = jest.fn();

// Mock feather icons
global.feather = {
  replace: jest.fn()
};

// Mock URLSearchParams for older Node versions
if (typeof URLSearchParams === 'undefined') {
  global.URLSearchParams = class URLSearchParams {
    constructor(init) {
      this.params = new Map();
      if (init) {
        if (typeof init === 'string') {
          init.replace(/^\?/, '').split('&').forEach(param => {
            const [key, value] = param.split('=');
            if (key) this.params.set(decodeURIComponent(key), decodeURIComponent(value || ''));
          });
        }
      }
    }
    
    get(key) {
      return this.params.get(key);
    }
    
    set(key, value) {
      this.params.set(key, value);
    }
    
    toString() {
      const pairs = [];
      for (const [key, value] of this.params) {
        pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
      }
      return pairs.join('&');
    }
  };
}

// Set test environment variables
process.env.NODE_ENV = 'test';
