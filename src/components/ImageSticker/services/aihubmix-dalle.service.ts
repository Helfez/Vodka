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
   * 生成图片
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
      console.log('  - 目标URL:', `${this.baseUrl}/.netlify/functions/aihubmix-dalle-generate`);
      
      const requestBody = {
        prompt,
        ...finalOptions
      };

      console.log('[AihubmixDalleService generateImage] 🚀 发起网络请求...');
      const requestStartTime = performance.now();
      
      const response = await fetch(`${this.baseUrl}/.netlify/functions/aihubmix-dalle-generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const requestEndTime = performance.now();
      const requestDuration = Math.round(requestEndTime - requestStartTime);

      console.log('[AihubmixDalleService generateImage] 📡 网络请求完成:');
      console.log('  - 请求耗时:', requestDuration, 'ms');
      console.log('  - 响应状态:', response.status, response.statusText);
      console.log('  - 响应头:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        console.error('[AihubmixDalleService generateImage] ❌ HTTP请求失败');
        const errorData = await response.json().catch(() => ({}));
        console.error('  - 错误数据:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('[AihubmixDalleService generateImage] 📖 解析响应数据...');
      const result = await response.json();
      
      if (!result.success) {
        console.error('[AihubmixDalleService generateImage] ❌ 业务逻辑失败:', result.error);
        throw new Error(result.error || '图片生成失败');
      }

      console.log('[AihubmixDalleService generateImage] ✅ 生成成功:');
      console.log('  - 生成图片数量:', result.images?.length || 0);
      console.log('  - 使用情况:', result.usage);
      console.log('  - 元数据:', result.metadata);
      
      result.images?.forEach((image: any, index: number) => {
        console.log(`  - 图片${index + 1}:`, {
          url: image.url?.substring(0, 50) + '...',
          hasRevisedPrompt: !!image.revised_prompt,
          revisedPromptLength: image.revised_prompt?.length || 0
        });
      });

      console.log('[AihubmixDalleService generateImage] === DALL-E生成服务完成 ===');

      return {
        images: result.images,
        usage: result.usage
      };

    } catch (error) {
      console.error('[AihubmixDalleService generateImage] ❌ 生成失败:', error);
      console.error('  - 错误类型:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('  - 错误消息:', error instanceof Error ? error.message : String(error));
      console.error('  - 错误堆栈:', error instanceof Error ? error.stack : 'N/A');
      throw error;
    }
  }

  /**
   * 检查服务是否可用
   */
  async isAvailable(): Promise<boolean> {
    console.log('[AihubmixDalleService isAvailable] 🔍 检查服务可用性...');
    
    try {
      const checkStartTime = performance.now();
      
      // 简单的健康检查
      const response = await fetch(`${this.baseUrl}/.netlify/functions/aihubmix-dalle-generate`, {
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