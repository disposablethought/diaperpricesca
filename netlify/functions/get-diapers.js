// Netlify serverless function to fetch diaper data
const mockData = require('../../server/data/mock-data.js');

exports.handler = async function(event, context) {
  try {
    // Get query parameters (if any)
    const params = event.queryStringParameters || {};
    
    // Get diaper data (using mock data for now)
    let diapers = mockData.diapers;
    
    // Apply filtering if parameters exist
    if (params.brand) {
      diapers = diapers.filter(diaper => 
        diaper.brand.toLowerCase() === params.brand.toLowerCase()
      );
    }
    
    if (params.size) {
      diapers = diapers.filter(diaper => 
        diaper.size.toLowerCase() === params.size.toLowerCase()
      );
    }
    
    if (params.retailer) {
      diapers = diapers.filter(diaper => 
        diaper.retailer.toLowerCase() === params.retailer.toLowerCase()
      );
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' // Allow cross-origin requests
      },
      body: JSON.stringify({
        diapers: diapers,
        count: diapers.length,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch diaper data' })
    };
  }
};
