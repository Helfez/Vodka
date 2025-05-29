import { AihubmixService } from './aihubmix.service';
import { ImageProcessingService } from './image-processing.interface';

/**
 * 图像处理服务工厂
 * 用于创建不同类型的图像处理服务实例
 */
export class ImageServiceFactory {
  /**
   * 获取图像处理服务实例
   * @param type 服务类型，默认为 'aihubmix'
   */
  static getService(type: 'aihubmix' = 'aihubmix'): ImageProcessingService {
    switch (type) {
      case 'aihubmix':
        return AihubmixService.getInstance();
      default:
        return AihubmixService.getInstance();
    }
  }
}
