/**
 * AIhubmix DALL-E 图片生成服务
 * 用于调用AIhubmix的DALL-E API生成图片
 */
export class AihubmixDalleService {
  private static instance: AihubmixDalleService;
  private baseUrl: string;

  private constructor() {
    // 使用当前域名或环境变量中的URL
    this.baseUrl = process.env.REACT_APP_API_URL || window.location.origin;
    console.log('[AihubmixDalleService] 🔧 服务初始化，Base URL:', this.baseUrl);
  }

  public static getInstance(): AihubmixDalleService {
    if (!AihubmixDalleService.instance) {
      console.log('[AihubmixDalleService] 🆕 创建新的服务实例');
      AihubmixDalleService.instance = new AihubmixDalleService();
    }
    return AihubmixDalleService.instance;
  }

  /**
   * 生成图片 - 使用后台处理避免超时
   * @param prompt 图片生成提示词
   * @param options 生成选项
   * @returns 生成的图片信息
   */
  async generateImage(
    prompt: string,
    options: {
      n?: number;
      size?: "1024x1024" | "1792x1024" | "1024x1792";
      quality?: "standard" | "hd";
      style?: "vivid" | "natural";
    } = {}
  ): Promise<{
    images: Array<{
      url: string;
      revised_prompt?: string;
    }>;
    usage?: any;
  }> {
    console.log('[AihubmixDalleService generateImage] === DALL-E生成服务开始 ===');
    
    try {
      const finalOptions = {
        n: options.n || 1,
        size: options.size || "1024x1024",
        quality: options.quality || "standard",
        style: options.style || "vivid"
      };

      console.log('[AihubmixDalleService generateImage] 📋 生成参数:');
      console.log('  - 提示词长度:', prompt.length, '字符');
      console.log('  - 提示词预览:', prompt.substring(0, 100) + '...');
      console.log('  - 图片数量:', finalOptions.n);
      console.log('  - 图片尺寸:', finalOptions.size);
      console.log('  - 图片质量:', finalOptions.quality);
      console.log('  - 图片风格:', finalOptions.style);
      console.log('  - 使用后台处理避免超时');

      // 第一步：启动后台任务
      console.log('[AihubmixDalleService generateImage] 🚀 启动后台生成任务...');
      const taskStartTime = performance.now();
      
      const taskResponse = await fetch(`${this.baseUrl}/.netlify/functions/aihubmix-native`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'generate', // 新增action参数区分生成和编辑
          prompt,
          ...finalOptions
        }),
      });

      if (!taskResponse.ok) {
        console.error('[AihubmixDalleService generateImage] ❌ 任务启动失败');
        const errorData = await taskResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${taskResponse.status}: ${taskResponse.statusText}`);
      }

      const taskResult = await taskResponse.json();
      const taskId = taskResult.taskId;

      if (!taskId) {
        console.error('[AihubmixDalleService generateImage] ❌ 未获取到任务ID');
        throw new Error('未能启动后台生成任务');
      }

      console.log('[AihubmixDalleService generateImage] ✅ 后台任务已启动，任务ID:', taskId);

      // 第二步：轮询任务状态
      console.log('[AihubmixDalleService generateImage] 🔄 开始轮询任务状态...');
      const result = await this.pollTaskStatus(taskId);

      const taskEndTime = performance.now();
      const totalDuration = Math.round(taskEndTime - taskStartTime);

      console.log('[AihubmixDalleService generateImage] ✅ 生成完成:');
      console.log('  - 总耗时:', totalDuration, 'ms');
      console.log('  - 生成图片数量:', result.images?.length || 0);
      console.log('  - 任务ID:', taskId);

      console.log('[AihubmixDalleService generateImage] === DALL-E生成服务完成 ===');

      return result;

    } catch (error) {
      console.error('[AihubmixDalleService generateImage] ❌ 生成失败:', error);
      console.error('  - 错误类型:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('  - 错误消息:', error instanceof Error ? error.message : String(error));
      console.error('  - 错误堆栈:', error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * 轮询任务状态直到完成
   */
  private async pollTaskStatus(taskId: string): Promise<{
    images: Array<{
      url: string;
      revised_prompt?: string;
    }>;
    usage?: any;
  }> {
    console.log('[AihubmixDalleService pollTaskStatus] 🔄 开始轮询任务:', taskId);
    
    const maxAttempts = 60; // 最多轮询60次
    const pollInterval = 2000; // 每2秒轮询一次
    let attempts = 0;

    while (attempts < maxAttempts) {
      attempts++;
      console.log(`[AihubmixDalleService pollTaskStatus] 📊 轮询第${attempts}次，任务ID:`, taskId);

      try {
        const statusResponse = await fetch(`${this.baseUrl}/.netlify/functions/aihubmix-status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ taskId }),
        });

        if (!statusResponse.ok) {
          console.warn(`[AihubmixDalleService pollTaskStatus] ⚠️ 状态查询失败，第${attempts}次尝试`);
          await this.sleep(pollInterval);
          continue;
        }

        const statusData = await statusResponse.json();
        console.log(`[AihubmixDalleService pollTaskStatus] 📋 任务状态:`, statusData.status);

        if (statusData.status === 'completed') {
          console.log('[AihubmixDalleService pollTaskStatus] ✅ 任务完成');
          return {
            images: [{
              url: statusData.imageUrl,
              revised_prompt: statusData.revised_prompt
            }],
            usage: statusData.usage
          };
        } else if (statusData.status === 'failed') {
          console.error('[AihubmixDalleService pollTaskStatus] ❌ 任务失败:', statusData.error);
          throw new Error(statusData.error || '后台任务执行失败');
        } else if (statusData.status === 'processing') {
          console.log(`[AihubmixDalleService pollTaskStatus] ⏳ 任务处理中，等待${pollInterval}ms后重试...`);
        } else {
          console.log(`[AihubmixDalleService pollTaskStatus] 🔄 任务状态: ${statusData.status}，继续等待...`);
        }

        await this.sleep(pollInterval);

      } catch (error) {
        console.warn(`[AihubmixDalleService pollTaskStatus] ⚠️ 轮询出错，第${attempts}次尝试:`, error);
        await this.sleep(pollInterval);
      }
    }

    console.error('[AihubmixDalleService pollTaskStatus] ❌ 轮询超时，任务可能仍在处理中');
    throw new Error('任务处理超时，请稍后重试');
  }

  /**
   * 等待指定毫秒数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 检查服务是否可用
   */
  async isAvailable(): Promise<boolean> {
    console.log('[AihubmixDalleService isAvailable] 🔍 检查服务可用性...');
    
    try {
      const checkStartTime = performance.now();
      
      // 检查后台处理服务
      const response = await fetch(`${this.baseUrl}/.netlify/functions/aihubmix-native`, {
        method: 'OPTIONS'
      });
      
      const checkEndTime = performance.now();
      const checkDuration = Math.round(checkEndTime - checkStartTime);
      
      const isAvailable = response.ok;
      console.log('[AihubmixDalleService isAvailable] 📊 可用性检查结果:');
      console.log('  - 检查耗时:', checkDuration, 'ms');
      console.log('  - 服务可用:', isAvailable);
      console.log('  - 响应状态:', response.status);
      
      return isAvailable;
    } catch (error) {
      console.error('[AihubmixDalleService isAvailable] ❌ 可用性检查失败:', error);
      return false;
    }
  }
} 