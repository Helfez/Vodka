# 环境变量配置说明

## 必需的环境变量

### AIhubmix API配置
```
AIHUBMIX_API_KEY=your_aihubmix_api_key
```
- 用于调用AIhubmix图像处理API
- 需要在AIhubmix官网申请API密钥

### Cloudinary配置
```
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```
- 用于存储处理后的图片
- 需要在Cloudinary官网注册并获取配置信息

### Netlify配置
```
URL=https://your-site.netlify.app
```
- Netlify会自动设置此变量
- 用于Functions之间的内部调用

## 配置步骤

1. 在Netlify项目的Environment Variables中添加上述变量
2. 或者在本地开发时创建`.env`文件（不要提交到git）
3. 确保所有API密钥都已正确配置

## 功能说明

- **aihubmix-proxy**: 接收前端请求，创建异步任务
- **aihubmix-process-background**: 后台处理图像，调用AIhubmix API
- **aihubmix-status**: 查询任务处理状态
- **前端轮询**: 定期查询任务状态直到完成 