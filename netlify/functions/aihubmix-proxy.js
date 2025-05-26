const axios = require('axios');

exports.handler = async function(event, context) {
    console.log('[Aihubmix Proxy] Received event:', JSON.stringify(event, null, 2));

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: 'Method Not Allowed. Only POST requests are accepted.' })
        };
    }

    let requestBody;
    try {
        requestBody = JSON.parse(event.body);
    } catch (e) {
        console.error('[Aihubmix Proxy] Error parsing request body:', e);
        return {
            statusCode: 400,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: 'Invalid JSON in request body.' })
        };
    }

    const { imageUrl } = requestBody;
    const apiKey = process.env.REACT_APP_AIHUBMIX_API_KEY;

    if (!apiKey) {
        console.error('[Aihubmix Proxy] Aihubmix API key is not set in environment variables.');
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: 'API key is not configured on the server.' })
        };
    }

    if (!imageUrl) {
        console.error('[Aihubmix Proxy] imageUrl is missing in the request body.');
        return {
            statusCode: 400,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: 'Missing imageUrl in request body.' })
        };
    }

    try {
        console.log(`[Aihubmix Proxy] Calling Aihubmix API with imageUrl: ${imageUrl}`);
        
        const payload = {
            image_url: imageUrl, 
            output_format: 'url' 
        };

        console.log('[Aihubmix Proxy] Sending payload to Aihubmix:', JSON.stringify(payload));

        const response = await axios.post('https://aihubmix.com/api/v1/ai/replace-background', payload, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            timeout: 30000, 
        });
        
        console.log('[Aihubmix Proxy] Aihubmix API raw response status:', response.status);
        console.log('[Aihubmix Proxy] Aihubmix API raw response data:', JSON.stringify(response.data, null, 2));

        if (response.data && response.data.data && Array.isArray(response.data.data) && response.data.data.length > 0 && response.data.data[0].url) {
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(response.data), 
            };
        } else {
            console.error('[Aihubmix Proxy] Unexpected response structure from Aihubmix:', response.data);
            return {
                statusCode: 500, 
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: 'Aihubmix API returned an unexpected response structure.', details: response.data }),
            };
        }
    } catch (error) {
        console.error('[Aihubmix Proxy] Error calling Aihubmix API or during processing:', error.message);
        if (error.stack) {
            console.error('[Aihubmix Proxy] Error stack:', error.stack);
        }

        let errorStatusCode = 500;
        let errorBody = { error: 'Proxy encountered an internal server error.', details: error.message };

        if (error.response) {
            console.error('[Aihubmix Proxy] Axios error - Aihubmix API response status:', error.response.status);
            console.error('[Aihubmix Proxy] Axios error - Aihubmix API response data:', JSON.stringify(error.response.data, null, 2));
            errorStatusCode = error.response.status || 500; 
            errorBody = {
                error: 'Aihubmix API request failed.',
                details: error.response.data || error.message,
                aihubmix_status: error.response.status
            };
        } else if (error.request) {
            console.error('[Aihubmix Proxy] Axios error - No response received from Aihubmix API:', error.request);
            errorStatusCode = 504; 
            errorBody = { error: 'No response received from Aihubmix API (Gateway Timeout).', details: error.message };
        } else {
            console.error('[Aihubmix Proxy] Axios or other setup error:', error.message);
        }

        return {
            statusCode: errorStatusCode,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(errorBody),
        };
    }
};
