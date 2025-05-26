/**
 * 图像处理服务接口 - 定义所有图像处理服务必须实现的方法
 */
export interface ImageProcessingService {
  /**
   * 将图片转换为贴纸（移除背景）
   * @param imageUrl 图片的data URL
   * @returns 返回处理后的图片的URL或data URL
   */
  convertToSticker(imageUrl: string): Promise<string>;
  
  /**
   * 压缩图片
   * @param dataUrl 图片的data URL
   * @param maxWidth 最大宽度
   * @param quality 压缩质量 (0-1)
   * @returns 返回压缩后的图片的data URL
   */
  compressImage(dataUrl: string, maxWidth: number, quality: number): Promise<string>;
}
