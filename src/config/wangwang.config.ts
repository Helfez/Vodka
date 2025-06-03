/**
 * 阿里旺旺客服配置
 */
export interface WangwangConfig {
  /** 店铺旺旺号 */
  shopWangwang: string;
  /** 店铺名称 */
  shopName: string;
  /** 消息模板 */
  messageTemplates: {
    handicraft: string;
    support: string;
    consultation: string;
  };
  /** 兜底联系方式 */
  fallbackContacts: {
    phone?: string;
    email?: string;
    qq?: string;
  };
}

export const WANGWANG_CONFIG: WangwangConfig = {
  // TODO: 请替换为实际的店铺旺旺号
  shopWangwang: "tripo3d",
  shopName: "TripoAI企业店",
  
  messageTemplates: {
    // 手办定制消息模板
    handicraft: `您好！我想制作这个模型的手办：

模型信息：
- 名称: {modelName}
- 格式: {modelFormat}
- 文件: {fileName}

模型链接: {modelUrl}

请问：
1. 可以定制制作这个手办吗？
2. 需要多长时间？
3. 价格是多少？
4. 支持哪些材质和尺寸？

期待您的回复！`,

    // 技术支持消息模板
    support: `您好！我在使用3D内容演示应用时遇到问题：

问题描述: {issueDescription}
发生时间: {timestamp}
模型信息: {modelInfo}

请协助解决，谢谢！`,

    // 一般咨询消息模板
    consultation: `您好！我对您的3D打印服务感兴趣，想了解更多信息。

咨询内容：{consultationContent}

请问方便详细介绍一下吗？`
  },

  fallbackContacts: {
    phone: "400-xxx-xxxx",
    email: "support@example.com",
    qq: "12345678"
  }
};

/**
 * 构造阿里旺旺聊天URL
 * @param message 消息内容
 * @param config 旺旺配置（可选，默认使用全局配置）
 * @returns 阿里旺旺URL
 */
export function buildWangwangUrl(message: string, config: WangwangConfig = WANGWANG_CONFIG): string {
  const { shopWangwang } = config;
  return `aliim:sendmsg?touid=${shopWangwang}&siteid=cntaobao&content=${encodeURIComponent(message)}`;
}

/**
 * 构造阿里旺旺网页版URL（兜底方案）
 * @param config 旺旺配置（可选，默认使用全局配置）
 * @returns 网页版旺旺URL
 */
export function buildWangwangWebUrl(config: WangwangConfig = WANGWANG_CONFIG): string {
  const { shopWangwang } = config;
  return `https://www.taobao.com/webww/ww.php?ver=3&touid=${shopWangwang}&siteid=cntaobao&status=2&charset=utf-8`;
}

/**
 * 打开阿里旺旺聊天窗口
 * @param message 消息内容
 * @param options 选项配置
 */
export async function openWangwangChat(
  message: string, 
  options: {
    showFallbackDialog?: boolean;
    fallbackDelay?: number;
    config?: WangwangConfig;
  } = {}
): Promise<void> {
  const {
    showFallbackDialog = true,
    fallbackDelay = 2000,
    config = WANGWANG_CONFIG
  } = options;

  // 检查是否在浏览器环境中
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    console.warn('[WangwangService] ⚠️ 非浏览器环境，无法打开阿里旺旺');
    return;
  }

  try {
    console.log('[WangwangService] 🎯 打开阿里旺旺聊天窗口');
    console.log('[WangwangService] 💬 消息内容:', message);
    
    // 构造阿里旺旺URL
    const wangwangUrl = buildWangwangUrl(message, config);
    
    // 尝试打开阿里旺旺客户端
    const link = document.createElement('a');
    link.href = wangwangUrl;
    link.click();
    
    console.log('[WangwangService] ✅ 已尝试打开阿里旺旺客户端');
    
    // 提供网页版兜底方案
    if (showFallbackDialog && typeof window.confirm === 'function') {
      setTimeout(() => {
        const webUrl = buildWangwangWebUrl(config);
        const shouldOpenWeb = window.confirm(
          `如果阿里旺旺客户端未自动打开，点击确定使用网页版聊天\n\n或者您也可以直接联系：\n电话：${config.fallbackContacts.phone || '暂无'}\nQQ：${config.fallbackContacts.qq || '暂无'}`
        );
        
        if (shouldOpenWeb) {
          window.open(webUrl, '_blank');
        }
      }, fallbackDelay);
    }
    
  } catch (error) {
    console.error('[WangwangService] ❌ 打开阿里旺旺失败:', error);
    throw new Error('打开客服聊天失败，请稍后重试');
  }
}

/**
 * 替换消息模板中的变量
 * @param template 消息模板
 * @param variables 变量对象
 * @returns 替换后的消息
 */
export function replaceMessageTemplate(template: string, variables: Record<string, string>): string {
  let message = template;
  
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{${key}}`;
    message = message.replace(new RegExp(placeholder, 'g'), value || '暂无');
  });
  
  return message;
} 