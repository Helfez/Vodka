/**
 * 提示词模板管理器
 * 用于管理不同场景的系统预设和用户提示词
 */

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  userPrompt: string;
  category: 'analysis' | 'generation' | 'style';
}

export class PromptTemplateManager {
  private static instance: PromptTemplateManager;
  private templates: Map<string, PromptTemplate> = new Map();

  private constructor() {
    this.initializeDefaultTemplates();
  }

  public static getInstance(): PromptTemplateManager {
    if (!PromptTemplateManager.instance) {
      PromptTemplateManager.instance = new PromptTemplateManager();
    }
    return PromptTemplateManager.instance;
  }

  /**
   * 初始化默认模板
   */
  private initializeDefaultTemplates(): void {
    const defaultTemplates: PromptTemplate[] = [
      {
        id: 'basic_analysis',
        name: '基础分析',
        description: '对画板内容进行基础的元素和布局分析',
        category: 'analysis',
        systemPrompt: '你是一个专业的图像分析师，请分析用户的画板内容并生成详细的图片描述。',
        userPrompt: '请分析这个画板的内容，描述其中的元素、布局、颜色和风格，然后生成一个适合用于AI图片生成的详细提示词。'
      },
      {
        id: 'artistic_analysis',
        name: '艺术风格分析',
        description: '重点分析画板的艺术风格和创意元素',
        category: 'analysis',
        systemPrompt: '你是一个艺术评论家和创意顾问，擅长分析视觉作品的艺术风格、创意理念和美学价值。',
        userPrompt: '请从艺术角度分析这个画板作品，包括：1) 艺术风格和流派 2) 色彩搭配和构图 3) 创意元素和表现手法 4) 情感表达和主题思想。然后生成一个富有艺术感的图片生成提示词。'
      },
      {
        id: 'technical_analysis',
        name: '技术细节分析',
        description: '专注于技术实现和视觉效果的详细分析',
        category: 'analysis',
        systemPrompt: '你是一个技术美术专家，精通数字艺术创作的技术细节和视觉效果实现。',
        userPrompt: '请从技术角度分析这个画板，包括：1) 绘画技法和工具使用 2) 光影效果和材质表现 3) 细节处理和精度要求 4) 适合的渲染风格。生成一个技术导向的详细提示词。'
      },
      {
        id: 'concept_art',
        name: '概念艺术',
        description: '将画板内容转换为概念艺术风格',
        category: 'generation',
        systemPrompt: '你是一个概念艺术指导，擅长将创意想法转化为专业的概念艺术作品描述。',
        userPrompt: '基于这个画板的内容，创建一个概念艺术风格的图片生成提示词，要求：高质量、专业级别、适合游戏或电影概念设计，包含详细的环境、角色或物体描述。'
      },
      {
        id: 'photorealistic',
        name: '照片级真实',
        description: '生成照片级真实感的图片',
        category: 'generation',
        systemPrompt: '你是一个专业摄影师和视觉效果专家，擅长创建照片级真实感的图像描述。',
        userPrompt: '基于画板内容，生成一个照片级真实感的图片提示词，要求：超高清、专业摄影质量、真实的光影效果、细致的材质表现。'
      },
      {
        id: 'anime_style',
        name: '动漫风格',
        description: '转换为日式动漫/插画风格',
        category: 'style',
        systemPrompt: '你是一个动漫插画专家，熟悉各种日式动漫和插画风格。',
        userPrompt: '将画板内容转换为动漫风格的图片描述，要求：日式动漫美学、鲜明的色彩、精美的细节、符合动漫角色设计规范。'
      },
      {
        id: 'watercolor',
        name: '水彩画风格',
        description: '转换为水彩画艺术风格',
        category: 'style',
        systemPrompt: '你是一个水彩画艺术家，精通传统水彩技法和现代水彩艺术。',
        userPrompt: '将画板内容转换为水彩画风格，要求：柔和的色彩渐变、自然的水彩纹理、艺术感的笔触效果、传统水彩画的美学特征。'
      },
      {
        id: 'minimalist',
        name: '极简主义',
        description: '转换为极简主义设计风格',
        category: 'style',
        systemPrompt: '你是一个极简主义设计师，擅长用最少的元素表达最大的视觉冲击力。',
        userPrompt: '将画板内容简化为极简主义风格，要求：简洁的构图、有限的色彩搭配、清晰的几何形状、强调负空间的使用。'
      }
    ];

    defaultTemplates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  /**
   * 获取所有模板
   */
  getAllTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * 根据分类获取模板
   */
  getTemplatesByCategory(category: 'analysis' | 'generation' | 'style'): PromptTemplate[] {
    return this.getAllTemplates().filter(template => template.category === category);
  }

  /**
   * 根据ID获取模板
   */
  getTemplate(id: string): PromptTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * 添加自定义模板
   */
  addTemplate(template: PromptTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * 删除模板
   */
  removeTemplate(id: string): boolean {
    return this.templates.delete(id);
  }

  /**
   * 更新模板
   */
  updateTemplate(id: string, updates: Partial<PromptTemplate>): boolean {
    const existing = this.templates.get(id);
    if (existing) {
      this.templates.set(id, { ...existing, ...updates });
      return true;
    }
    return false;
  }

  /**
   * 获取默认分析模板
   */
  getDefaultAnalysisTemplate(): PromptTemplate {
    return this.getTemplate('basic_analysis') || this.getAllTemplates()[0];
  }

  /**
   * 获取默认生成模板
   */
  getDefaultGenerationTemplate(): PromptTemplate {
    const generationTemplates = this.getTemplatesByCategory('generation');
    return generationTemplates[0] || this.getTemplate('concept_art') || this.getAllTemplates()[0];
  }
} 