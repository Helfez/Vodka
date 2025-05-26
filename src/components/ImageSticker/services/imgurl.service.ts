import axios from 'axios';

/**
 * ImgURL服务 - 处理图片上传到ImgURL图床
 */
export class ImgURLService {
  // ImgURL API配置
  private static API_URL = 'https://www.imgurl.org/api/v2/upload';
  private static UID = '0b84207705afbe21447bf29ec12d1426';
  private static TOKEN = 'b33643b92c1a48462372606c402dd534';
  private static TIMEOUT = 30000; // 30秒超时

  /**
   * 将图片上传到ImgURL图床
   * @param imageData 图片的base64数据（不含前缀）
   * @returns 返回上传后的图片URL
   */
  static async uploadImage(imageData: string): Promise<string> {
    try {
      console.log('开始上传图片到ImgURL...');
      
      // 构建表单数据
      const formData = new FormData();
      formData.append('uid', this.UID);
      formData.append('token', this.TOKEN);
      
      // 将base64转换为Blob
      const byteCharacters = atob(imageData);
      const byteArrays = [];
      for (let i = 0; i < byteCharacters.length; i++) {
        byteArrays.push(byteCharacters.charCodeAt(i));
      }
      const blob = new Blob([new Uint8Array(byteArrays)], { type: 'image/jpeg' });
      
      // 添加文件到表单
      formData.append('file', blob, 'image.jpg');
      
      // 发送请求
      const response = await axios.post(this.API_URL, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: this.TIMEOUT
      });
      
      // 检查响应
      if (response.data && response.data.code === 200 && response.data.data && response.data.data.url) {
        console.log('图片上传成功:', response.data.data.url);
        return response.data.data.url;
      } else {
        console.error('图片上传失败:', response.data);
        throw new Error(`ImgURL上传失败: ${response.data.msg || '未知错误'}`);
      }
    } catch (error: any) {
      console.error('ImgURL上传错误:', error);
      
      if (error.response) {
        throw new Error(`ImgURL服务错误 (${error.response.status}): ${error.response.data?.msg || '未知错误'}`);
      } else if (error.request) {
        throw new Error('ImgURL服务无响应，请检查网络连接');
      } else {
        throw error;
      }
    }
  }
}
