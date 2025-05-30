/**
 * AIhubmix Vision 分析服务
 * 用于分析画板快照并生成图片描述
 */
export class AihubmixVisionService {
  private static instance: AihubmixVisionService;
  private baseUrl: string;

  private constructor() {
    // 使用当前域名或环境变量中的URL
    this.baseUrl = process.env.REACT_APP_API_URL || window.location.origin;
    console.log('[AihubmixVisionService] 🔧 服务初始化，Base URL:', this.baseUrl);
  }

  public static getInstance(): AihubmixVisionService {
    if (!AihubmixVisionService.instance) {
      console.log('[AihubmixVisionService] 🆕 创建新的服务实例');
      AihubmixVisionService.instance = new AihubmixVisionService();
    }
    return AihubmixVisionService.instance;
  }

  /**
   * 分析画板快照
   * @param imageBase64 画板快照的base64编码
   * @param systemPrompt 系统提示词
   * @param userPrompt 用户提示词
   * @returns 分析结果
   */
  async analyzeImage(
    imageBase64: string, 
    systemPrompt?: string, 
    userPrompt?: string
  ): Promise<{ analysis: string; usage?: any }> {
    console.log('[AihubmixVisionService analyzeImage] === Vision分析服务开始 ===');
    
    try {
      console.log('[AihubmixVisionService analyzeImage] 📋 请求参数:');
      console.log('  - 图片大小:', Math.round(imageBase64.length / 1024), 'KB');
      console.log('  - 系统提示词长度:', systemPrompt?.length || 0);
      console.log('  - 用户提示词长度:', userPrompt?.length || 0);
      console.log('  - 目标URL:', `${this.baseUrl}/.netlify/functions/aihubmix-vision-analyze`);
      
      const requestBody = {
        image_base64: imageBase64,
        system_prompt: systemPrompt,
        user_prompt: userPrompt
      };

      console.log('[AihubmixVisionService analyzeImage] 🚀 发起网络请求...');
      const requestStartTime = performance.now();
      
      const response = await fetch(`${this.baseUrl}/.netlify/functions/aihubmix-vision-analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const requestEndTime = performance.now();
      const requestDuration = Math.round(requestEndTime - requestStartTime);

      console.log('[AihubmixVisionService analyzeImage] 📡 网络请求完成:');
      console.log('  - 请求耗时:', requestDuration, 'ms');
      console.log('  - 响应状态:', response.status, response.statusText);
      console.log('  - 响应头:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        console.error('[AihubmixVisionService analyzeImage] ❌ HTTP请求失败');
        const errorData = await response.json().catch(() => ({}));
        console.error('  - 错误数据:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('[AihubmixVisionService analyzeImage] 📖 解析响应数据...');
      const result = await response.json();
      
      if (!result.success) {
        console.error('[AihubmixVisionService analyzeImage] ❌ 业务逻辑失败:', result.error);
        throw new Error(result.error || '分析失败');
      }

      console.log('[AihubmixVisionService analyzeImage] ✅ 分析成功:');
      console.log('  - 分析结果长度:', result.analysis?.length || 0, '字符');
      console.log('  - 使用情况:', result.usage);
      console.log('  - 元数据:', result.metadata);
      console.log('  - 结果预览:', result.analysis?.substring(0, 100) + '...');
      console.log('[AihubmixVisionService analyzeImage] === Vision分析服务完成 ===');

      return {
        analysis: result.analysis,
        usage: result.usage
      };

    } catch (error) {
      console.error('[AihubmixVisionService analyzeImage] ❌ 分析失败:', error);
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
    console.log('[AihubmixVisionService isAvailable] 🔍 检查服务可用性...');
    
    try {
      const checkStartTime = performance.now();
      
      // 简单的健康检查
      const response = await fetch(`${this.baseUrl}/.netlify/functions/aihubmix-vision-analyze`, {
        method: 'OPTIONS'
      });
      
      const checkEndTime = performance.now();
      const checkDuration = Math.round(checkEndTime - checkStartTime);
      
      const isAvailable = response.ok;
      console.log('[AihubmixVisionService isAvailable] 📊 可用性检查结果:');
      console.log('  - 检查耗时:', checkDuration, 'ms');
      console.log('  - 服务可用:', isAvailable);
      console.log('  - 响应状态:', response.status);
      
      return isAvailable;
    } catch (error) {
      console.error('[AihubmixVisionService isAvailable] ❌ 可用性检查失败:', error);
      return false;
    }
  }

  /**
   * 分析画板快照（包含参考图片）
   * @param canvasImageBase64 画板快照的base64编码
   * @param systemPrompt 系统提示词（纯文本）
   * @param referenceImageUrl 参考图片URL
   * @param userPrompt 用户提示词
   * @returns 分析结果
   */
  async analyzeImageWithReference(
    canvasImageBase64: string,
    systemPrompt: string,
    referenceImageUrl: string,
    userPrompt?: string
  ): Promise<{ analysis: string; usage?: any }> {
    console.log('[AihubmixVisionService analyzeImageWithReference] === 带参考图片的分析开始 ===');
    
    try {
      console.log('[AihubmixVisionService analyzeImageWithReference] 📋 请求参数:');
      console.log('  - 画板快照大小:', Math.round(canvasImageBase64.length / 1024), 'KB');
      console.log('  - 系统提示词长度:', systemPrompt.length);
      console.log('  - 参考图片URL:', referenceImageUrl);
      console.log('  - 用户提示词长度:', userPrompt?.length || 0);
      console.log('  - 目标URL:', `${this.baseUrl}/.netlify/functions/aihubmix-vision-analyze`);
      
      const requestBody = {
        image_base64: canvasImageBase64,
        system_prompt: systemPrompt,  // ai-prompts.ts的系统指令
        reference_image_url: referenceImageUrl
      };

      console.log('[AihubmixVisionService analyzeImageWithReference] 🚀 发起网络请求...');
      const requestStartTime = performance.now();
      
      const response = await fetch(`${this.baseUrl}/.netlify/functions/aihubmix-vision-analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const requestEndTime = performance.now();
      const requestDuration = Math.round(requestEndTime - requestStartTime);
      
      console.log('[AihubmixVisionService analyzeImageWithReference] 📊 网络请求完成:');
      console.log('  - 请求耗时:', requestDuration, 'ms');
      console.log('  - 响应状态:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AihubmixVisionService analyzeImageWithReference] ❌ 请求失败:');
        console.error('  - 状态码:', response.status);
        console.error('  - 错误信息:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        console.error('[AihubmixVisionService analyzeImageWithReference] ❌ 分析失败:', result.error);
        throw new Error(result.error || '图像分析失败');
      }

      console.log('[AihubmixVisionService analyzeImageWithReference] ✅ 分析成功:');
      console.log('  - 分析结果长度:', result.analysis?.length || 0);
      console.log('  - 总耗时:', requestDuration, 'ms');
      console.log('[AihubmixVisionService analyzeImageWithReference] === 带参考图片的分析完成 ===');

      return {
        analysis: result.analysis,
        usage: result.usage
      };

    } catch (error) {
      console.error('[AihubmixVisionService analyzeImageWithReference] ❌ 分析异常:', error);
      console.error('  - 错误类型:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('  - 错误消息:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
} 