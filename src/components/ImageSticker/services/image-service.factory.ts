import { ImageProcessingService } from './image-processing.interface'; 
import { PixianService } from './pixian.service';
import { AihubmixService } from './aihubmix.service';

/**
 * 图像服务工厂 - 用于创建不同的图像处理服务实例
 */
export class ImageServiceFactory {
  /**
   * 获取图像处理服务实例
   * @param type 服务类型，例如 'pixian', 'aihubmix'
   * @returns 图像处理服务实例
   */
  static getService(type: 'pixian' | 'aihubmix' = 'aihubmix'): ImageProcessingService {
    switch(type) {
      case 'pixian':
        return new PixianService();
      case 'aihubmix':
        return AihubmixService.getInstance(); // 使用 getInstance() 方法
      default:
        console.warn(`Unknown service type: ${type}, defaulting to aihubmix.`);
        return AihubmixService.getInstance();
    }
  }
}
