exports.handler = async (event, context) => {
    console.log('[test] Function invoked with method:', event.httpMethod);
    
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        },
        body: JSON.stringify({
            message: 'Test function is working!',
            timestamp: new Date().toISOString(),
            method: event.httpMethod,
            path: event.path
        })
    };
}; 