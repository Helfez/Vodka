import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as fabric from 'fabric';
import './Whiteboard.css'; // 重新启用CSS
// import Toolbar from './Toolbar'; // 移除Toolbar
import { AIGenerationPanel } from './AIGeneration/AIGenerationPanel';
import { LogViewer } from './LogViewer/LogViewer';
import { Tripo3DPanel } from './Tripo3D/Tripo3DPanel'; // 新增Tripo3D面板
import FloatingMenu from './FloatingMenu/FloatingMenu';
import ImageUploader from './ImageUpload/ImageUploader';
import { ProcessedImage } from './ImageUpload/ImageProcessor';
import { PhotoEffect } from './ImageUpload/PhotoEffect/PhotoEffect';

// Type alias for Fabric.js Canvas instance with custom properties if any
interface FabricCanvas extends fabric.Canvas {
  freeDrawingBrush?: fabric.PencilBrush;
}

// Props for the Whiteboard component
interface WhiteboardProps {
  width?: number;
  height?: number;
  // isDrawingMode?: boolean; // 移除未使用的参数
}

// Whiteboard component: Main component for the drawing canvas
const Whiteboard = ({ 
  width = 900,  // 修复：与CSS容器尺寸匹配
  height = 650, // 修复：与CSS容器尺寸匹配
}: WhiteboardProps) => {
  // Refs for canvas DOM element and Fabric canvas instance
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);

  // State for UI elements and drawing properties
  // const [brushSize, setBrushSize] = useState(5); // 注释掉未使用的变量
  // const [brushColor] = useState('#000000'); // 注释掉未使用的变量
  
  // State for AI generation panel - isAIGenerationOpen might not be needed if panel is fully replaced
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isAIGenerationOpen, setIsAIGenerationOpen] = useState(false); 
  // canvasSnapshot is still useful for analysis/generation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [canvasSnapshot, setCanvasSnapshot] = useState<string>(''); 

  // State for log viewer
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);

  // State for floating menu (right-click upload)
  const [floatingMenuPosition, setFloatingMenuPosition] = useState<{x: number, y: number} | null>(null);
  const [showImageUploader, setShowImageUploader] = useState(false);
  const [isDrawingMode, setIsDrawingMode] = useState(true); // 添加绘图模式状态

  // State for Tripo 3D generation
  const [isTripo3DOpen, setIsTripo3DOpen] = useState(false);
  const [tripo3DSnapshot, setTripo3DSnapshot] = useState<string>('');

  // 🔍 组件渲染监控 - 暂时注释掉避免编译错误
  // console.log('🔄 [Whiteboard] Component RENDER - brushSize:', brushSize, 'timestamp:', Date.now());

  // --- Helper Functions ---
  
  // 移除未使用的createBrush函数 - 现在都用内联创建
  // 移除未使用的recordCanvasState函数 - 现在都用内联记录  
  // 移除未使用的generateCanvasSnapshot函数 - 现在都用内联生成
  // 移除未使用的handleUndo函数 - 现在都用内联处理
  // 移除未使用的manageSelectionRect函数 - 现在都用内联管理

  // 切换绘图/选择模式
  const toggleDrawingMode = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    
    const newDrawingMode = !isDrawingMode;
    setIsDrawingMode(newDrawingMode);
    canvas.isDrawingMode = newDrawingMode;
    
    console.log('🔄 [Whiteboard] Drawing mode:', newDrawingMode ? 'ON' : 'OFF');
    canvas.renderAll();
  }, [isDrawingMode]);

  // --- Callbacks ---

  // Handler for brush size changes - 注释掉未使用的函数
  // const handleBrushSizeChange = useCallback((newSize: number) => {
  //   setBrushSize(newSize);
  // }, []);

  // AI生成面板处理
  const handleOpenAIPanel = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      console.error('[Whiteboard] Canvas not available for AI generation');
      return;
    }

    // 生成画布快照
    const dataURL = canvas.toDataURL({
      format: 'png',
      quality: 0.8,
      multiplier: 1
    });
    
    setCanvasSnapshot(dataURL);
    setIsAIGenerationOpen(true);
  }, []);

  // 处理AI生成的图片
  const handleAIImageGenerated = useCallback((imageDataUrl: string) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      console.error('[Whiteboard] Canvas not available for AI image insertion');
      return;
    }

    const img = new Image();
    img.onload = () => {
      // 计算图片位置（居中放置）
      const canvasCenter = {
        x: canvas.width! / 2,
        y: canvas.height! / 2
      };

      // 计算适当的缩放比例
      const maxSize = Math.min(canvas.width! * 0.6, canvas.height! * 0.6);
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);

      const fabricImage = new fabric.Image(img, {
        left: canvasCenter.x - (img.width * scale) / 2,
        top: canvasCenter.y - (img.height * scale) / 2,
        scaleX: scale,
        scaleY: scale,
        selectable: true,
        hasControls: true,
        evented: true
      });

      canvas.add(fabricImage);
      canvas.renderAll();
    };

    img.onerror = () => {
      console.error('[Whiteboard] Failed to load AI generated image');
      alert('生成的图片加载失败，请重试');
    };

    img.src = imageDataUrl;
  }, []);

  // 处理图片上传
  const handleImageUploaded = useCallback((processedImage: ProcessedImage) => {
    console.log('🖼️ [handleImageUploaded] Processing image:', processedImage);
    
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      console.error('[Whiteboard] Canvas not available for image upload');
      return;
    }

    console.log('🎯 [handleImageUploaded] Canvas found:', canvas);

    const img = new Image();
    
    img.onload = () => {
      console.log('✅ [handleImageUploaded] Image loaded successfully:', img.width, 'x', img.height);
      
      // 计算canvas坐标：如果有右键位置，转换为canvas坐标
      let canvasX = 100;
      let canvasY = 100;
      
      if (floatingMenuPosition && canvasElRef.current) {
        const rect = canvasElRef.current.getBoundingClientRect();
        canvasX = floatingMenuPosition.x - rect.left;
        canvasY = floatingMenuPosition.y - rect.top;
        console.log('📍 [handleImageUploaded] Calculated canvas position:', canvasX, canvasY);
      }

      const fabricImage = new fabric.Image(img, {
        left: canvasX,
        top: canvasY,
        scaleX: 1.0,  // 调整到1.0，显示原始大小
        scaleY: 1.0,  // 调整到1.0，显示原始大小
        selectable: true,
        hasControls: true,
        evented: true
      });

      console.log('🎨 [handleImageUploaded] FabricImage created:', fabricImage);

      try {
        // 先将图片添加到canvas，这样PhotoEffect才能获取到canvas
        console.log('📌 [handleImageUploaded] Adding image to canvas first...');
        canvas.add(fabricImage);
        console.log('✅ [handleImageUploaded] Image added to canvas');
        
        // 然后应用拍立得特效
        console.log('✨ [handleImageUploaded] Applying PhotoEffect...');
        PhotoEffect.applyPhotoEffect(fabricImage);
        
        // 重新启用图片交互性，允许拖拽和缩放
        fabricImage.set({
          selectable: true,
          hasControls: true,
          evented: true
        });
        
        console.log('✅ [handleImageUploaded] PhotoEffect applied and interactivity restored');
        
        canvas.renderAll();
        console.log('🖌️ [handleImageUploaded] Canvas rendered');
        
        // 检查canvas中的对象数量
        console.log('📊 [handleImageUploaded] Canvas objects count:', canvas.getObjects().length);
        
      } catch (error) {
        console.error('❌ [handleImageUploaded] PhotoEffect error:', error);
        
        // 如果PhotoEffect失败，确保图片至少被添加了
        console.log('🔄 [handleImageUploaded] Fallback: ensuring image is in canvas');
        if (canvas.getObjects().indexOf(fabricImage) === -1) {
          canvas.add(fabricImage);
        }
        canvas.renderAll();
      }
    };

    img.onerror = (error) => {
      console.error('❌ [handleImageUploaded] Image load failed:', error);
      console.error('❌ [handleImageUploaded] Failed dataUrl:', processedImage.dataUrl.substring(0, 100) + '...');
    };

    console.log('📥 [handleImageUploaded] Setting image src...');
    img.src = processedImage.dataUrl;
    
    setFloatingMenuPosition(null); // 关闭菜单
    setShowImageUploader(false); // 关闭上传器
  }, [floatingMenuPosition]);

  // 处理便签创建
  const handleStickyNoteCreated = useCallback(() => {
    console.log('📝 [handleStickyNoteCreated] Creating sticky note...');
    
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      console.error('[Whiteboard] Canvas not available for sticky note creation');
      return;
    }

    // 计算canvas坐标
    let canvasX = 100;
    let canvasY = 100;
    
    if (floatingMenuPosition && canvasElRef.current) {
      const rect = canvasElRef.current.getBoundingClientRect();
      canvasX = floatingMenuPosition.x - rect.left;
      canvasY = floatingMenuPosition.y - rect.top;
    }

    // 创建手账风格的便签背景
    const stickyBg = new fabric.Rect({
      left: canvasX,
      top: canvasY,
      width: 180,
      height: 180,
      fill: '#FFE082', // 温暖的黄色便签色
      stroke: '#FFC107',
      strokeWidth: 1,
      rx: 3, // 小圆角，更像真实便签
      ry: 3,
      shadow: new fabric.Shadow({
        color: 'rgba(255, 193, 7, 0.3)',
        blur: 8,
        offsetX: 2,
        offsetY: 3
      }),
      selectable: false, // 背景不可选择
      evented: false,    // 背景不响应事件
      excludeFromExport: false
    });

    // 添加便签纸的装饰线条（模拟便签纸的边距线）
    const marginLine = new fabric.Line([canvasX + 25, canvasY + 15, canvasX + 25, canvasY + 165], {
      stroke: '#FFB74D',
      strokeWidth: 1,
      selectable: false,
      evented: false,
      opacity: 0.6
    });

    // 创建可编辑文本，作为独立对象
    const stickyText = new fabric.IText('点击输入文字...', {
      left: canvasX + 40,
      top: canvasY + 30,
      fontFamily: 'Microsoft YaHei, PingFang SC, Hiragino Sans GB, sans-serif',
      fontSize: 14,
      fill: '#5D4037', // 深棕色文字，像笔迹
      fontWeight: 'normal',
      lineHeight: 1.4,
      textAlign: 'left',
      width: 120,
      selectable: true,
      editable: true,
      hasControls: true,
      hasBorders: true,
      borderColor: '#FFC107',
      cornerColor: '#FFB74D',
      cornerSize: 6,
      transparentCorners: false
    });

    // 创建一个自定义组合，让背景跟随文字移动
    const createStickyGroup = () => {
      // 先移除旧的组件（如果存在）
      canvas.remove(stickyBg);
      canvas.remove(marginLine);
      canvas.remove(stickyText);
      
      // 重新计算位置
      const textLeft = stickyText.left || 0;
      const textTop = stickyText.top || 0;
      
      stickyBg.set({
        left: textLeft - 40,
        top: textTop - 30
      });
      
      marginLine.set({
        x1: textLeft - 15,
        y1: textTop - 15,
        x2: textLeft - 15,
        y2: textTop + 135
      });
      
      // 重新添加到画布
      canvas.add(stickyBg);
      canvas.add(marginLine);
      canvas.add(stickyText);
      canvas.renderAll();
    };

    // 监听文字移动事件，让背景跟随
    stickyText.on('moving', createStickyGroup);
    stickyText.on('modified', createStickyGroup);

    // 添加到画布
    canvas.add(stickyBg);
    canvas.add(marginLine);
    canvas.add(stickyText);
    
    // 设置文字为活动对象，方便编辑
    canvas.setActiveObject(stickyText);
    canvas.renderAll();
    
    console.log('✅ [handleStickyNoteCreated] Hand-journal style sticky note created');
    
    setFloatingMenuPosition(null); // 关闭菜单
  }, [floatingMenuPosition]);

  // 处理3D生成
  const handle3DGenerate = useCallback(() => {
    console.log('🎲 [handle3DGenerate] Generating 3D model from canvas...');
    
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      console.error('[Whiteboard] Canvas not available for 3D generation');
      return;
    }

    // 生成画布快照
    const dataURL = canvas.toDataURL({
      format: 'png',
      quality: 0.8,
      multiplier: 1
    });
    
    setTripo3DSnapshot(dataURL);
    setIsTripo3DOpen(true);
    setFloatingMenuPosition(null); // 关闭菜单
    
    console.log('✅ [handle3DGenerate] Canvas snapshot created, opening 3D panel');
  }, []);

  // 处理3D模型生成完成
  const handle3DModelGenerated = useCallback((modelUrl: string, format: string) => {
    console.log('🎉 [handle3DModelGenerated] 3D model generated:', modelUrl, format);
    // 这里可以添加后续处理，比如将模型添加到画布或显示预览
  }, []);

  // --- Effects ---

  // Effect for initializing and managing the Fabric canvas instance
  useEffect(() => {
    console.log('🚀 [Whiteboard] Initializing canvas with dimensions:', width, 'x', height);
    
    if (!canvasElRef.current) {
      console.error('[Whiteboard] Canvas element not found');
      return;
    }

    // 复制canvasElRef.current到局部变量，避免在cleanup中访问可能已变化的ref
    const canvasElement = canvasElRef.current;

    // 如果已存在canvas实例，先清理
    if (fabricCanvasRef.current) {
      console.log('🧹 [Whiteboard] Disposing existing canvas instance');
      fabricCanvasRef.current.dispose();
      fabricCanvasRef.current = null;
    }

    // 创建新的 Fabric.js 画布实例 - 最简配置
    const canvasInstance = new fabric.Canvas(canvasElement, {
        width,
        height,
      backgroundColor: '#fefcf8',
        isDrawingMode: true, // 直接启用绘图模式
        stopContextMenu: true, // 阻止原生右键菜单
        fireRightClick: true,  // 启用右键事件
      }) as FabricCanvas;

    // 🔧 强制设置DOM canvas元素尺寸，确保与Fabric实例匹配
    canvasElement.width = width;
    canvasElement.height = height;
    canvasElement.style.width = width + 'px';
    canvasElement.style.height = height + 'px';
    console.log('🔧 [Whiteboard] Forced DOM canvas size to match Fabric:', width, 'x', height);

    // 设置画笔 - 最简配置
    const brush = new fabric.PencilBrush(canvasInstance);
    brush.width = 5;
    brush.color = '#000000';
    canvasInstance.freeDrawingBrush = brush;
    
    // 使用fabric.js的事件系统处理右键点击
    const rightClickHandler = (opt: any) => {
      if (opt.e instanceof MouseEvent && opt.e.button === 2) {
        opt.e.preventDefault();
        // 使用页面绝对坐标，因为FloatingMenu使用position: fixed
        setFloatingMenuPosition({
          x: opt.e.clientX,
          y: opt.e.clientY
        });
        console.log('🖱️ Right click at page position:', opt.e.clientX, opt.e.clientY);
      }
    };
    
    // 添加fabric事件监听器
    canvasInstance.on('mouse:down', rightClickHandler);
    
    // 额外确保阻止DOM的contextmenu事件
    const domContextMenuHandler = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    canvasElement.addEventListener('contextmenu', domContextMenuHandler, { capture: true });

    // 🔧 移除所有事件监听器，只保留基本功能
    console.log('✅ [Whiteboard] Minimal canvas setup completed');

    fabricCanvasRef.current = canvasInstance;
    
    // 简化的清理函数
    return () => {
      console.log('🧹 [Whiteboard] Cleaning up canvas');
      canvasElement.removeEventListener('contextmenu', domContextMenuHandler);
      canvasInstance.off('mouse:down', rightClickHandler);
      if (canvasInstance && fabricCanvasRef.current === canvasInstance) {
        canvasInstance.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, [width, height]);

  return (
    <div className="whiteboard-wrapper">
      {/* <Toolbar /> */}
      
      <div className="ai-generation-trigger">
        <button
          className="ai-generation-btn"
          onClick={handleOpenAIPanel}
          title="AI分析画板并自动生成图片"
          disabled={isAIGenerationOpen}
        >
          {isAIGenerationOpen ? '🎨 生成中...' : '🎨 生图'}
        </button>
        <button 
          className="log-viewer-button"
          onClick={() => setIsLogViewerOpen(true)}
          title="查看系统日志"
        >
          📊 日志
        </button>
        <button 
          className={`ai-generation-btn ${!isDrawingMode ? 'active' : ''}`}
          onClick={toggleDrawingMode}
          title={isDrawingMode ? "切换到选择模式（可拖拽图片）" : "切换到绘图模式"}
        >
          {isDrawingMode ? '✏️ 绘图' : '👆 选择'}
        </button>
      </div>

      <div className="whiteboard-main-content">
        <div className="whiteboard-container">
          <div className="canvas-wrapper">
            <canvas ref={canvasElRef} />
          </div>
        </div>
      </div>

      {/* AI生成面板 */}
      <AIGenerationPanel
        isOpen={isAIGenerationOpen} 
        onClose={() => setIsAIGenerationOpen(false)}
        canvasSnapshot={canvasSnapshot}
        onImageGenerated={handleAIImageGenerated}
      />

      {/* 日志查看器 */}
      <LogViewer
        isOpen={isLogViewerOpen}
        onClose={() => setIsLogViewerOpen(false)}
      />

      {/* 右键浮动菜单 */}
      {floatingMenuPosition && (
        <FloatingMenu
          position={floatingMenuPosition}
          onUploadClick={() => {
            console.log('🔄 FloatingMenu upload clicked');
            setShowImageUploader(true);
          }}
          onStickyNoteClick={() => {
            console.log('📝 FloatingMenu sticky note clicked');
            handleStickyNoteCreated();
          }}
          on3DGenerateClick={() => {
            console.log('🎲 FloatingMenu 3D generate clicked');
            handle3DGenerate();
          }}
          onClose={() => setFloatingMenuPosition(null)}
        />
      )}

      {/* Tripo 3D生成面板 */}
      <Tripo3DPanel
        isOpen={isTripo3DOpen}
        onClose={() => setIsTripo3DOpen(false)}
        canvasSnapshot={tripo3DSnapshot}
        onModelGenerated={handle3DModelGenerated}
      />

      {/* 图片上传器 */}
      {showImageUploader && (
        <ImageUploader onImageProcessed={handleImageUploaded}>
          {(triggerUpload) => {
            // 自动触发上传
            console.log('📁 ImageUploader rendered, auto-triggering upload');
            setTimeout(() => triggerUpload(), 100);
            return <div style={{ display: 'none' }} />;
          }}
        </ImageUploader>
      )}
    </div>
  );
};

export default Whiteboard;
