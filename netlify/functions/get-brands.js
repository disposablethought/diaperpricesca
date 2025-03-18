// Netlify serverless function to fetch brand data
const mockData = require('../../server/data/mock-data.js');

exports.handler = async function(event, context) {
  try {
    // Extract unique brands from diaper data
    const diapers = mockData.diapers;
    const uniqueBrands = [...new Set(diapers.map(diaper => diaper.brand))];
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        brands: uniqueBrands,
        count: uniqueBrands.length
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch brand data' })
    };
  }
};
