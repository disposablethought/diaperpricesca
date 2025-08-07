// Netlify serverless function to get available retailers
exports.handler = async function(event, context) {
  try {
    // Hardcoded list of major Canadian diaper retailers
    const retailers = [
      'Amazon.ca',
      'Walmart Canada', 
      'Canadian Tire',
      'Costco Canada',
      'Real Canadian Superstore',
      'Shoppers Drug Mart',
      'Well.ca'
    ].sort();
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({
        retailers: retailers,
        count: retailers.length,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Error in get-retailers function:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Failed to fetch retailers',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};
