# AI 图片生成功能使用指南

## 功能概述

基于您现有的AIhubmix服务，我们实现了一个完整的AI图片生成工作流：

1. **画板分析** - 使用ChatGPT Vision API分析画板内容
2. **智能提示词生成** - 基于分析结果生成图片描述
3. **图片生成** - 使用DALL-E API生成高质量图片
4. **无缝集成** - 生成的图片直接添加到画板
5. **📸 自动快照下载** - 每次AI生成时自动下载画板PNG快照
6. **📊 详细日志记录** - 完整的节点日志追踪整个流程

## 使用方法

### 1. 触发AI生成
- 点击画板右上角的 "🎨 AI生成" 按钮
- 或使用快捷键 `Ctrl+G` (Windows) / `Cmd+G` (Mac)

**🆕 自动功能：**
- 📸 **自动下载快照**：触发AI生成时，系统会自动下载当前画板的PNG快照文件
- 📁 **文件命名**：快照文件名格式为 `whiteboard-snapshot-YYYY-MM-DDTHH-mm-ss-sssZ.png`
- 💾 **本地保存**：文件会自动保存到浏览器的默认下载目录

### 2. 选择分析模板
系统提供多种预设模板：

#### 分析模板
- **基础分析** - 对画板内容进行基础的元素和布局分析
- **艺术风格分析** - 重点分析画板的艺术风格和创意元素
- **技术细节分析** - 专注于技术实现和视觉效果的详细分析

#### 生成模板
- **概念艺术** - 将画板内容转换为概念艺术风格
- **照片级真实** - 生成照片级真实感的图片

#### 风格模板
- **动漫风格** - 转换为日式动漫/插画风格
- **水彩画风格** - 转换为水彩画艺术风格
- **极简主义** - 转换为极简主义设计风格

### 3. 编辑提示词
- AI分析完成后，您可以查看和编辑生成的提示词
- 根据需要调整描述，以获得更符合期望的结果

### 4. 生成和使用图片
- 点击"生成图片"开始创建
- 选择满意的图片点击"使用此图片"
- 图片将自动添加到画板中央

## 📊 详细日志系统

### 日志特性
- **🎯 节点级追踪**：每个关键步骤都有详细的日志记录
- **⏱️ 性能监控**：记录每个操作的耗时和性能指标
- **📈 数据统计**：包含文件大小、API使用情况等详细信息
- **🔍 错误诊断**：详细的错误信息和堆栈跟踪

### 日志查看方法
1. 打开浏览器开发者工具 (F12)
2. 切换到 "Console" 标签页
3. 使用AI生成功能时查看实时日志

### 日志内容示例
```
[Whiteboard handleOpenAIGeneration] === AI生成流程开始 ===
[Whiteboard handleOpenAIGeneration] 📊 画布信息:
  - 画布尺寸: 800 x 600
  - 对象数量: 3
  - 背景色: #ffffff
[Whiteboard handleOpenAIGeneration] 📸 开始生成画布快照...
[Whiteboard handleOpenAIGeneration] ✅ 快照生成完成:
  - 耗时: 45 ms
  - 大小: 234 KB
[Whiteboard handleOpenAIGeneration] ✅ PNG文件下载完成: whiteboard-snapshot-2024-01-15T10-30-45-123Z.png
```

### 日志分类
- **🔧 系统初始化**：服务启动和配置信息
- **📥 请求处理**：API调用参数和网络请求详情
- **⚡ 性能指标**：各阶段耗时和资源使用情况
- **✅ 成功操作**：操作完成和结果统计
- **❌ 错误处理**：详细的错误信息和诊断数据

## 技术架构

### 后端服务
- `aihubmix-vision-analyze.js` - ChatGPT Vision分析服务
- `aihubmix-dalle-generate.js` - DALL-E图片生成服务
- 基于[AIhubmix API](https://docs.aihubmix.com/cn/api/OpenAI-library)

### 前端组件
- `AIGenerationPanel.tsx` - 主要的AI生成界面
- `AihubmixVisionService.ts` - Vision API调用服务
- `AihubmixDalleService.ts` - DALL-E API调用服务
- `PromptTemplateManager.ts` - 提示词模板管理

### 环境配置
需要在Netlify环境变量中设置：
```
AIHUBMIX_API_KEY=sk-your-aihubmix-api-key
```

## API调用流程

1. **画板快照** → `canvas.toDataURL()` 获取base64图片 + 自动PNG下载
2. **Vision分析** → `aihubmix-vision-analyze` 函数
3. **提示词编辑** → 用户可修改AI生成的描述
4. **图片生成** → `aihubmix-dalle-generate` 函数
5. **图片集成** → 自动添加到Fabric.js画布

## 特性亮点

- ✅ **统一API** - 全部使用AIhubmix服务，无需多个API密钥
- ✅ **模板系统** - 8种预设模板，支持不同创作需求
- ✅ **实时预览** - 分析结果实时显示，可编辑调整
- ✅ **无缝集成** - 生成图片直接添加到画板，支持撤销
- ✅ **响应式设计** - 适配桌面和移动设备
- ✅ **快捷键支持** - `Ctrl+G` 快速启动
- ✅ **错误处理** - 完善的错误提示和重试机制
- 🆕 **自动快照下载** - 每次生成时自动保存画板PNG文件
- 🆕 **详细日志记录** - 完整的节点级日志追踪和性能监控

## 故障排除

### 1. 检查API配置
访问 `/.netlify/functions/test-ai-generation` 查看环境状态

### 2. 常见问题
- **分析失败** - 检查AIHUBMIX_API_KEY是否正确设置
- **生成失败** - 可能是提示词违反内容政策，尝试修改描述
- **图片加载失败** - 检查网络连接和CORS设置
- **PNG下载失败** - 检查浏览器下载权限设置

### 3. 调试信息
所有操作都有详细的控制台日志，可在浏览器开发者工具中查看：

#### 关键日志标识符
- `[Whiteboard]` - 主画板组件日志
- `[AIGenerationPanel]` - AI生成面板日志
- `[AihubmixVisionService]` - Vision分析服务日志
- `[AihubmixDalleService]` - DALL-E生成服务日志
- `[aihubmix-vision-analyze]` - 后端Vision函数日志
- `[aihubmix-dalle-generate]` - 后端DALL-E函数日志

#### 日志符号说明
- 🔧 系统配置和初始化
- 📥 请求接收和参数解析
- 🚀 API调用开始
- ✅ 操作成功完成
- ❌ 错误和失败
- 📊 数据统计和性能指标
- 🎯 关键节点和状态变化

## 扩展功能

### 自定义模板
可以通过 `PromptTemplateManager` 添加自定义模板：

```typescript
const templateManager = PromptTemplateManager.getInstance();
templateManager.addTemplate({
  id: 'custom_style',
  name: '自定义风格',
  description: '您的自定义描述',
  category: 'style',
  systemPrompt: '您的系统提示词',
  userPrompt: '您的用户提示词'
});
```

### 批量生成
可以修改 `dalle-generate` 函数的 `n` 参数来生成多张图片。

### 自定义快照格式
可以修改 `handleOpenAIGeneration` 函数中的 `toDataURL` 参数来调整快照质量和格式。

## 更新日志

- **v1.1.0** - 新增自动PNG下载和详细日志记录功能
  - 📸 每次AI生成时自动下载画板快照
  - 📊 完整的节点级日志追踪系统
  - ⏱️ 性能监控和耗时统计
  - 🔍 详细的错误诊断信息
- **v1.0.0** - 初始版本，支持基础的Vision分析和DALL-E生成
- 基于AIhubmix统一API，简化配置和维护 