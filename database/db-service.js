// Database service for Canadian Diaper Pricer using Netlify Neon
const { neon } = require('@netlify/neon');

class DatabaseService {
  constructor() {
    // Initialize Neon connection with Netlify environment variable
    // Use unpooled connection for serverless functions (better performance)
    const dbUrl = process.env.NETLIFY_DATABASE_URL_UNPOOLED || process.env.NETLIFY_DATABASE_URL;
    if (!dbUrl) {
      throw new Error('Database URL not found in environment variables');
    }
    this.sql = neon(dbUrl);
    console.log('Database service initialized with Netlify Neon');
  }

  // Get all diapers with optional filtering
  async getAllDiapers(filters = {}) {
    try {
      let query = `
        SELECT id, brand, type, size, count, retailer, price, 
               price_per_diaper, url, in_stock, updated_at, last_scraped
        FROM diapers
        WHERE in_stock = true
      `;
      const params = [];
      let paramIndex = 1;

      // Add brand filter
      if (filters.brand && filters.brand !== 'all') {
        query += ` AND brand = $${paramIndex}`;
        params.push(filters.brand);
        paramIndex++;
      }

      // Add size filter
      if (filters.size && filters.size !== 'all') {
        query += ` AND size = $${paramIndex}`;
        params.push(filters.size);
        paramIndex++;
      }

      // Add retailer filter
      if (filters.retailer && filters.retailer !== 'all') {
        query += ` AND retailer = $${paramIndex}`;
        params.push(filters.retailer);
        paramIndex++;
      }

      // Add sorting
      const sortBy = filters.sortBy || 'pricePerDiaper';
      const sortOrder = filters.sortOrder || 'asc';
      
      switch(sortBy) {
        case 'pricePerDiaper':
          query += ` ORDER BY price_per_diaper ${sortOrder.toUpperCase()}`;
          break;
        case 'price':
          query += ` ORDER BY price ${sortOrder.toUpperCase()}`;
          break;
        case 'brand':
          query += ` ORDER BY brand ${sortOrder.toUpperCase()}`;
          break;
        case 'updated':
          query += ` ORDER BY updated_at ${sortOrder.toUpperCase()}`;
          break;
        default:
          query += ` ORDER BY price_per_diaper ASC`;
      }

      console.log('Executing query:', query, 'with params:', params);
      const results = await this.sql(query, params);
      console.log(`Retrieved ${results.length} diapers from database`);
      return results;

    } catch (error) {
      console.error('Error getting diapers from database:', error);
      throw error;
    }
  }

  // Insert or update diaper data (upsert)
  async upsertDiaper(diaperData) {
    try {
      const {
        brand, type, size, count, retailer, price, 
        pricePerDiaper, url, inStock = true
      } = diaperData;

      const query = `
        INSERT INTO diapers (brand, type, size, count, retailer, price, price_per_diaper, url, in_stock, last_scraped)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
        ON CONFLICT (brand, type, size, retailer) 
        DO UPDATE SET 
          count = EXCLUDED.count,
          price = EXCLUDED.price,
          price_per_diaper = EXCLUDED.price_per_diaper,
          url = EXCLUDED.url,
          in_stock = EXCLUDED.in_stock,
          updated_at = CURRENT_TIMESTAMP,
          last_scraped = CURRENT_TIMESTAMP
        RETURNING id, brand, type, retailer, price, price_per_diaper
      `;

      const params = [brand, type, size, count, retailer, price, pricePerDiaper, url, inStock];
      const results = await this.sql(query, params);
      
      console.log(`Upserted diaper: ${brand} ${type} from ${retailer}`);
      return results[0];

    } catch (error) {
      console.error('Error upserting diaper:', error);
      throw error;
    }
  }

  // Batch upsert multiple diapers (more efficient for scraped data)
  async batchUpsertDiapers(diapersData) {
    try {
      console.log(`Starting batch upsert of ${diapersData.length} diapers`);
      const results = [];
      
      for (const diaperData of diapersData) {
        const result = await this.upsertDiaper(diaperData);
        results.push(result);
      }

      console.log(`Completed batch upsert of ${results.length} diapers`);
      return results;

    } catch (error) {
      console.error('Error in batch upsert:', error);
      throw error;
    }
  }

  // Record price history for a diaper
  async recordPriceHistory(diaperId, price, pricePerDiaper, inStock) {
    try {
      const query = `
        INSERT INTO price_history (diaper_id, price, price_per_diaper, in_stock)
        VALUES ($1, $2, $3, $4)
        RETURNING id, recorded_at
      `;

      const results = await this.sql(query, [diaperId, price, pricePerDiaper, inStock]);
      console.log(`Recorded price history for diaper ID ${diaperId}`);
      return results[0];

    } catch (error) {
      console.error('Error recording price history:', error);
      throw error;
    }
  }

  // Log scraping session
  async logScrapingSession(retailer, productsFound, success, errorMessage = null, executionTime = null) {
    try {
      const query = `
        INSERT INTO scraping_logs (retailer, products_found, success, error_message, execution_time_ms, scrape_completed)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        RETURNING id, scrape_started, scrape_completed
      `;

      const results = await this.sql(query, [retailer, productsFound, success, errorMessage, executionTime]);
      console.log(`Logged scraping session for ${retailer}: ${success ? 'SUCCESS' : 'FAILED'}`);
      return results[0];

    } catch (error) {
      console.error('Error logging scraping session:', error);
      throw error;
    }
  }

  // Get unique brands for filter options
  async getBrands() {
    try {
      const query = `SELECT DISTINCT brand FROM diapers WHERE in_stock = true ORDER BY brand`;
      const results = await this.sql(query);
      return results.map(row => row.brand);
    } catch (error) {
      console.error('Error getting brands:', error);
      throw error;
    }
  }

  // Get unique sizes for filter options
  async getSizes() {
    try {
      const query = `SELECT DISTINCT size FROM diapers WHERE in_stock = true ORDER BY size::INTEGER`;
      const results = await this.sql(query);
      return results.map(row => row.size);
    } catch (error) {
      console.error('Error getting sizes:', error);
      throw error;
    }
  }

  // Get unique retailers for filter options
  async getRetailers() {
    try {
      const query = `SELECT DISTINCT retailer FROM diapers WHERE in_stock = true ORDER BY retailer`;
      const results = await this.sql(query);
      return results.map(row => row.retailer);
    } catch (error) {
      console.error('Error getting retailers:', error);
      throw error;
    }
  }

  // Get price history for a specific diaper
  async getPriceHistory(diaperId, dayLimit = 30) {
    try {
      const query = `
        SELECT price, price_per_diaper, in_stock, recorded_at
        FROM price_history 
        WHERE diaper_id = $1 AND recorded_at >= CURRENT_DATE - INTERVAL '${dayLimit} days'
        ORDER BY recorded_at DESC
      `;

      const results = await this.sql(query, [diaperId]);
      console.log(`Retrieved ${results.length} price history records for diaper ${diaperId}`);
      return results;

    } catch (error) {
      console.error('Error getting price history:', error);
      throw error;
    }
  }

  // Initialize database with schema (run once)
  async initializeDatabase() {
    try {
      console.log('Initializing database schema...');
      const fs = require('fs');
      const path = require('path');
      
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      // Execute schema (split by semicolon for multiple statements)
      const statements = schema.split(';').filter(stmt => stmt.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          await this.sql(statement.trim());
        }
      }
      
      console.log('Database schema initialized successfully');
      return true;

    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }
}

module.exports = DatabaseService;
