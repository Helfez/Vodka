import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as fabric from 'fabric';
import './Whiteboard.css';
import Toolbar from './Toolbar';
import UndoButton from './UndoButton';
import FloatingMenu from './FloatingMenu/FloatingMenu';
import ImageUploader from './ImageUpload/ImageUploader';
import { ProcessedImage } from './ImageUpload/ImageProcessor';
import { PhotoEffect } from './ImageUpload/PhotoEffect/PhotoEffect';
import { FloatingButton } from './ImageSticker/components/FloatingButton';
import { FloatingButtonPosition } from './ImageSticker/services/types';
import { LogViewer } from './LogViewer/LogViewer';
import { AIGenerationPanel } from './AIGeneration/AIGenerationPanel';

// Type alias for Fabric.js Canvas instance with custom properties if any
// (Currently, freeDrawingBrush is a standard property but explicitly typed for clarity)
interface FabricCanvas extends fabric.Canvas {
  freeDrawingBrush?: fabric.PencilBrush;
}

// Interface for storing a snapshot of the canvas state for history
interface DrawingState {
  canvasState: string; // JSON string representation of canvas objects
  timestamp: number;   // Timestamp of when the state was saved
}

// Props for the Whiteboard component
interface WhiteboardProps {
  width?: number;
  height?: number;
  isDrawingMode?: boolean;
}

// Whiteboard component: Main component for the drawing canvas
const Whiteboard = ({ 
  width = 800, 
  height = 600, 
  isDrawingMode: initialIsDrawingMode = true // Renamed prop to avoid conflict with canvas property
}: WhiteboardProps) => {
  console.log('[Whiteboard] Component rendered/re-rendered');

  // Refs for canvas DOM element and Fabric canvas instance
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);

  // State for UI elements and drawing properties
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null);
  const [brushSize, setBrushSize] = useState(5);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [brushColor, setBrushColor] = useState('#000000');
  const [history, setHistory] = useState<DrawingState[]>([]);
  
  // State for sticker button visibility and position
  const [stickerButtonPosition, setStickerButtonPosition] = useState<FloatingButtonPosition | null>(null);

  // State for AI generation panel - isAIGenerationOpen might not be needed if panel is fully replaced
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isAIGenerationOpen, setIsAIGenerationOpen] = useState(false); 
  // canvasSnapshot is still useful for analysis/generation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [canvasSnapshot, setCanvasSnapshot] = useState<string>(''); 

  // State for log viewer
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);

  // 配置画笔函数 - 移到组件内部使用useCallback
  const configureBrush = useCallback((canvas: FabricCanvas, size: number, color: string) => {
    console.log('[Whiteboard configureBrush] Configuring brush with size:', size);
    const brush = new fabric.PencilBrush(canvas);
    brush.width = size;
    brush.color = color;
    
    // 添加贝塞尔曲线平滑
    (brush as any).decimate = 8;         // 采样点间隔
    (brush as any).controlPointsNum = 2; // 控制点数量
    return brush;
  }, []);

  // --- Callbacks --- 

  // 处理AI生成的图片
  const handleAIImageGenerated = useCallback((imageUrl: string) => {
    console.log('[Whiteboard handleAIImageGenerated] === AI图片集成开始 ===');
    console.log('[Whiteboard handleAIImageGenerated] 📥 接收到图片URL:', imageUrl.substring(0, 50) + '...');
    
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      console.error('[Whiteboard handleAIImageGenerated] ❌ Canvas不可用，无法添加图片');
      return;
    }

    // 保存当前画布状态
    const currentDrawingMode = canvas.isDrawingMode;
    const currentBrush = canvas.freeDrawingBrush;
    console.log('[Whiteboard handleAIImageGenerated] 💾 保存画布状态:', { drawingMode: currentDrawingMode, brushWidth: currentBrush?.width });

    console.log('[Whiteboard handleAIImageGenerated] 🖼️ 开始加载图片...');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    const loadStartTime = performance.now();
    
    img.onload = () => {
      const loadEndTime = performance.now();
      console.log('[Whiteboard handleAIImageGenerated] ✅ 图片加载完成:');
      console.log('  - 加载耗时:', Math.round(loadEndTime - loadStartTime), 'ms');
      console.log('  - 图片尺寸:', img.width, 'x', img.height);
      
      try {
        console.log('[Whiteboard handleAIImageGenerated] 🎯 计算图片位置...');
        const canvasCenter = {
          x: canvas.getWidth() / 2,
          y: canvas.getHeight() / 2
        };
        const imagePosition = {
          x: clickPosition?.x || canvasCenter.x - img.width / 4,
          y: clickPosition?.y || canvasCenter.y - img.height / 4
        };
        
        console.log('[Whiteboard handleAIImageGenerated] 📍 图片位置信息:');
        console.log('  - 画布中心:', canvasCenter);
        console.log('  - 图片位置:', imagePosition);
        console.log('  - 缩放比例: 0.5');

        const fabricImage = new fabric.Image(img, {
          left: imagePosition.x,
          top: imagePosition.y,
          scaleX: 0.5,
          scaleY: 0.5,
          selectable: true,
          hasControls: true,
          evented: true
        });

        console.log('[Whiteboard handleAIImageGenerated] ➕ 添加图片到画布...');
        canvas.add(fabricImage);
        canvas.setActiveObject(fabricImage);
        
        // 恢复画布绘图状态
        console.log('[Whiteboard handleAIImageGenerated] 🖌️ 恢复画布绘图状态...');
        canvas.isDrawingMode = currentDrawingMode;
        canvas.freeDrawingBrush = currentBrush || configureBrush(canvas, brushSize, brushColor);
        canvas.renderAll();

        console.log('[Whiteboard handleAIImageGenerated] 💾 记录历史状态...');
        requestAnimationFrame(() => {
          // 内联recordState逻辑，避免函数依赖
          const currentCanvas = fabricCanvasRef.current;
          if (!currentCanvas) {
            console.warn('[Whiteboard handleAIImageGenerated recordState] Canvas ref is null, cannot record state.');
            return;
          }
          console.log('[Whiteboard handleAIImageGenerated recordState] Recording state. Objects:', currentCanvas.getObjects().length);
          const currentState: DrawingState = {
            canvasState: JSON.stringify(currentCanvas.toJSON()),
            timestamp: Date.now()
          };
          setHistory(prev => {
            const newHistory = [...prev, currentState].slice(-20); 
            return newHistory;
          });
        });

        console.log('[Whiteboard handleAIImageGenerated] ✅ AI图片集成完成');
      } catch (error) {
        console.error('[Whiteboard handleAIImageGenerated] ❌ 图片添加到画布失败:', error);
        // 即使出错也要恢复画布状态
        canvas.isDrawingMode = currentDrawingMode;
        canvas.freeDrawingBrush = currentBrush || configureBrush(canvas, brushSize, brushColor);
        canvas.renderAll();
      }
    };

    img.onerror = (errorEvent) => {
      console.error('[Whiteboard handleAIImageGenerated] ❌ 图片加载失败:', errorEvent);
      // 恢复画布状态即使在错误情况下
      canvas.isDrawingMode = currentDrawingMode;
      canvas.freeDrawingBrush = currentBrush || configureBrush(canvas, brushSize, brushColor);
    };

    img.src = imageUrl;
  }, [clickPosition, brushSize, brushColor, configureBrush]); // 移除recordState依赖

  // --- Effects --- 

  // Effect for initializing and managing the Fabric canvas instance
  useEffect(() => {
    console.log('[Whiteboard CanvasLifecycle useEffect] Running. Deps:', { width, height, initialIsDrawingMode });

    if (!canvasElRef.current) {
      console.warn('[Whiteboard CanvasLifecycle useEffect] canvasElRef is null. Bailing out.');
      return;
    }

    let canvasInstance = fabricCanvasRef.current;

    if (!canvasInstance || canvasInstance.getWidth() !== width || canvasInstance.getHeight() !== height) {
      if (canvasInstance) {
        console.log('[Whiteboard CanvasLifecycle useEffect] Disposing existing canvas.');
        canvasInstance.dispose(); 
      }
      console.log('[Whiteboard CanvasLifecycle useEffect] Creating new Fabric canvas.');
      canvasInstance = new fabric.Canvas(canvasElRef.current, {
        width,
        height,
        backgroundColor: '#ffffff', 
        isDrawingMode: initialIsDrawingMode, 
      }) as FabricCanvas;
      fabricCanvasRef.current = canvasInstance; 
      console.log('[Whiteboard CanvasLifecycle useEffect] New canvas created.');
    } else {
      console.log('[Whiteboard CanvasLifecycle useEffect] Using existing canvas.');
    }

    console.log('[Whiteboard CanvasLifecycle useEffect] Applying properties. DrawingMode:', initialIsDrawingMode);
    canvasInstance.isDrawingMode = initialIsDrawingMode;
    // 初始画笔设置 - 使用内联创建避免依赖问题
    const initialBrush = new fabric.PencilBrush(canvasInstance);
    initialBrush.width = 5;
    initialBrush.color = '#000000';
    (initialBrush as any).decimate = 8;
    (initialBrush as any).controlPointsNum = 2;
    canvasInstance.freeDrawingBrush = initialBrush;
    canvasInstance.renderOnAddRemove = true; 
    canvasInstance.preserveObjectStacking = true;

    const handleMouseDownLocal = (e: fabric.TEvent) => { 
      console.log('[Whiteboard mouse:down] Event:', e);
      if (fabricCanvasRef.current?.isDrawingMode) {
        setStickerButtonPosition(null); 
      }
    };

    const handlePathCreatedLocal = (e: fabric.TEvent & { path: fabric.Path }) => { 
      console.log('[Whiteboard path:created] Path created:', e.path);
      // 使用内联函数避免依赖recordState导致useEffect频繁重新执行
      requestAnimationFrame(() => {
        const currentCanvas = fabricCanvasRef.current;
        if (!currentCanvas) {
          console.warn('[Whiteboard path:created recordState] Canvas ref is null, cannot record state.');
          return;
        }
        console.log('[Whiteboard path:created recordState] Recording state. Objects:', currentCanvas.getObjects().length);
        const currentState: DrawingState = {
          canvasState: JSON.stringify(currentCanvas.toJSON()),
          timestamp: Date.now()
        };
        setHistory(prev => {
          const newHistory = [...prev, currentState].slice(-20); 
          return newHistory;
        });
      });
    };

    const handleMouseUpLocal = (e: fabric.TEvent) => { 
      console.log('[Whiteboard mouse:up] Event:', e);
    };

    const handleKeyboardLocal = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault(); 
        // 使用内联函数调用undo逻辑
        const currentCanvas = fabricCanvasRef.current;
        if (!currentCanvas) {
          console.warn('[Whiteboard handleUndo] Canvas ref is null, cannot undo.');
          return;
        }

        setHistory(prevHistory => {
          console.log('[Whiteboard handleUndo] Attempting undo. History length:', prevHistory.length);
          if (prevHistory.length <= 1) { 
            console.log('[Whiteboard handleUndo] No more states to undo or only initial state left.');
            return prevHistory; 
          }

          try {
            const prevState = prevHistory[prevHistory.length - 2]; 
            console.log('[Whiteboard handleUndo] Reverting to state from timestamp:', prevState.timestamp);
            currentCanvas.loadFromJSON(JSON.parse(prevState.canvasState), () => {
              console.log('[Whiteboard handleUndo] 🖌️ 恢复画布绘图状态...');
              currentCanvas.isDrawingMode = initialIsDrawingMode; 
              // 恢复画笔设置
              const brush = new fabric.PencilBrush(currentCanvas);
              brush.width = brushSize;
              brush.color = brushColor;
              (brush as any).decimate = 8;
              (brush as any).controlPointsNum = 2;
              currentCanvas.freeDrawingBrush = brush;
              currentCanvas.renderAll();
              console.log('[Whiteboard handleUndo] ✅ Canvas loaded from previous state with drawing mode restored.');
            });
            return prevHistory.slice(0, -1); 
          } catch (error) {
            console.error('[Whiteboard handleUndo] Failed to undo:', error);
            return prevHistory; 
          }
        });
      }
      // Ctrl/Cmd + G for the new direct image generation flow
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        // 内联调用直接生图逻辑
        console.log('[Whiteboard handleDirectImageGeneration] === Opening AI Generation Panel ===');
        
        // 获取画布快照
        const canvas = fabricCanvasRef.current;
        if (!canvas) {
          console.error('[Whiteboard getCanvasSnapshotDataURL] ❌ Canvas is not available.');
          return;
        }
        try {
          const dataURL = canvas.toDataURL({
            format: 'png',
            quality: 0.8,
            multiplier: 1,
          });
          console.log('[Whiteboard getCanvasSnapshotDataURL] ✅ Snapshot generated successfully.');
          // Auto-download PNG
          const link = document.createElement('a');
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          link.href = dataURL;
          link.download = `whiteboard-snapshot-${timestamp}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          console.log('[Whiteboard getCanvasSnapshotDataURL] 💾 Snapshot auto-downloaded.');
          setCanvasSnapshot(dataURL);
          setIsAIGenerationOpen(true);
        } catch (error) {
          console.error('[Whiteboard getCanvasSnapshotDataURL] ❌ Failed to generate snapshot:', error);
          alert('无法获取画板快照，请重试');
        }
      }
    };

    console.log('[Whiteboard CanvasLifecycle useEffect] Attaching event listeners.');
    canvasInstance.on('mouse:down', handleMouseDownLocal);
    canvasInstance.on('path:created', handlePathCreatedLocal);
    canvasInstance.on('mouse:up', handleMouseUpLocal);
    window.addEventListener('keydown', handleKeyboardLocal);

    return () => {
      console.log('[Whiteboard CanvasLifecycle useEffect Cleanup] Cleaning up listeners.');
      window.removeEventListener('keydown', handleKeyboardLocal);
      if (canvasInstance && fabricCanvasRef.current === canvasInstance) {
        console.log('[Whiteboard CanvasLifecycle useEffect Cleanup] Detaching listeners.');
        canvasInstance.off('mouse:down', handleMouseDownLocal);
        canvasInstance.off('path:created', handlePathCreatedLocal);
        canvasInstance.off('mouse:up', handleMouseUpLocal);
      }
    };
  }, [width, height, initialIsDrawingMode]); // 只保留真正需要的依赖，移除recordState等函数依赖

  // 单独的Effect来处理画笔属性更新，避免重新创建画布
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (canvas) {
      console.log('[Whiteboard BrushUpdate useEffect] Updating brush properties:', { brushSize, brushColor });
      // 确保画笔存在，如果不存在则创建
      if (!canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush = configureBrush(canvas, brushSize, brushColor);
      } else {
        canvas.freeDrawingBrush.width = brushSize;
        canvas.freeDrawingBrush.color = brushColor;
      }
    }
  }, [brushSize, brushColor, configureBrush]);

  // Effect for setting the initial history
  useEffect(() => {
    if (fabricCanvasRef.current && history.length === 0) {
      console.log('[Whiteboard InitialHistory useEffect] Setting initial history state.');
      const initialState: DrawingState = {
        canvasState: JSON.stringify(fabricCanvasRef.current.toJSON()), 
        timestamp: Date.now()
      };
      setHistory([initialState]); 
      console.log('[Whiteboard InitialHistory useEffect] Initial history state set.');
    }
  }, [fabricCanvasRef, history.length]); 

  // Effect for component unmount
  useEffect(() => {
    return () => {
      if (fabricCanvasRef.current) {
        console.log('[Whiteboard Unmount Cleanup] Disposing canvas on component unmount.');
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, []); 

  // Handler for context menu (right-click)
  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    console.log('[Whiteboard handleContextMenu] === 右键菜单事件触发 ===');
    console.log('[Whiteboard handleContextMenu] 事件类型:', event.type);
    console.log('[Whiteboard handleContextMenu] 鼠标位置:', event.clientX, event.clientY);
    console.log('[Whiteboard handleContextMenu] 当前target:', event.currentTarget);
    
    event.preventDefault();
    event.stopPropagation();
    
    if (!fabricCanvasRef.current) {
      console.warn('[Whiteboard handleContextMenu] ❌ Canvas不可用');
      return;
    }
    
    const canvas = fabricCanvasRef.current;
    console.log('[Whiteboard handleContextMenu] ✅ Canvas状态:', {
      width: canvas.getWidth(),
      height: canvas.getHeight(),
      isDrawingMode: canvas.isDrawingMode,
      objectsCount: canvas.getObjects().length
    });
    
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    console.log('[Whiteboard handleContextMenu] 相对位置计算:');
    console.log('  - 容器边界:', rect);
    console.log('  - 画布内相对位置:', x, y);
    
    const pointer = canvas.getPointer(event.nativeEvent);
    console.log('[Whiteboard handleContextMenu] Fabric指针位置:', pointer);
    
    const objects = canvas.getObjects();
    const clickedImage = objects.find(obj => 
      obj instanceof fabric.Image && 
      obj.containsPoint(pointer)
    ) as fabric.Image | undefined;

    if (clickedImage) {
      console.log('[Whiteboard handleContextMenu] 🖼️ 点击到图片，显示贴纸按钮');
      console.log('[Whiteboard handleContextMenu] 图片信息:', {
        left: clickedImage.left,
        top: clickedImage.top,
        width: clickedImage.width,
        height: clickedImage.height
      });
      
      const bounds = clickedImage.getBoundingRect();
      
      const existingSelection = objects.find(obj => 
        obj instanceof fabric.Rect && 
        (obj as any).data?.type === 'selection-rect'
      );
      if (existingSelection) {
        canvas.remove(existingSelection);
      }
      
      const selectionRect = new fabric.Rect({
        left: bounds.left - 2,
        top: bounds.top - 2,
        width: bounds.width + 4,
        height: bounds.height + 4,
        fill: 'transparent',
        stroke: '#2196F3',
        strokeWidth: 2,
        selectable: false,
        evented: false,
        data: { type: 'selection-rect' }
      });
      
      canvas.add(selectionRect);
      canvas.renderAll();

      setStickerButtonPosition({
        x: bounds.left + bounds.width / 2,
        y: bounds.top - 20,
        target: clickedImage
      });
      
      console.log('[Whiteboard handleContextMenu] 贴纸按钮位置设置完成');
    } else {
      console.log('[Whiteboard handleContextMenu] 📋 点击空白区域，显示上传菜单');
      const existingSelection = objects.find(obj => 
        obj instanceof fabric.Rect && 
        (obj as any).data?.type === 'selection-rect'
      );
      if (existingSelection) {
        canvas.remove(existingSelection);
        canvas.renderAll();
      }

      console.log('[Whiteboard handleContextMenu] 设置菜单位置:', { x: event.clientX, y: event.clientY });
      console.log('[Whiteboard handleContextMenu] 设置点击位置:', { x, y });
      
      setMenuPosition({ x: event.clientX, y: event.clientY });
      setClickPosition({ x, y });
      setStickerButtonPosition(null);
      
      console.log('[Whiteboard handleContextMenu] 菜单状态设置完成');
    }
    
    console.log('[Whiteboard handleContextMenu] === 右键菜单事件处理完成 ===');
  }, []);

  // 处理贴纸转换
  const handleStickerConvert = useCallback(() => {
    console.log('[Whiteboard handleStickerConvert] Sticker convert called.');
    if (!stickerButtonPosition) return;
    console.log('[Whiteboard handleStickerConvert] 开始转换贴纸...');
    // Logic is in FloatingButton
  }, [stickerButtonPosition]);

  // 处理图片上传
  const handleImageProcessed = useCallback(async (processedImage: ProcessedImage) => {
    console.log('[Whiteboard handleImageProcessed] === 图片上传处理开始 ===');
    console.log('  - 尺寸:', processedImage.width, 'x', processedImage.height);
    
    if (!fabricCanvasRef.current || !clickPosition) {
        console.error('[Whiteboard handleImageProcessed] ❌ Canvas或点击位置不可用');
        return;
    }

    const canvas = fabricCanvasRef.current;
    console.log('[Whiteboard handleImageProcessed] 📍 放置位置:', clickPosition);
    
    // 保存当前画布状态 - 在图片处理开始前保存
    const currentDrawingMode = canvas.isDrawingMode;
    const currentBrush = canvas.freeDrawingBrush;
    console.log('[Whiteboard handleImageProcessed] 💾 保存画布状态:', { drawingMode: currentDrawingMode, brushWidth: currentBrush?.width });
    
    const img = new Image();
    const loadStartTime = performance.now();
    
    img.onload = () => {
      const loadEndTime = performance.now();
      console.log('[Whiteboard handleImageProcessed] ✅ 图片加载完成，耗时:', Math.round(loadEndTime - loadStartTime), 'ms');
      
      // 计算图片缩放比例，确保图片不会太大
      const maxSize = 250;
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
      
      const imagePosition = {
        x: clickPosition.x - (img.width * scale) / 2,
        y: clickPosition.y - (img.height * scale) / 2
      };
      
      const fabricImage = new fabric.Image(img, {
        left: imagePosition.x,
        top: imagePosition.y,
        scaleX: scale,
        scaleY: scale,
        selectable: false,  // PhotoEffect会处理可选择性
        hasControls: false, // PhotoEffect会处理控制点
        evented: false      // PhotoEffect会处理事件
      });

      try {
        console.log('[Whiteboard handleImageProcessed] ✨ 应用拍立得照片效果...');
        
        // 注意：PhotoEffect.applyPhotoEffect会自动添加图片到画布，所以我们不需要单独添加
        PhotoEffect.applyPhotoEffect(fabricImage, {
          animation: {
            initial: { scale: 0.7, opacity: 0, rotation: -15 },
            final: { scale: 1, opacity: 1, rotation: PhotoEffect.getRandomRotation() },
            duration: 1400,
            easing: 'easeOutBack'
          }
        });

        // 动画完成后设置为可交互并恢复画布状态
        setTimeout(() => {
          console.log('[Whiteboard handleImageProcessed] 🔧 设置图片为可交互状态...');
          fabricImage.set({ 
            selectable: true, 
            hasControls: true, 
            evented: true 
          });
          
          // 添加选中事件监听
          fabricImage.on('selected', () => {
            console.log('[Whiteboard handleImageProcessed] 🎯 图片被选中');
            const bounds = fabricImage.getBoundingRect();
            setStickerButtonPosition({
              x: bounds.left + bounds.width / 2,
              y: bounds.top - 20,
              target: fabricImage
            });
          });

          fabricImage.on('deselected', () => {
            console.log('[Whiteboard handleImageProcessed] ⭕ 图片取消选中');
            setStickerButtonPosition(null);
          });
          
          // 恢复画布绘图状态 - 只在动画完成后恢复一次
          console.log('[Whiteboard handleImageProcessed] 🖌️ 恢复画布绘图状态...');
          canvas.isDrawingMode = currentDrawingMode;
          canvas.freeDrawingBrush = currentBrush || configureBrush(canvas, brushSize, brushColor);
          canvas.renderAll();
          
          console.log('[Whiteboard handleImageProcessed] ✅ 画布状态恢复完成:', { 
            drawingMode: canvas.isDrawingMode, 
            brushWidth: canvas.freeDrawingBrush?.width 
          });
          
          // 记录历史状态
          // 内联recordState逻辑，避免函数依赖
          const currentCanvas = fabricCanvasRef.current;
          if (currentCanvas) {
            console.log('[Whiteboard handleImageProcessed recordState] Recording state. Objects:', currentCanvas.getObjects().length);
            const currentState: DrawingState = {
              canvasState: JSON.stringify(currentCanvas.toJSON()),
              timestamp: Date.now()
            };
            setHistory(prev => {
              const newHistory = [...prev, currentState].slice(-20); 
              return newHistory;
            });
          }
        }, 1500); // 稍微延长等待时间确保动画完成

      } catch (error: any) {
        console.error('[Whiteboard handleImageProcessed] ❌ 照片效果应用失败:', error);
        // fallback: 简单添加图片并立即恢复状态
        canvas.add(fabricImage);
        fabricImage.set({ selectable: true, hasControls: true, evented: true });
        
        // 立即恢复画笔状态
        console.log('[Whiteboard handleImageProcessed] 🖌️ Fallback: 恢复画笔状态...');
        canvas.isDrawingMode = currentDrawingMode;
        canvas.freeDrawingBrush = currentBrush || configureBrush(canvas, brushSize, brushColor);
        canvas.renderAll();
        
        // 内联recordState逻辑，避免函数依赖
        const currentCanvas = fabricCanvasRef.current;
        if (currentCanvas) {
          console.log('[Whiteboard handleImageProcessed fallback recordState] Recording state. Objects:', currentCanvas.getObjects().length);
          const currentState: DrawingState = {
            canvasState: JSON.stringify(currentCanvas.toJSON()),
            timestamp: Date.now()
          };
          setHistory(prev => {
            const newHistory = [...prev, currentState].slice(-20); 
            return newHistory;
          });
        }
      }

      setMenuPosition(null);
      setClickPosition(null);
      console.log('[Whiteboard handleImageProcessed] === 图片上传处理完成 ===');
    };

    img.onerror = () => {
      console.error('[Whiteboard handleImageProcessed] ❌ 图片加载失败');
      // 恢复画布状态即使在错误情况下
      canvas.isDrawingMode = currentDrawingMode;
      canvas.freeDrawingBrush = currentBrush || configureBrush(canvas, brushSize, brushColor);
      alert('图片加载失败，请重试');
    };

    img.src = processedImage.dataUrl;
  }, [clickPosition, setStickerButtonPosition, brushSize, brushColor, configureBrush]); // 移除recordState依赖

  return (
    <div className="whiteboard-wrapper">
      <Toolbar 
        brushSize={brushSize}
        onBrushSizeChange={(newSize: number) => {
          console.log('[Whiteboard handleBrushSizeChange] New size:', newSize);
          setBrushSize(newSize);
          const canvas = fabricCanvasRef.current;
          if (canvas?.freeDrawingBrush) {
            canvas.freeDrawingBrush.width = newSize;
          }
        }}
      />
      
      <div className="ai-generation-trigger">
        <button
          className="ai-generation-btn"
          onClick={() => {
            console.log('[Whiteboard DirectImageGeneration Button] === Opening AI Generation Panel ===');
            
            // 获取画布快照
            const canvas = fabricCanvasRef.current;
            if (!canvas) {
              console.error('[Whiteboard DirectImageGeneration Button] ❌ Canvas is not available.');
              return;
            }
            try {
              const dataURL = canvas.toDataURL({
                format: 'png',
                quality: 0.8,
                multiplier: 1,
              });
              console.log('[Whiteboard DirectImageGeneration Button] ✅ Snapshot generated successfully.');
              // Auto-download PNG
              const link = document.createElement('a');
              const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
              link.href = dataURL;
              link.download = `whiteboard-snapshot-${timestamp}.png`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              console.log('[Whiteboard DirectImageGeneration Button] 💾 Snapshot auto-downloaded.');
              setCanvasSnapshot(dataURL);
              setIsAIGenerationOpen(true);
            } catch (error) {
              console.error('[Whiteboard DirectImageGeneration Button] ❌ Failed to generate snapshot:', error);
              alert('无法获取画板快照，请重试');
            }
          }}
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
      </div>

      <div className="whiteboard-main-content">
        <div 
          className="whiteboard-container"
          onContextMenu={handleContextMenu}
        >
          <UndoButton 
            canUndo={history.length > 1}
            onUndo={() => {
              const currentCanvas = fabricCanvasRef.current;
              if (!currentCanvas) {
                console.warn('[Whiteboard handleUndo] Canvas ref is null, cannot undo.');
                return;
              }

              setHistory(prevHistory => {
                console.log('[Whiteboard handleUndo] Attempting undo. History length:', prevHistory.length);
                if (prevHistory.length <= 1) { 
                  console.log('[Whiteboard handleUndo] No more states to undo or only initial state left.');
                  return prevHistory; 
                }

                try {
                  const prevState = prevHistory[prevHistory.length - 2]; 
                  console.log('[Whiteboard handleUndo] Reverting to state from timestamp:', prevState.timestamp);
                  currentCanvas.loadFromJSON(JSON.parse(prevState.canvasState), () => {
                    console.log('[Whiteboard handleUndo] 🖌️ 恢复画布绘图状态...');
                    currentCanvas.isDrawingMode = initialIsDrawingMode; 
                    // 恢复画笔设置
                    const brush = new fabric.PencilBrush(currentCanvas);
                    brush.width = brushSize;
                    brush.color = brushColor;
                    (brush as any).decimate = 8;
                    (brush as any).controlPointsNum = 2;
                    currentCanvas.freeDrawingBrush = brush;
                    currentCanvas.renderAll();
                    console.log('[Whiteboard handleUndo] ✅ Canvas loaded from previous state with drawing mode restored.');
                  });
                  return prevHistory.slice(0, -1); 
                } catch (error) {
                  console.error('[Whiteboard handleUndo] Failed to undo:', error);
                  return prevHistory; 
                }
              });
            }}
          />
          <div className="canvas-wrapper">
            <canvas ref={canvasElRef} />
          </div>
          {menuPosition && (
            <ImageUploader onImageProcessed={handleImageProcessed}>
              {(triggerUpload) => (
                <FloatingMenu
                  position={menuPosition}
                  onUploadClick={triggerUpload}
                  onClose={() => {
                    setMenuPosition(null);
                    setClickPosition(null);
                  }}
                />
              )}
            </ImageUploader>
          )}
          {stickerButtonPosition && (
            <FloatingButton
              position={stickerButtonPosition}
              onConvert={handleStickerConvert}
              onClose={() => setStickerButtonPosition(null)}
              targetImage={stickerButtonPosition.target}
            />
          )}
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
    </div>
  );
};

export default Whiteboard;
