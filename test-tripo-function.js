// 测试Tripo后台函数的脚本
// 运行方式: node test-tripo-function.js

const testTripoFunction = async () => {
  console.log('🧪 测试Tripo后台函数...');
  
  // 替换为您的实际域名
  const baseUrl = 'https://YOUR_SITE_URL.netlify.app'; // 请替换为实际URL
  
  try {
    // 1. 测试生成函数
    console.log('📡 测试 tripo-generate...');
    const generateResponse = await fetch(`${baseUrl}/.netlify/functions/tripo-generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', // 1x1像素测试图片
        outputFormat: 'glb',
        removeBackground: true,
        foregroundRatio: 0.85,
        mcResolution: 256
      })
    });

    if (!generateResponse.ok) {
      console.error('❌ Generate函数失败:', generateResponse.status, generateResponse.statusText);
      const errorText = await generateResponse.text();
      console.error('错误详情:', errorText);
      return;
    }

    const generateResult = await generateResponse.json();
    console.log('✅ Generate函数成功:', generateResult);
    
    if (!generateResult.taskId) {
      console.error('❌ 未获取到taskId');
      return;
    }

    const taskId = generateResult.taskId;
    console.log('📋 任务ID:', taskId);

    // 2. 测试状态查询函数
    console.log('📡 测试 tripo-status...');
    const statusResponse = await fetch(`${baseUrl}/.netlify/functions/tripo-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId })
    });

    if (!statusResponse.ok) {
      console.error('❌ Status函数失败:', statusResponse.status, statusResponse.statusText);
      const errorText = await statusResponse.text();
      console.error('错误详情:', errorText);
      return;
    }

    const statusResult = await statusResponse.json();
    console.log('✅ Status函数成功:', statusResult);

    console.log('🎉 函数测试完成！');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
};

// 运行测试
testTripoFunction(); 