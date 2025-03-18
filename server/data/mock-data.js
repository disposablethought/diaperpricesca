/**
 * Mock diaper product data for Canadian retailers
 * This simulates data that would be scraped from retailer websites
 */

const generateMockData = () => {
  // Common diaper brands
  const brands = ['Pampers', 'Huggies', 'Kirkland', 'Parents Choice', 'Life Brand', 'Seventh Generation'];
  
  // Size ranges
  const sizes = ['1', '2', '3', '4', '5', '6'];
  
  // Different diaper types by brand
  const diaperTypes = {
    'Pampers': ['Swaddlers', 'Cruisers', 'Baby Dry', 'Pure Protection'],
    'Huggies': ['Little Snugglers', 'Little Movers', 'Snug & Dry', 'Special Delivery'],
    'Kirkland': ['Signature'],
    'Parents Choice': ['Premium'],
    'Life Brand': ['Ultra Dry'],
    'Seventh Generation': ['Free & Clear']
  };
  
  // Canadian retailers
  const retailers = [
    'Amazon.ca', 
    'Walmart Canada', 
    'Canadian Tire', 
    'Costco Canada', 
    'Real Canadian Superstore', 
    'Shoppers Drug Mart'
  ];
  
  // URLs by retailer
  const retailerUrls = {
    'Amazon.ca': 'https://www.amazon.ca/dp/',
    'Walmart Canada': 'https://www.walmart.ca/en/ip/',
    'Canadian Tire': 'https://www.canadiantire.ca/en/pdp/',
    'Costco Canada': 'https://www.costco.ca/en-ca/',
    'Real Canadian Superstore': 'https://www.realcanadiansuperstore.ca/en/product/',
    'Shoppers Drug Mart': 'https://shop.shoppersdrugmart.ca/product/'
  };
  
  // Base pricing by brand - general cost level of this brand
  const basePricingByBrand = {
    'Pampers': 0.35,
    'Huggies': 0.32,
    'Kirkland': 0.25,
    'Parents Choice': 0.22,
    'Life Brand': 0.24,
    'Seventh Generation': 0.40
  };
  
  // Size pricing factor - larger sizes are more expensive
  const sizePricingFactor = {
    '1': 0.8,
    '2': 0.9,
    '3': 1.0,
    '4': 1.1,
    '5': 1.2,
    '6': 1.3
  };
  
  // Type pricing factor - premium lines are more expensive
  const typePricingFactor = {
    'Swaddlers': 1.1,
    'Cruisers': 1.05,
    'Baby Dry': 0.95,
    'Pure Protection': 1.2,
    'Little Snugglers': 1.1,
    'Little Movers': 1.05,
    'Snug & Dry': 0.95,
    'Special Delivery': 1.3,
    'Signature': 1.0,
    'Premium': 1.0,
    'Ultra Dry': 1.0,
    'Free & Clear': 1.15
  };
  
  // Count ranges by size - smaller diapers have larger counts
  const countRangesBySize = {
    '1': [96, 120, 148, 192, 198],
    '2': [84, 112, 140, 186, 192],
    '3': [72, 104, 128, 168, 174],
    '4': [64, 92, 116, 150, 156],
    '5': [56, 80, 104, 132, 140],
    '6': [48, 72, 92, 124, 132]
  };

  // Retailer pricing factor - some retailers have higher/lower prices
  const retailerPricingFactor = {
    'Amazon.ca': 1.0,
    'Walmart Canada': 0.95,
    'Well.ca': 1.1,
    'Canadian Tire': 1.05,
    'Costco Canada': 0.85,
    'Real Canadian Superstore': 0.9,
    'Shoppers Drug Mart': 1.15
  };
  
  // Generate randomized IDs
  const generateId = (brand, type, size, retailer) => {
    const brandPart = brand.replace(/\s+/g, '').toLowerCase();
    const typePart = type.replace(/\s+/g, '').toLowerCase();
    const retailerPart = retailer.replace(/\s+/g, '').toLowerCase();
    // Random alphanumeric part
    const random = Math.random().toString(36).substring(2, 10);
    return `${brandPart}-${typePart}-${size}-${retailerPart}-${random}`;
  };
  
  // Generate product URLs based on retailer and ID
  const generateUrl = (retailer, id) => {
    return `${retailerUrls[retailer]}${id}`;
  };
  
  // Add some random fluctuation to prices to simulate real-world variability
  const addPriceNoise = (basePrice) => {
    const noiseRange = 0.07; // 7% variation
    const noise = (Math.random() * 2 - 1) * noiseRange;
    return basePrice * (1 + noise);
  };
  
  // Calculate a realistic price based on all factors
  const calculatePrice = (brand, type, size, count, retailer) => {
    const basePrice = basePricingByBrand[brand] || 0.30;
    const sizeFactor = sizePricingFactor[size] || 1.0;
    const typeFactor = typePricingFactor[type] || 1.0;
    const retailerFactor = retailerPricingFactor[retailer] || 1.0;
    
    let pricePerDiaper = basePrice * sizeFactor * typeFactor * retailerFactor;
    pricePerDiaper = addPriceNoise(pricePerDiaper);
    
    // Round to 2 decimal places
    pricePerDiaper = Math.round(pricePerDiaper * 100) / 100;
    
    const totalPrice = Math.round(pricePerDiaper * count * 100) / 100;
    
    return {
      pricePerDiaper,
      totalPrice
    };
  };
  
  // Generate mock products
  const mockProducts = [];
  
  // Generate for each brand, with all their types, all sizes, and for all retailers
  brands.forEach(brand => {
    const types = diaperTypes[brand] || ['Regular'];
    
    types.forEach(type => {
      sizes.forEach(size => {
        // For each size, generate a few count options
        const countOptions = countRangesBySize[size] || [100];
        
        countOptions.forEach(count => {
          retailers.forEach(retailer => {
            const id = generateId(brand, type, size, retailer);
            const url = generateUrl(retailer, id);
            const { pricePerDiaper, totalPrice } = calculatePrice(brand, type, size, count, retailer);
            
            // Add some randomness to availability - not all products are available at all retailers
            if (Math.random() > 0.2) { // 80% chance product exists at retailer
              mockProducts.push({
                id,
                brand,
                type,
                size,
                count,
                retailer,
                price: totalPrice,
                pricePerDiaper,
                url,
                lastUpdated: new Date()
              });
            }
          });
        });
      });
    });
  });
  
  // Add some sales and promotions for realism
  mockProducts.forEach(product => {
    // 10% chance of product being on sale
    if (Math.random() < 0.1) {
      const discountPercent = [10, 15, 20, 25, 30][Math.floor(Math.random() * 5)];
      const discountFactor = (100 - discountPercent) / 100;
      
      product.originalPrice = product.price;
      product.price = Math.round(product.price * discountFactor * 100) / 100;
      product.pricePerDiaper = Math.round(product.price / product.count * 100) / 100;
      product.onSale = true;
      product.saleText = `Save ${discountPercent}%`;
    }
  });
  
  return mockProducts;
};

module.exports = generateMockData;
