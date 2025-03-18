// Netlify serverless function to fetch size data
const mockData = require('../../server/data/mock-data.js');

exports.handler = async function(event, context) {
  try {
    // Extract unique sizes from diaper data
    const diapers = mockData.diapers;
    const uniqueSizes = [...new Set(diapers.map(diaper => diaper.size))];
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        sizes: uniqueSizes,
        count: uniqueSizes.length
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch size data' })
    };
  }
};
