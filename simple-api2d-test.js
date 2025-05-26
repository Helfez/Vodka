// 简单的API2D连接测试脚本
const https = require('https');

const API_KEY = 'fk233246-7GXS8dxLykzf6KsZws7edtOnLoEt842L';
const options = {
  hostname: 'openai.api2d.net',
  port: 443,
  path: '/v1/models',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${API_KEY}`
  }
};

console.log('开始测试API2D连接...');

const req = https.request(options, (res) => {
  console.log(`状态码: ${res.statusCode}`);
  
  if (res.statusCode === 200) {
    console.log('API2D连接成功!');
  } else {
    console.log('API2D连接失败，状态码不是200');
  }
  
  res.on('data', (chunk) => {
    console.log('收到数据片段，长度:', chunk.length);
  });
});

req.on('error', (e) => {
  console.error('请求错误:', e.message);
});

req.end();
