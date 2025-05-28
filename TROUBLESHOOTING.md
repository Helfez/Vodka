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