import axios from 'axios';
import { ImageProcessingService } from './image-processing.interface';
import { ImgURLService } from './imgurl.service';

/**
 * RemoveBg服务 - 使用Remove.bg API处理图像背景移除
 */
export class RemoveBgService {
  // Remove.bg配置
  private static API_KEY = 'YOUR_REMOVE_BG_API_KEY'; // 请替换为您的Remove.bg API密钥
  private static API_URL = 'https://api.remove.bg/v1.0/removebg';
  private static TIMEOUT = 60000; // 60秒超时

  /**
   * 将图片转换为贴纸（移除背景）
   * @param imageUrl 图片的data URL
   * @returns 返回处理后的图片的data URL
   */
  static async convertToSticker(imageUrl: string): Promise<string> {
    try {
      console.log('开始调用RemoveBg转换贴纸...');
      
      // 验证API密钥
      if (!this.API_KEY || this.API_KEY === 'YOUR_REMOVE_BG_API_KEY') {
        throw new Error('RemoveBg API密钥未配置，请在.env.local文件中设置REACT_APP_REMOVE_BG_KEY');
      }

      // 提取base64数据
      let base64Data = imageUrl.split(',')[1];
      if (!base64Data) {
        throw new Error('无效的图像数据');
      }
      
      // 打印图片数据长度，用于调试
      console.log(`图片数据长度: ${base64Data.length} 字节`);
      
      // 如果图片数据过大，进行压缩
      if (base64Data.length > 1000000) { // 大于1MB
        console.log('图片数据过大，进行压缩...');
        imageUrl = await this.compressImage(imageUrl, 800, 0.7);
        // 重新提取base64数据
        const compressedBase64Data = imageUrl.split(',')[1];
        if (compressedBase64Data) {
          console.log(`压缩后图片数据长度: ${compressedBase64Data.length} 字节`);
          // 更新base64Data
          base64Data = compressedBase64Data;
        }
      }

      // 设置请求头
      const headers = {
        'Content-Type': 'application/json',
        'X-Api-Key': this.API_KEY
      };
      
      // 构建请求数据
      const requestData = {
        image_file_b64: base64Data,
        size: 'auto',
        type: 'auto',
        format: 'png',
        bg_color: '',
        channels: 'rgba'
      };
      
      console.log('发送请求到RemoveBg API...');
      
      const response = await axios.post(
        this.API_URL,
        requestData,
        {
          headers,
          timeout: this.TIMEOUT,
          responseType: 'arraybuffer'
        }
      );
      
      console.log('RemoveBg响应状态:', response.status);
      
      // 处理响应
      if (response.status === 200) {
        // 将响应数据转换为base64
        const base64 = Buffer.from(response.data).toString('base64');
        const dataUrl = `data:image/png;base64,${base64}`;
        console.log('RemoveBg处理成功，返回的图片长度:', dataUrl.length);
        
        return dataUrl;
      } else {
        console.error('RemoveBg响应异常:', response.status);
        throw new Error('RemoveBg请求失败，状态码: ' + response.status);
      }
    } catch (error: any) {
      console.error('RemoveBg服务错误:', error);
      
      if (error.response) {
        // 服务器响应了错误状态码
        const statusCode = error.response.status;
        let errorMessage = '未知错误';
        
        try {
          // 尝试解析错误消息
          const errorData = JSON.parse(Buffer.from(error.response.data).toString());
          errorMessage = errorData.errors?.[0]?.title || '未知错误';
        } catch (e) {
          console.error('无法解析错误响应:', e);
        }
        
        throw new Error(`RemoveBg服务错误 (${statusCode}): ${errorMessage}`);
      } else if (error.request) {
        // 请求已发送但没有收到响应
        throw new Error('RemoveBg服务无响应，请检查网络连接');
      } else {
        // 其他错误
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
  public static async compressImage(dataUrl: string, maxWidth: number, quality: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          // 计算新尺寸
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth) {
            height = Math.floor((height * maxWidth) / width);
            width = maxWidth;
          }
          
          // 创建canvas并绘制图片
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('无法创建canvas上下文'));
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          
          // 导出压缩后的图像
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          console.log(`原始尺寸: ${img.width}x${img.height}, 压缩后尺寸: ${width}x${height}`);
          
          resolve(compressedDataUrl);
        } catch (error) {
          console.error('图像压缩错误:', error);
          // 出错时返回原图
          resolve(dataUrl);
        }
      };
      
      img.onerror = () => {
        reject(new Error('图片加载失败'));
      };
      
      img.src = dataUrl;
    });
  }
}
