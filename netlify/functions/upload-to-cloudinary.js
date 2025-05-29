const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

exports.handler = async (event, context) => {
  console.log('[upload-to-cloudinary] === 图片上传服务开始 ===');
  
  // 设置CORS头
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // 处理OPTIONS请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    console.error('[upload-to-cloudinary] ❌ 不支持的HTTP方法:', event.httpMethod);
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: '只支持POST请求' 
      }),
    };
  }

  try {
    console.log('[upload-to-cloudinary] 📋 请求信息:');
    console.log('  - 方法:', event.httpMethod);
    console.log('  - 来源:', event.headers.origin || 'unknown');
    console.log('  - User-Agent:', event.headers['user-agent'] || 'unknown');

    const requestBody = JSON.parse(event.body);
    const { imageUrl, prompt } = requestBody;

    if (!imageUrl) {
      console.error('[upload-to-cloudinary] ❌ 缺少图片URL');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: '缺少图片URL' 
        }),
      };
    }

    console.log('[upload-to-cloudinary] 📸 开始上传图片到Cloudinary...');
    console.log('  - 原始URL:', imageUrl.substring(0, 50) + '...');
    console.log('  - Prompt长度:', prompt?.length || 0);

    const uploadStartTime = Date.now();

    // 上传到Cloudinary
    const cloudinaryUploadResponse = await cloudinary.uploader.upload(imageUrl, {
      folder: 'ai-generated-images',
      public_id: `ai_gen_${Date.now()}`,
      resource_type: 'image',
      overwrite: true,
      transformation: [
        { quality: 'auto' },
        { fetch_format: 'auto' }
      ]
    });

    const uploadEndTime = Date.now();
    const uploadDuration = uploadEndTime - uploadStartTime;

    console.log('[upload-to-cloudinary] ✅ 图片上传成功:');
    console.log('  - 上传耗时:', uploadDuration, 'ms');
    console.log('  - Cloudinary URL:', cloudinaryUploadResponse.secure_url);
    console.log('  - 图片尺寸:', cloudinaryUploadResponse.width, 'x', cloudinaryUploadResponse.height);
    console.log('  - 文件大小:', Math.round(cloudinaryUploadResponse.bytes / 1024), 'KB');
    console.log('  - Public ID:', cloudinaryUploadResponse.public_id);

    const result = {
      success: true,
      cloudinaryUrl: cloudinaryUploadResponse.secure_url,
      publicId: cloudinaryUploadResponse.public_id,
      metadata: {
        width: cloudinaryUploadResponse.width,
        height: cloudinaryUploadResponse.height,
        size: cloudinaryUploadResponse.bytes,
        format: cloudinaryUploadResponse.format,
        uploadTime: uploadDuration,
        prompt: prompt || ''
      }
    };

    console.log('[upload-to-cloudinary] === 图片上传服务完成 ===');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };

  } catch (error) {
    console.error('[upload-to-cloudinary] ❌ 上传失败:', error);
    console.error('  - 错误类型:', error.constructor.name);
    console.error('  - 错误消息:', error.message);
    console.error('  - 错误堆栈:', error.stack);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: error.message || '图片上传失败' 
      }),
    };
  }
}; 