-- Canadian Diaper Pricer Database Schema
-- Neon PostgreSQL Database for persistent diaper pricing data

-- Create diapers table for storing product information
CREATE TABLE IF NOT EXISTS diapers (
    id SERIAL PRIMARY KEY,
    brand VARCHAR(100) NOT NULL,
    type VARCHAR(200) NOT NULL,
    size VARCHAR(10) NOT NULL,
    count INTEGER NOT NULL,
    retailer VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    price_per_diaper DECIMAL(10, 4) NOT NULL,
    url TEXT,
    in_stock BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_scraped TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure we don't have duplicate products
    UNIQUE(brand, type, size, retailer)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_diapers_brand ON diapers(brand);
CREATE INDEX IF NOT EXISTS idx_diapers_size ON diapers(size);
CREATE INDEX IF NOT EXISTS idx_diapers_retailer ON diapers(retailer);
CREATE INDEX IF NOT EXISTS idx_diapers_price_per_diaper ON diapers(price_per_diaper);
CREATE INDEX IF NOT EXISTS idx_diapers_in_stock ON diapers(in_stock);
CREATE INDEX IF NOT EXISTS idx_diapers_updated_at ON diapers(updated_at);

-- Create price_history table for tracking price changes over time
CREATE TABLE IF NOT EXISTS price_history (
    id SERIAL PRIMARY KEY,
    diaper_id INTEGER REFERENCES diapers(id) ON DELETE CASCADE,
    price DECIMAL(10, 2) NOT NULL,
    price_per_diaper DECIMAL(10, 4) NOT NULL,
    in_stock BOOLEAN NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for price history queries
CREATE INDEX IF NOT EXISTS idx_price_history_diaper_id ON price_history(diaper_id);
CREATE INDEX IF NOT EXISTS idx_price_history_recorded_at ON price_history(recorded_at);

-- Create scraping_logs table for monitoring scraper performance
CREATE TABLE IF NOT EXISTS scraping_logs (
    id SERIAL PRIMARY KEY,
    retailer VARCHAR(100) NOT NULL,
    scrape_started TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    scrape_completed TIMESTAMP WITH TIME ZONE,
    products_found INTEGER DEFAULT 0,
    success BOOLEAN DEFAULT false,
    error_message TEXT,
    execution_time_ms INTEGER
);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_diapers_updated_at 
    BEFORE UPDATE ON diapers 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert initial fallback data
INSERT INTO diapers (brand, type, size, count, retailer, price, price_per_diaper, url, in_stock) VALUES
-- Amazon.ca Products  
('Pampers', 'Baby Dry Size 3 (198 Count)', '3', 198, 'Amazon.ca', 54.97, 0.28, 'https://www.amazon.ca/dp/B07FQRZ8QM', true),
('Pampers', 'Cruisers 360° Size 3 (84 Count)', '3', 84, 'Amazon.ca', 29.97, 0.36, 'https://www.amazon.ca/dp/B08QY6HT97', true),
('Huggies', 'Little Snugglers Size 3 (132 Count)', '3', 132, 'Amazon.ca', 47.97, 0.36, 'https://www.amazon.ca/dp/B07FQRQTGX', true),
('Huggies', 'Overnites Size 3 (66 Count)', '3', 66, 'Amazon.ca', 26.97, 0.41, 'https://www.amazon.ca/dp/B07G2XN8H7', true),

-- Costco Canada Products
('Kirkland', 'Signature Size 3 (192 Count)', '3', 192, 'Costco Canada', 49.99, 0.26, 'https://www.costco.ca/kirkland-signature-diapers-size-3.product.100506047.html', true),
('Pampers', 'Baby Dry Size 3 (246 Count)', '3', 246, 'Costco Canada', 64.99, 0.26, 'https://www.costco.ca/pampers-baby-dry-size-3.product.100506048.html', true),

-- Walmart.ca Products
('Pampers', 'Cruisers Size 3 (144 Count)', '3', 144, 'Walmart.ca', 52.97, 0.37, 'https://www.walmart.ca/en/ip/pampers-cruisers-diapers-size-3/6000200832288', true),
('Huggies', 'Little Movers Size 3 (120 Count)', '3', 120, 'Walmart.ca', 44.97, 0.37, 'https://www.walmart.ca/en/ip/huggies-little-movers-diapers-size-3/6000200832289', true),

-- Well.ca Products
('Seventh Generation', 'Baby Diapers Size 3 (84 Count)', '3', 84, 'Well.ca', 34.99, 0.42, 'https://well.ca/products/seventh-generation-baby-diapers_88234.html', true),
('Honest', 'Club Box Diapers Size 3 (92 Count)', '3', 92, 'Well.ca', 32.99, 0.36, 'https://well.ca/products/honest-club-box-diapers-size-3_134567.html', true),

-- Canadian Tire Products
('Pampers', 'Baby Dry Size 3 (128 Count)', '3', 128, 'Canadian Tire', 42.99, 0.34, 'https://www.canadiantire.ca/en/pdp/pampers-baby-dry-diapers-size-3-0537021p.html', true),
('Huggies', 'Snugglers Size 3 (96 Count)', '3', 96, 'Canadian Tire', 36.99, 0.39, 'https://www.canadiantire.ca/en/pdp/huggies-snugglers-diapers-size-3-0537022p.html', true),

-- Shoppers Drug Mart Products
('Pampers', 'Cruisers Size 3 (104 Count)', '3', 104, 'Shoppers Drug Mart', 41.99, 0.40, 'https://www1.shoppersdrugmart.ca/en/health-and-pharmacy/baby-and-kids/pampers-cruisers', true),
('Huggies', 'Little Snugglers Size 3 (80 Count)', '3', 80, 'Shoppers Drug Mart', 32.99, 0.41, 'https://www1.shoppersdrugmart.ca/en/health-and-pharmacy/baby-and-kids/huggies-little-snugglers', true),

-- Real Canadian Superstore Products
('President''s Choice', 'Ultra Soft Diapers Size 3 (120 Count)', '3', 120, 'Real Canadian Superstore', 29.99, 0.25, 'https://www.realcanadiansuperstore.ca/presidents-choice-ultra-soft-diapers-size-3/p/20978453_EA', true),
('Pampers', 'Baby Dry Size 3 (168 Count)', '3', 168, 'Real Canadian Superstore', 49.99, 0.30, 'https://www.realcanadiansuperstore.ca/pampers-baby-dry-diapers-size-3/p/20978454_EA', true)

ON CONFLICT (brand, type, size, retailer) DO NOTHING;
