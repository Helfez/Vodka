// API2D连接测试脚本
const axios = require('axios');

// 使用API2D密钥
const API_KEY = 'fk233246-7GXS8dxLykzf6KsZws7edtOnLoEt842L';
const BASE_URL = 'https://openai.api2d.net/v1';

// 测试API2D连接
async function testAPI2DConnection() {
  console.log('开始测试API2D连接...');
  
  try {
    // 使用models接口进行简单测试
    const response = await axios.get(`${BASE_URL}/models`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      }
    });
    
    console.log('API2D连接成功!');
    console.log('可用模型数量:', response.data.data.length);
    console.log('部分可用模型:', response.data.data.slice(0, 3).map(model => model.id));
    
    return true;
  } catch (error) {
    console.error('API2D连接失败:', error.message);
    
    if (error.response) {
      console.error('错误状态码:', error.response.status);
      console.error('错误详情:', error.response.data);
    } else if (error.request) {
      console.error('未收到响应，可能是网络问题');
    }
    
    return false;
  }
}

// 执行测试
testAPI2DConnection()
  .then(success => {
    if (success) {
      console.log('测试完成: API2D连接正常');
    } else {
      console.log('测试完成: API2D连接异常');
    }
  })
  .catch(err => {
    console.error('测试过程中发生错误:', err);
  });
