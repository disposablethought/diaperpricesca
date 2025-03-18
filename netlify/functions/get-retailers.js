// Netlify serverless function to fetch retailer data
const mockData = require('../../server/data/mock-data.js');

exports.handler = async function(event, context) {
  try {
    // Extract unique retailers from diaper data
    const diapers = mockData.diapers;
    const uniqueRetailers = [...new Set(diapers.map(diaper => diaper.retailer))];
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        retailers: uniqueRetailers,
        count: uniqueRetailers.length
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch retailer data' })
    };
  }
};
