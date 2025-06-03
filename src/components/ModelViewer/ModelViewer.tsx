import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import './ModelViewer.css';

interface ModelViewerProps {
  isOpen: boolean;
  onClose: () => void;
  modelUrl: string;
  modelFormat?: string;
  previewUrl?: string;
  modelName?: string;
}

export const ModelViewer: React.FC<ModelViewerProps> = ({
  isOpen,
  onClose,
  modelUrl,
  modelFormat = 'glb',
  previewUrl,
  modelName = '3D模型'
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationIdRef = useRef<number | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);

  // 初始化3D场景
  const initThreeJS = () => {
    if (!mountRef.current) return;

    console.log('[ModelViewer] 🎬 初始化Three.js场景...');

    // 场景
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);
    sceneRef.current = scene;

    // 相机
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(2, 2, 5);

    // 渲染器
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    rendererRef.current = renderer;

    mountRef.current.appendChild(renderer.domElement);

    // 控制器
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.autoRotate = false;
    controlsRef.current = controls;

    // 光照
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-10, -10, -5);
    scene.add(fillLight);

    // 网格地面
    const gridHelper = new THREE.GridHelper(10, 10);
    gridHelper.material.opacity = 0.3;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    // 渲染循环
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    console.log('[ModelViewer] ✅ Three.js场景初始化完成');
  };

  // 加载3D模型
  const loadModel = async (url: string, format: string) => {
    if (!sceneRef.current) return;

    console.log(`[ModelViewer] 📦 开始加载${format.toUpperCase()}模型:`, url);
    setIsLoading(true);
    setError(null);
    setLoadProgress(0);

    try {
      let loader: GLTFLoader | OBJLoader;
      
      if (format.toLowerCase() === 'glb' || format.toLowerCase() === 'gltf') {
        loader = new GLTFLoader();
      } else if (format.toLowerCase() === 'obj') {
        loader = new OBJLoader();
      } else {
        throw new Error(`不支持的模型格式: ${format}`);
      }

      // 如果是外部URL（如Tripo3D），使用代理
      let actualUrl = url;
      if (url.includes('tripo3d.com') || url.includes('tripo-data.rgl.data')) {
        const proxyUrl = `${window.location.origin}/.netlify/functions/model-proxy?url=${encodeURIComponent(url)}`;
        actualUrl = proxyUrl;
        console.log('[ModelViewer] 🔗 使用代理URL:', proxyUrl);
      }

      // 设置加载进度回调
      const loadedModel = await new Promise((resolve, reject) => {
        if (loader instanceof GLTFLoader) {
          loader.load(
            actualUrl,
            (gltf) => {
              console.log('[ModelViewer] ✅ GLB/GLTF模型加载成功');
              resolve(gltf.scene);
            },
            (progress) => {
              const percent = Math.round((progress.loaded / progress.total) * 100);
              setLoadProgress(percent);
              console.log(`[ModelViewer] 📊 加载进度: ${percent}%`);
            },
            (error) => {
              console.error('[ModelViewer] ❌ GLB/GLTF加载失败:', error);
              reject(error);
            }
          );
        } else if (loader instanceof OBJLoader) {
          loader.load(
            actualUrl,
            (obj) => {
              console.log('[ModelViewer] ✅ OBJ模型加载成功');
              resolve(obj);
            },
            (progress) => {
              const percent = Math.round((progress.loaded / progress.total) * 100);
              setLoadProgress(percent);
              console.log(`[ModelViewer] 📊 加载进度: ${percent}%`);
            },
            (error) => {
              console.error('[ModelViewer] ❌ OBJ加载失败:', error);
              reject(error);
            }
          );
        }
      });

      // 清除之前的模型
      const existingModel = sceneRef.current.getObjectByName('loadedModel');
      if (existingModel) {
        sceneRef.current.remove(existingModel);
      }

      // 添加新模型到场景
      const model = loadedModel as THREE.Object3D;
      model.name = 'loadedModel';

      // 计算模型边界框，自动调整大小和位置
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      // 将模型居中
      model.position.x = -center.x;
      model.position.y = -center.y;
      model.position.z = -center.z;

      // 缩放模型以适合视口
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2 / maxDim; // 模型最大尺寸为2个单位
      model.scale.setScalar(scale);

      // 启用阴影
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      sceneRef.current.add(model);

      // 调整相机位置
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }

      console.log('[ModelViewer] ✅ 模型添加到场景完成');
      setLoadProgress(100);

    } catch (error) {
      console.error('[ModelViewer] ❌ 模型加载失败:', error);
      setError(error instanceof Error ? error.message : '模型加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 清理函数
  const cleanup = () => {
    console.log('[ModelViewer] 🧹 清理Three.js资源...');

    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = null;
    }

    if (controlsRef.current) {
      controlsRef.current.dispose();
      controlsRef.current = null;
    }

    if (rendererRef.current) {
      if (mountRef.current && rendererRef.current.domElement) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current.dispose();
      rendererRef.current = null;
    }

    sceneRef.current = null;
  };

  // 下载模型
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = modelUrl;
    link.download = `${modelName}.${modelFormat}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 切换自动旋转
  const toggleAutoRotate = () => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = !controlsRef.current.autoRotate;
    }
  };

  // 重置视角
  const resetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  // 组件挂载时初始化
  useEffect(() => {
    if (isOpen && mountRef.current) {
      initThreeJS();
      
      return () => {
        cleanup();
      };
    }
  }, [isOpen]);

  // 模型URL变化时重新加载
  useEffect(() => {
    if (isOpen && modelUrl && sceneRef.current) {
      loadModel(modelUrl, modelFormat);
    }
  }, [isOpen, modelUrl, modelFormat]);

  // 窗口大小变化时调整渲染器
  useEffect(() => {
    const handleResize = () => {
      if (mountRef.current && rendererRef.current && sceneRef.current) {
        const width = mountRef.current.clientWidth;
        const height = mountRef.current.clientHeight;
        
        rendererRef.current.setSize(width, height);
        
        // 更新相机
        const camera = sceneRef.current.children.find(child => child instanceof THREE.PerspectiveCamera) as THREE.PerspectiveCamera;
        if (camera) {
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="model-viewer-overlay">
      <div className="model-viewer-container">
        <div className="model-viewer-header">
          <h3>🎲 3D模型预览 - {modelName}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="model-viewer-content">
          <div className="model-viewer-canvas" ref={mountRef}>
            {isLoading && (
              <div className="loading-overlay">
                <div className="loading-content">
                  <div className="loading-spinner"></div>
                  <div className="loading-text">加载中... {loadProgress}%</div>
                  <div className="loading-bar">
                    <div 
                      className="loading-progress" 
                      style={{ width: `${loadProgress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="error-overlay">
                <div className="error-content">
                  <h4>❌ 加载失败</h4>
                  <p>{error}</p>
                  <button 
                    className="retry-btn"
                    onClick={() => loadModel(modelUrl, modelFormat)}
                  >
                    🔄 重试
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="model-viewer-controls">
            <div className="control-group">
              <h4>🎮 视角控制</h4>
              <div className="control-buttons">
                <button onClick={toggleAutoRotate}>
                  🔄 自动旋转
                </button>
                <button onClick={resetCamera}>
                  🎯 重置视角
                </button>
              </div>
            </div>

            <div className="control-group">
              <h4>📥 模型操作</h4>
              <div className="control-buttons">
                <button onClick={handleDownload}>
                  📥 下载模型
                </button>
                {previewUrl && (
                  <button onClick={() => window.open(previewUrl, '_blank')}>
                    🖼️ 查看预览图
                  </button>
                )}
              </div>
            </div>

            <div className="control-group">
              <h4>ℹ️ 模型信息</h4>
              <div className="model-info-panel">
                <p><strong>格式:</strong> {modelFormat.toUpperCase()}</p>
                <p><strong>文件:</strong> {modelName}</p>
              </div>
            </div>

            <div className="usage-tips">
              <h4>💡 使用提示</h4>
              <ul>
                <li>🖱️ 左键拖拽：旋转模型</li>
                <li>🔍 滚轮：缩放视角</li>
                <li>🖱️ 右键拖拽：平移视角</li>
                <li>📱 触屏：单指旋转，双指缩放</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 