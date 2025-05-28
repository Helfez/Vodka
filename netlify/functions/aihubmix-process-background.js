// netlify/functions/aihubmix-process-background.js
const fetch = require('node-fetch');
const FormData = require('form-data');
const cloudinary = require('cloudinary').v2;
const { getBlobStore } = require('@netlify/blobs');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});

exports.handler = async (event, context) => {
    console.log('[aihubmix-process-background] Function invoked.');
    const { image_base64, prompt: userPrompt, size, n, taskId } = JSON.parse(event.body);

    const store = getBlobStore('aihubmix_tasks');

    try {
        console.log(`[aihubmix-process-background] Task ${taskId}: Processing image with Aihubmix.`);
        // Convert Base64 to Buffer
        const imageBuffer = Buffer.from(image_base64, 'base64');

        const form = new FormData();
        form.append('image', imageBuffer, { filename: 'input_image.png', contentType: 'image/png' });
        form.append('model', 'gpt-image-1');
        form.append('prompt', userPrompt || "Remove the background, making it transparent. Keep the main subject clear and high quality.");
        form.append('n', n.toString());
        form.append('size', size);

        const apiUrl = 'https://aihubmix.com/v1/images/edits';
        const aihubmixResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.AIHUBMIX_API_KEY}`,
                ...form.getHeaders(),
            },
            body: form,
        });

        if (!aihubmixResponse.ok) {
            const errorBody = await aihubmixResponse.text();
            console.error(`[aihubmix-process-background] Task ${taskId}: Aihubmix API Error: ${aihubmixResponse.status}`, errorBody);
            await store.setJSON(taskId, { status: 'failed', error: `Aihubmix API Error: ${aihubmixResponse.status} - ${errorBody}` });
            return; // Important to exit after setting status
        }

        const aihubmixData = await aihubmixResponse.json();
        if (!aihubmixData || !aihubmixData.data || !aihubmixData.data[0] || !aihubmixData.data[0].b64_json) {
            console.error(`[aihubmix-process-background] Task ${taskId}: Invalid response structure from Aihubmix.`);
            await store.setJSON(taskId, { status: 'failed', error: 'Invalid response structure from Aihubmix.' });
            return;
        }
        const processedImageBase64 = aihubmixData.data[0].b64_json;
        console.log(`[aihubmix-process-background] Task ${taskId}: Image processed by Aihubmix. Uploading to Cloudinary.`);

        const cloudinaryUploadResponse = await cloudinary.uploader.upload(`data:image/png;base64,${processedImageBase64}`, {
            folder: 'aihubmix_processed',
            resource_type: 'image',
        });

        console.log(`[aihubmix-process-background] Task ${taskId}: Image uploaded to Cloudinary: ${cloudinaryUploadResponse.secure_url}`);
        await store.setJSON(taskId, { status: 'completed', imageUrl: cloudinaryUploadResponse.secure_url });

    } catch (error) {
        console.error(`[aihubmix-process-background] Task ${taskId}: Error processing image:`, error);
        await store.setJSON(taskId, { status: 'failed', error: error.message });
    }
};
