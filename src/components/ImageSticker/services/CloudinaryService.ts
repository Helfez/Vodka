export class CloudinaryService {
    private static CLOUD_NAME = 'dqs6g6vrd';
    private static UPLOAD_PRESET = 'd-Vodka';
    private static UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CloudinaryService.CLOUD_NAME}/image/upload`;

    /**
     * Uploads an image file to Cloudinary using the configured unsigned upload preset.
     * @param file The image file to upload.
     * @returns A promise that resolves to the secure URL of the uploaded image.
     * @throws If the upload fails or Cloudinary returns an error.
     */
    public static async uploadImage(file: File): Promise<string> {
        console.log('[CloudinaryService] Starting image upload for file:', file.name, 'Type:', file.type, 'Size:', file.size);
        console.debug('[CloudinaryService] Uploading to URL:', CloudinaryService.UPLOAD_URL);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CloudinaryService.UPLOAD_PRESET);
        console.debug('[CloudinaryService] FormData keys:', Array.from(formData.keys()));
        // You can add other parameters here if needed, e.g., tags, context, folder
        // formData.append('folder', 'whiteboard_uploads'); // Example: specify a folder

        try {
            const response = await fetch(CloudinaryService.UPLOAD_URL, {
                method: 'POST',
                body: formData,
            });

            const responseData = await response.json();

            if (!response.ok || responseData.error) {
                console.error('[CloudinaryService] Upload failed. Cloudinary response:', responseData);
                throw new Error(responseData.error?.message || 'Cloudinary image upload failed.');
            }

            console.log('[CloudinaryService] Upload successful. Cloudinary response:', responseData);
            
            if (!responseData.secure_url) {
                console.error('[CloudinaryService] Upload successful, but secure_url not found in response:', responseData);
                throw new Error('Cloudinary upload succeeded but did not return a secure_url.');
            }
            
            return responseData.secure_url;
        } catch (error: any) {
            console.error('[CloudinaryService] Error during image upload:', error);
            throw new Error(`Image upload to Cloudinary failed: ${error.message}`);
        }
    }

    /**
     * Converts a data URL string to a File object.
     * @param dataUrl The data URL (e.g., "data:image/png;base64,iVBORw0KGgo...").
     * @param filename The desired filename for the resulting File object.
     * @returns A File object, or null if conversion fails.
     */
    public static dataURLtoFile(dataUrl: string, filename: string): File | null {
        console.debug('[CloudinaryService dataURLtoFile] Input dataUrl (length):', dataUrl.length, 'Filename:', filename);
        try {
            const arr = dataUrl.split(',');
            if (arr.length < 2) return null;
            const mimeMatch = arr[0].match(/:(.*?);/);
            if (!mimeMatch || mimeMatch.length < 2) return null;
            const mime = mimeMatch[1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            const outputFile = new File([u8arr], filename, { type: mime });
            console.debug('[CloudinaryService dataURLtoFile] Output File:', { name: outputFile.name, size: outputFile.size, type: outputFile.type });
            return outputFile;
        } catch (error) {
            console.error('[CloudinaryService] Error converting data URL to File:', error);
            return null;
        }
    }
}
