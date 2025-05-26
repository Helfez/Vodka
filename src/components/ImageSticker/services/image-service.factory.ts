import { ImageProcessingService } from './image-processing.interface'; 
import { API2DService } from './api2d.service'; 
import { PixianService } from './pixian.service';
import { AihubmixService } from './aihubmix.service';

/**
 * 图像服务工厂 - 用于创建不同的图像处理服务实例
 */
export class ImageServiceFactory {
  /**
   * 获取图像处理服务实例
   * @param type 服务类型，例如 'api2d', 'pixian', 'aihubmix'
   * @returns 图像处理服务实例
   */
  static getService(type: 'api2d' | 'pixian' | 'aihubmix' = 'api2d'): ImageProcessingService {
    switch(type) {
      case 'api2d':
        return new API2DService();
      case 'pixian':
        return new PixianService();
      case 'aihubmix':
        return AihubmixService.getInstance(); // 使用 getInstance() 方法
      default:
        console.warn(`Unknown service type: ${type}, defaulting to api2d.`);
        return new API2DService();
    }
  }
}
