// Netlify serverless function to get available sizes
exports.handler = async function(event, context) {
  try {
    // Hardcoded list focused on size 3 diapers only
    const sizes = ['3'];
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({
        sizes: sizes,
        count: sizes.length,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Error in get-sizes function:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Failed to fetch sizes',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};
