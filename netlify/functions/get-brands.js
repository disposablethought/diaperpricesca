// Netlify serverless function to get available brands
exports.handler = async function(event, context) {
  try {
    // Hardcoded list of popular diaper brands in Canada
    const brands = [
      'Pampers',
      'Huggies', 
      'Kirkland',
      'Parents Choice',
      'Life Brand',
      'Seventh Generation',
      'Honest Company',
      'Presidents Choice',
      'No Name'
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
        brands: brands,
        count: brands.length,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Error in get-brands function:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Failed to fetch brands',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};
