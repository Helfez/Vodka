import axios from 'axios';
import { ImageProcessingService } from './image-processing.interface';
import { Buffer } from 'buffer'; // Import Buffer for Node.js like environment or ensure it's globally available

/**
 * Pixian.ai服务 - 使用Pixian.ai API处理图像背景移除
 */
export class PixianService implements ImageProcessingService {
  private API_KEY: string;
  private API_URL = 'https://api.pixian.ai/api/v2/remove-background';
  private TIMEOUT = 60000; // 60秒超时

  constructor() {
    this.API_KEY = process.env.REACT_APP_PIXIAN_API_KEY || '';
    if (!this.API_KEY) {
      console.warn('PIXIAN_API_KEY is not set in environment variables. Please set REACT_APP_PIXIAN_API_KEY. Service might operate in test mode or fail.');
      // Pixian might work in a test mode without a key, or you might want to throw an error.
    }
  }

  /**
   * 将图片转换为贴纸（移除背景）
   * @param imageUrl 图片的data URL
   * @param prompt 可选的提示词（Pixian不使用此参数）
   * @param onProgress 可选的进度回调函数
   * @returns 返回处理后的图片的URL或data URL
   */
  async convertToSticker(
    imageUrl: string, 
    prompt?: string, 
    onProgress?: (progress: number) => void
  ): Promise<string> {
    try {
      console.log('开始调用Pixian.ai转换贴纸...');
      
      // It's good practice to check for API_KEY usage if it's strictly required by the API for non-test calls
      // if (!this.API_KEY) {
      //   throw new Error('Pixian API key is not configured.');
      // }

      let base64Data = '';
      let inputIsDataUrl = false;

      if (imageUrl.startsWith('data:image')) {
        base64Data = imageUrl.split(',')[1];
        inputIsDataUrl = true;
      } else {
        // If it's a public URL, we need to fetch it and convert to base64 first
        // This part is not implemented in the original static version, assuming input is always dataURL
        // For now, we'll throw an error or adapt. Let's assume it must be a dataURL based on original logic.
        console.warn('PixianService.convertToSticker expects a data URL. Non-data URL received:', imageUrl);
        // Option 1: Throw error
        // throw new Error('PixianService.convertToSticker currently only supports data URLs.');
        // Option 2: Try to fetch and convert (more complex, needs async handling here)
        // For now, let's stick to the original assumption that it's a data URL for base64 extraction.
        // If not, the split below will likely fail or produce incorrect results.
        base64Data = imageUrl; // This will be problematic if not a data URL. Re-evaluating this path.
        // Let's refine: The original code directly tries to split. So it expects dataURL.
        throw new Error('PixianService.convertToSticker received a non-data URL. Please provide a data URL.');
      }
      
      if (!base64Data && inputIsDataUrl) { // Only throw if it was supposed to be a data URL and split failed
        throw new Error('无效的图像数据 (data URL)');
      }
      
      console.log(`图片数据长度: ${base64Data.length} 字节`);
      
      if (base64Data.length > 1000000 && inputIsDataUrl) { // Compress only if it was a data URL and large
        console.log('图片数据过大，进行压缩...');
        // Pass the original dataUrl to compressImage
        const compressedDataUrl = await this.compressImage(imageUrl, 800, 0.7);
        base64Data = compressedDataUrl.split(',')[1];
        if (!base64Data) {
            throw new Error('Failed to extract base64 data after compression.');
        }
        console.log(`压缩后图片数据长度: ${base64Data.length} 字节`);
      }

      const formData = new FormData();
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      // Infer mime type or default
      const mimeType = imageUrl.substring(imageUrl.indexOf(':') + 1, imageUrl.indexOf(';')) || 'image/jpeg';
      const blob = new Blob([byteArray], { type: mimeType });
      
      formData.append('image', blob, `image.${mimeType.split('/')[1] || 'jpg'}`);
      
      // Add other parameters - use API_KEY for auth, not for 'test' if key exists
      if (!this.API_KEY) {
        formData.append('test', 'true'); // Use test mode if no API key
        console.log('Pixian API Key not found, using test mode.');
      }
      formData.append('result.crop_to_foreground', 'true');
      formData.append('result.margin', '10px');
      
      console.log('发送请求到Pixian.ai API...');
      
      const auth = this.API_KEY ? { username: this.API_KEY, password: '' } : undefined;
      
      const response = await axios.post(
        this.API_URL,
        formData,
        {
          auth,
          timeout: this.TIMEOUT,
          responseType: 'arraybuffer',
          headers: {
            // Content-Type is set by browser/axios for FormData
          }
        }
      );
      
      console.log('Pixian.ai响应状态:', response.status);
      
      if (response.status === 200) {
        const base64Response = Buffer.from(response.data, 'binary').toString('base64');
        const dataUrl = `data:image/png;base64,${base64Response}`; // Pixian usually returns PNG
        console.log('Pixian.ai处理成功，返回的图片长度:', dataUrl.length);
        return dataUrl;
      } else {
        console.error('Pixian.ai响应异常:', response.status, response.data ? Buffer.from(response.data).toString() : 'No data');
        throw new Error('Pixian.ai请求失败，状态码: ' + response.status);
      }
    } catch (error: any) {
      console.error('Pixian.ai服务错误:', error);
      if (error.response) {
        const statusCode = error.response.status;
        const responseData = error.response.data ? Buffer.from(error.response.data).toString() : 'N/A';
        throw new Error(`Pixian.ai服务错误 (${statusCode}): ${responseData}`);
      } else if (error.request) {
        throw new Error('Pixian.ai服务无响应，请检查网络连接');
      } else {
        throw error;
      }
    }
  }

  /**
   * 压缩图片 (Canvas based)
   * @param dataUrl 图片的data URL
   * @param maxWidth 最大宽度
   * @param quality 压缩质量 (0-1)
   * @returns 返回压缩后的图片的data URL
   */
  async compressImage(dataUrl: string, maxWidth: number, quality: number): Promise<string> {
    // Ensure input is a data URL for Image object src
    if (!dataUrl.startsWith('data:image')) {
        console.error('compressImage expects a data URL.');
        // Potentially fetch if it's a public URL, convert to dataURL, then compress
        // Or throw an error, as this method is specifically for dataURLs based on its usage context
        throw new Error('compressImage requires a data URL as input.');
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth) {
            height = Math.floor((height * maxWidth) / width);
            width = maxWidth;
          }
          
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('无法创建canvas上下文'));
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          
          // Determine output format, default to jpeg for compression quality param
          const outputMimeType = dataUrl.substring(dataUrl.indexOf(':') + 1, dataUrl.indexOf(';'));
          const isPng = outputMimeType === 'image/png';
          // If PNG and quality is 1, preserve PNG. Otherwise, or if JPEG, use quality for JPEG.
          const resultDataUrl = canvas.toDataURL(isPng && quality >= 0.95 ? 'image/png' : 'image/jpeg', quality);

          console.log(`原始尺寸: ${img.width}x${img.height}, 压缩后尺寸: ${width}x${height}`);
          resolve(resultDataUrl);
        } catch (e) {
          console.error('图像压缩错误:', e);
          resolve(dataUrl); // Return original on error
        }
      };
      img.onerror = (e) => {
        console.error('图片加载失败 (compressImage):', e);
        reject(new Error('图片加载失败 (compressImage)'));
      };
      img.src = dataUrl;
    });
  }
}
