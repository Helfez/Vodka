import axios from 'axios';
import { ImgURLService } from './imgurl.service';
import { ImageProcessingService } from './image-processing.interface';

/**
 * API2D服务 - 处理与API2D的通信
 */
export class API2DService implements ImageProcessingService {
  private API_KEY: string;
  private BASE_URL = 'https://openai.api2d.net';
  private TIMEOUT = 60000; // 60秒超时

  constructor() {
    this.API_KEY = process.env.REACT_APP_API2D_KEY || '';
    if (!this.API_KEY) {
      console.error('API2D_KEY is not set in environment variables. Please set REACT_APP_API2D_KEY.');
      // Consider throwing an error if the API key is essential for the service to function
      // throw new Error('API2D_KEY is not configured.');
    }
  }

  /**
   * 将图片转换为贴纸（移除背景）
   * @param imageUrl 图片的data URL
   * @param prompt 可选的提示词
   * @param onProgress 可选的进度回调函数
   * @returns 返回处理后的图片的URL或data URL
   */
  async convertToSticker(
    imageUrl: string, 
    prompt?: string, 
    onProgress?: (progress: number) => void
  ): Promise<string> {
    try {
      console.log('开始调用API2D转换贴纸...');
      
      if (!this.API_KEY) {
        throw new Error('API2D密钥未配置');
      }

      let imagePublicUrl = '';
      let base64Data = '';

      // 检查imageUrl是否为data URL
      if (imageUrl.startsWith('data:image')) {
        base64Data = imageUrl.split(',')[1];
        if (!base64Data) {
          throw new Error('无效的图像数据 (data URL)');
        }
        console.log(`输入为data URL，数据长度: ${base64Data.length} 字节`);

        if (base64Data.length > 1000000) { // 大于1MB
          console.log('图片数据过大，进行压缩...');
          const compressedDataUrl = await this.compressImage(imageUrl, 800, 0.7); 
          const compressedBase64Data = compressedDataUrl.split(',')[1];
          if (compressedBase64Data) {
            console.log(`压缩后图片数据长度: ${compressedBase64Data.length} 字节`);
            base64Data = compressedBase64Data;
          }
        }
        // 上传到ImgURL图床
        console.log('上传图片到ImgURL图床...');
        try {
          imagePublicUrl = await ImgURLService.uploadImage(base64Data);
          console.log('图片上传成功，公开URL:', imagePublicUrl);
        } catch (uploadError) {
          console.error('图片上传失败:', uploadError);
          throw new Error('图片上传失败，请稍后重试');
        }
      } else {
        // 假设是公网URL
        imagePublicUrl = imageUrl;
        console.log('输入为公网 URL:', imagePublicUrl);
        // 注意：如果公网URL也需要压缩，这里的逻辑需要调整
        // 例如，先下载，再压缩，再上传。目前API2D的GPT-4V可以直接接受公网URL。
      }

      console.log('第二步：调用API2D对话API...');
      
      const requestData = {
        model: 'gpt-4o-mini',
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: '请把这张图进行抠图处理，返回透明背景的PNG图片。'
              },
              {
                type: 'input_image',
                image_url: imagePublicUrl 
              }
            ]
          }
        ]
      };
      
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.API_KEY}`
      };
      
      console.log('发送请求到API2D对话API...');
      // console.log('请求数据:', JSON.stringify(requestData)); // Potentially large, log with care
      
      const response = await axios.post(
        `${this.BASE_URL}/v1/chat/completions`,
        requestData,
        {
          headers,
          timeout: this.TIMEOUT
        }
      );
      
      console.log('API2D响应状态:', response.status);
      // console.log('API2D响应数据:', JSON.stringify(response.data).substring(0, 200) + '...');
      
      if (response.status === 200 && response.data && response.data.choices && response.data.choices.length > 0) {
        const content = response.data.choices[0].message?.content || '';
        console.log('API2D响应内容 (部分):', content.substring(0,100) + '...');
        
        const urlMatch = content.match(/https?:\/\/[^\s"'<>]+/g);
        if (urlMatch && urlMatch.length > 0) {
          const extractedUrl = urlMatch[0];
          console.log('从响应中提取到的URL:', extractedUrl);
          
          if (extractedUrl !== imagePublicUrl) {
            return extractedUrl;
          } else {
            console.error('API2D处理失败：返回的URL与原始图片URL相同。');
            throw new Error('API2D图像处理失败，返回结果与原图一致，请重试。');
          }
        }
        
        console.error('API2D处理失败：无法从响应内容中提取有效的图片URL。');
        throw new Error('API2D图像处理失败，未能获取处理后的图片URL。');
      } else {
        console.error('API2D响应异常:', response.status, response.data);
        throw new Error('API2D请求失败，状态码: ' + response.status);
      }
    } catch (error: any) {
      console.error('API2D服务错误:', error);
      
      if (error.response) {
        const statusCode = error.response.status;
        const errorMessage = error.response.data?.error?.message || '未知错误';
        throw new Error(`API2D服务错误 (${statusCode}): ${errorMessage}`);
      } else if (error.request) {
        throw new Error('API2D服务无响应，请检查网络连接');
      } else {
        throw error;
      }
    }
  }

  /**
   * 压缩图片
   * @param dataUrl 图片的data URL
   * @param maxWidth 最大宽度
   * @param quality 压缩质量 (0-1)
   * @returns 返回压缩后的图片的data URL
   */
  async compressImage(dataUrl: string, maxWidth: number, quality: number): Promise<string> {
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
          
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          console.log(`原始尺寸: ${img.width}x${img.height}, 压缩后尺寸: ${width}x${height}`);
          
          resolve(compressedDataUrl);
        } catch (error) {
          console.error('图像压缩错误:', error);
          resolve(dataUrl); // Return original on error
        }
      };
      
      img.onerror = () => {
        reject(new Error('图片加载失败'));
      };
      
      img.src = dataUrl;
    });
  }
}
