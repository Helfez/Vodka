# AIhubmix 故障排除指南

## 常见错误及解决方案

### 1. 502 Bad Gateway 错误

**问题**: Netlify函数超时导致的502错误

**解决方案**: 
- ✅ 已实现异步处理架构
- ✅ 使用后台函数处理长时间任务
- ✅ 前端通过轮询获取结果

### 2. ES Module 错误

**问题**: `require() of ES Module` 错误

**解决方案**:
- ✅ 降级到兼容的包版本
- ✅ 使用 `node-fetch@2.7.0` (CommonJS)
- ✅ 使用 `uuid@9.0.1` (兼容版本)
- ✅ 使用 `cloudinary@1.41.3` (稳定版本)

### 3. 环境变量配置

确保在Netlify后台配置以下环境变量：

```
AIHUBMIX_API_KEY=your_aihubmix_api_key
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

### 4. 网络连接问题

**症状**: 连接超时或网络错误

**检查项**:
- [ ] API密钥是否正确
- [ ] 网络是否能访问 aihubmix.com
- [ ] Cloudinary配置是否正确

### 5. 调试步骤

1. **检查函数日志**:
   - 在Netlify后台查看Functions日志
   - 查找具体的错误信息

2. **测试API连接**:
   ```bash
   curl -X POST https://your-site.netlify.app/.netlify/functions/aihubmix-proxy \
     -H "Content-Type: application/json" \
     -d '{"image_base64":"test_base64_string"}'
   ```

3. **检查任务状态**:
   ```bash
   curl https://your-site.netlify.app/.netlify/functions/aihubmix-status?taskId=your_task_id
   ```

### 6. 性能优化

- ✅ 异步处理避免超时
- ✅ 实时进度反馈
- ✅ 错误重试机制
- ✅ 任务状态持久化

### 7. 联系支持

如果问题仍然存在，请提供：
- 错误截图
- 浏览器控制台日志
- Netlify函数日志
- 具体的操作步骤

## 更新日志

### v1.1.0 (最新)
- 修复ES Module兼容性问题
- 改进错误处理和日志记录
- 添加超时配置
- 优化依赖版本

### v1.0.0
- 初始异步处理实现
- 基础错误处理
- 任务状态管理

# 问题排查指南

## 当前问题：502 Bad Gateway 错误

### 错误分析

从错误日志可以看到主要问题：

1. **模块导入错误**: `require() of ES Module /node_modules/form-data/lib/form_data.js`
2. **CommonJS vs ES Module 冲突**: form-data v4.x 使用ES模块，与Netlify Functions的CommonJS环境不兼容

### 已实施的修复

#### 1. 依赖版本降级
- 将 `form-data` 从 `^4.0.2` 降级到 `^3.0.1`
- form-data v3.x 使用CommonJS，与Netlify Functions兼容

#### 2. 代码优化
- 修复了所有Netlify Functions的响应头
- 改进了错误处理和日志记录
- 优化了后台函数调用的URL构建逻辑

#### 3. 重新安装依赖
```bash
cd whiteboard-app/netlify
rm -rf node_modules package-lock.json
npm install
```

### 测试步骤

1. **基础功能测试**
   ```
   GET /.netlify/functions/test
   ```
   应该返回成功响应

2. **抠图功能测试**
   - 上传图片到白板
   - 右键点击图片选择"抠图"
   - 观察控制台日志和网络请求

### 环境变量检查

确保在Netlify后台配置了以下环境变量：

```
AIHUBMIX_API_KEY=your_api_key_here
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 常见问题

#### 1. 502 Bad Gateway
- **原因**: 通常是依赖包兼容性问题或代码语法错误
- **解决**: 检查Netlify Functions日志，修复代码错误

#### 2. 任务状态查询失败
- **原因**: taskId不存在或Blob存储问题
- **解决**: 检查任务创建是否成功，验证Blob存储配置

#### 3. 图像处理超时
- **原因**: AIhubmix API响应慢或网络问题
- **解决**: 增加超时时间，添加重试机制

### 调试技巧

1. **查看Netlify Functions日志**
   - 在Netlify后台的Functions标签页查看实时日志
   - 使用 `console.log` 添加调试信息

2. **本地测试**
   - 使用 `netlify dev` 在本地运行Functions
   - 检查依赖是否正确安装

3. **网络请求监控**
   - 使用浏览器开发者工具监控网络请求
   - 检查请求和响应的格式

### 下一步

如果问题仍然存在：

1. 检查Netlify部署日志
2. 验证环境变量配置
3. 测试简单的test函数是否工作
4. 逐步测试每个函数的功能 