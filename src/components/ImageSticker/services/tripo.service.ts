/**
 * Tripo 3D 生成服务
 * 用于将2D图片转换为3D模型
 */
export class TripoService {
  private static instance: TripoService;
  private baseUrl: string;

  private constructor() {
    // 使用当前域名或环境变量中的URL
    this.baseUrl = process.env.REACT_APP_API_URL || window.location.origin;
    console.log('[TripoService] 🔧 服务初始化，Base URL:', this.baseUrl);
  }

  public static getInstance(): TripoService {
    if (!TripoService.instance) {
      TripoService.instance = new TripoService();
    }
    return TripoService.instance;
  }

  /**
   * 将图片转换为3D模型
   * @param imageUrl 图片的HTTP URL
   * @param options 生成选项
   * @param onProgress 进度回调
   * @returns 3D模型文件URL
   */
  async imageToModel(
    imageUrl: string,
    options: {
      outputFormat?: 'glb' | 'obj';
      removeBackground?: boolean;
      foregroundRatio?: number;
      mcResolution?: number;
    } = {},
    onProgress?: (progress: number) => void
  ): Promise<{
    modelUrl: string;
    thumbnailUrl?: string;
    format: string;
    fileSize?: number;
  }> {
    console.log('[TripoService imageToModel] === 3D模型生成服务开始 ===');
    
    try {
      const finalOptions = {
        outputFormat: options.outputFormat || 'glb',
        removeBackground: options.removeBackground !== false, // 默认移除背景
        foregroundRatio: options.foregroundRatio || 0.9,
        mcResolution: options.mcResolution || 256
      };

      console.log('[TripoService imageToModel] 📋 生成参数:');
      console.log('  - 图片URL:', imageUrl);
      console.log('  - 输出格式:', finalOptions.outputFormat);
      console.log('  - 移除背景:', finalOptions.removeBackground);
      console.log('  - 前景比例:', finalOptions.foregroundRatio);
      console.log('  - 网格分辨率:', finalOptions.mcResolution);

      // 初始进度
      onProgress?.(10);

      console.log('[TripoService imageToModel] 🚀 启动后台生成任务...');
      const taskStartTime = performance.now();
      
      const taskResponse = await fetch(`${this.baseUrl}/.netlify/functions/tripo-generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl, // 直接传递HTTP URL
          ...finalOptions
        }),
      });

      if (!taskResponse.ok) {
        console.error('[TripoService imageToModel] ❌ 任务启动失败');
        const errorData = await taskResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${taskResponse.status}: ${taskResponse.statusText}`);
      }

      const taskResult = await taskResponse.json();
      const taskId = taskResult.taskId;

      if (!taskId) {
        console.error('[TripoService imageToModel] ❌ 未获取到任务ID');
        throw new Error('未能启动后台生成任务');
      }

      console.log('[TripoService imageToModel] ✅ 后台任务已启动，任务ID:', taskId);
      onProgress?.(30);

      // 轮询任务状态
      console.log('[TripoService imageToModel] 🔄 开始轮询任务状态...');
      const result = await this.pollTaskStatus(taskId, onProgress);

      const taskEndTime = performance.now();
      const totalDuration = Math.round(taskEndTime - taskStartTime);

      console.log('[TripoService imageToModel] ✅ 3D模型生成完成:');
      console.log('  - 总耗时:', totalDuration, 'ms');
      console.log('  - 模型格式:', result.format);
      console.log('  - 模型URL:', result.modelUrl?.substring(0, 50) + '...');
      console.log('  - 任务ID:', taskId);

      console.log('[TripoService imageToModel] === 3D模型生成服务完成 ===');

      return result;

    } catch (error) {
      console.error('[TripoService imageToModel] ❌ 3D生成失败:', error);
      console.error('  - 错误类型:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('  - 错误消息:', error instanceof Error ? error.message : String(error));
      console.error('  - 错误堆栈:', error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * 轮询任务状态
   * @param taskId 任务ID
   * @param onProgress 进度回调
   * @returns 生成结果
   */
  private async pollTaskStatus(
    taskId: string, 
    onProgress?: (progress: number) => void
  ): Promise<{
    modelUrl: string;
    thumbnailUrl?: string;
    format: string;
    fileSize?: number;
  }> {
    console.log(`[TripoService pollTaskStatus] 🔄 开始轮询任务 ${taskId} 的状态`);
    
    const pollStartTime = performance.now();
    const maxPollingTime = 300000; // 最大轮询时间5分钟
    const pollInterval = 3000; // 轮询间隔3秒
    let pollCount = 0;
    
    while (true) {
      const pollCurrentTime = performance.now();
      const elapsedTime = pollCurrentTime - pollStartTime;
      
      if (elapsedTime > maxPollingTime) {
        console.error(`[TripoService pollTaskStatus] ❌ 任务 ${taskId} 轮询超时`);
        throw new Error('3D模型生成超时，请稍后重试');
      }
      
      pollCount++;
      console.log(`[TripoService pollTaskStatus] 📊 第 ${pollCount} 次轮询 (已等待 ${Math.round(elapsedTime/1000)}s)`);
      
      try {
        const statusResponse = await fetch(`${this.baseUrl}/.netlify/functions/tripo-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId }),
        });
        
        if (!statusResponse.ok) {
          console.warn(`[TripoService pollTaskStatus] ⚠️ 状态查询失败，状态码: ${statusResponse.status}`);
          await this.delay(pollInterval);
          continue;
        }
        
        const statusResult = await statusResponse.json();
        console.log(`[TripoService pollTaskStatus] 📋 任务状态:`, statusResult.status);
        
        if (statusResult.status === 'completed') {
          console.log(`[TripoService pollTaskStatus] ✅ 任务 ${taskId} 已完成`);
          onProgress?.(100);
          
          return {
            modelUrl: statusResult.modelUrl,
            thumbnailUrl: statusResult.thumbnailUrl,
            format: statusResult.format || 'glb',
            fileSize: statusResult.fileSize
          };
        } else if (statusResult.status === 'failed') {
          console.error(`[TripoService pollTaskStatus] ❌ 任务 ${taskId} 失败:`, statusResult.error);
          throw new Error(statusResult.error || '3D模型生成失败');
        } else if (statusResult.status === 'processing') {
          console.log(`[TripoService pollTaskStatus] 🔄 任务 ${taskId} 处理中...`);
          
          // 根据处理时间计算进度
          const progressPercent = Math.min(30 + (elapsedTime / maxPollingTime) * 60, 90);
          onProgress?.(Math.round(progressPercent));
        }
        
      } catch (error) {
        console.warn(`[TripoService pollTaskStatus] ⚠️ 轮询异常:`, error);
      }
      
      // 等待下次轮询
      await this.delay(pollInterval);
    }
  }

  /**
   * 延迟函数
   * @param ms 延迟毫秒数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 文本转3D模型（未来功能）
   * @param prompt 文本描述
   * @param options 生成选项
   * @param onProgress 进度回调
   */
  async textToModel(
    prompt: string,
    options: {
      outputFormat?: 'glb' | 'obj';
      style?: 'realistic' | 'cartoon' | 'clay';
    } = {},
    onProgress?: (progress: number) => void
  ): Promise<{
    modelUrl: string;
    thumbnailUrl?: string;
    format: string;
  }> {
    console.log('[TripoService textToModel] 🔄 文本转3D功能暂未实现');
    throw new Error('文本转3D功能即将推出，敬请期待！');
  }
} 