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
import { AIGenerationPanel } from './AIGeneration/AIGenerationPanel';
import { LogViewer } from './LogViewer/LogViewer';

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

// 配置画笔函数
const configureBrush = (canvas: FabricCanvas, size: number, color: string) => {
  console.log('[Whiteboard configureBrush] Configuring brush with size:', size);
  const brush = new fabric.PencilBrush(canvas);
  brush.width = size;
  brush.color = color;
  
  // 添加贝塞尔曲线平滑
  (brush as any).decimate = 8;         // 采样点间隔
  (brush as any).controlPointsNum = 2; // 控制点数量
  return brush;
};

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

  // State for AI generation panel
  const [isAIGenerationOpen, setIsAIGenerationOpen] = useState(false);
  const [canvasSnapshot, setCanvasSnapshot] = useState<string>('');

  // State for log viewer
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);

  // State for AI prompt sidebar
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [isPromptSidebarOpen, setIsPromptSidebarOpen] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState<string>(`You are a professional prompt-generation assistant specialized in collectible vinyl toy (潮玩) design. You are strictly limited to tasks within the domain of toy and figure design, and must never deviate from that scope.

## Primary Task:
Analyze the user's whiteboard sketch, which may include images, annotations, or doodles, and generate a high-quality English prompt suitable for image generation models (such as DALL·E 3). This prompt will be used to produce a rendering of the collectible figure.

## Strict Design Constraints:
1. The design must describe a collectible character or creature suitable for full-color one-piece 3D printing at approximately 8cm in height.
2. All design choices must consider real-world 3D printing feasibility at 8cm scale — no thin, fragile, or floating structures.
3. The prompt must **not include any environment, scenery, background**, or abstract artistic elements — only the character or creature is allowed.
4. The figure must have a distinct and recognizable **style or theme** (e.g., whale-inspired, bio-mechanical, cute sci-fi).
5. The prompt must be **clear and structured**, describing the pose, silhouette, color scheme, and visual language of the design.
6. The prompt must **not** contain vague or overly broad stylistic descriptions.
7. The expected output is an image with a **transparent background**, suitable for rendering and modeling use.`);

  // --- Callbacks --- 

  // Callback to record the current canvas state for undo history
  const recordState = useCallback(() => {
    const currentCanvas = fabricCanvasRef.current;
    if (!currentCanvas) {
      console.warn('[Whiteboard recordState] Canvas ref is null, cannot record state.');
      return;
    }
    console.log('[Whiteboard recordState] Recording state. Objects:', currentCanvas.getObjects().length);
    const currentState: DrawingState = {
      canvasState: JSON.stringify(currentCanvas.toJSON()),
      timestamp: Date.now()
    };
    setHistory(prev => {
      const newHistory = [...prev, currentState].slice(-20); 
      return newHistory;
    });
  }, [fabricCanvasRef, setHistory]); // Dependencies: ref and history setter (both stable or semi-stable)

  // Callback to handle the undo action
  const handleUndo = useCallback(() => {
    const currentCanvas = fabricCanvasRef.current;
    if (!currentCanvas) {
      console.warn('[Whiteboard handleUndo] Canvas ref is null, cannot undo.');
      return;
    }

    setHistory(prevHistory => {
      console.log('[Whiteboard handleUndo] Attempting undo. History length:', prevHistory.length);
      if (prevHistory.length <= 1) { // Need at least one state to revert to
        console.log('[Whiteboard handleUndo] No more states to undo or only initial state left.');
        return prevHistory; // Return current history if no undo is possible
      }

      try {
        const prevState = prevHistory[prevHistory.length - 2]; // Get the state before the last one
        console.log('[Whiteboard handleUndo] Reverting to state from timestamp:', prevState.timestamp);
        currentCanvas.loadFromJSON(JSON.parse(prevState.canvasState), () => {
          currentCanvas.renderAll();
          // Ensure canvas properties like brush and drawing mode are reapplied after loadFromJSON
          // This is important as loadFromJSON might reset some canvas settings.
          currentCanvas.isDrawingMode = initialIsDrawingMode; 
          currentCanvas.freeDrawingBrush = configureBrush(currentCanvas, brushSize, brushColor);
          console.log('[Whiteboard handleUndo] Canvas loaded from previous state.');
        });
        return prevHistory.slice(0, -1); // Return new history array with the last state removed
      } catch (error) {
        console.error('[Whiteboard handleUndo] Failed to undo:', error);
        return prevHistory; // Return current history in case of an error
      }
    });
  }, [setHistory, fabricCanvasRef, brushSize, brushColor, initialIsDrawingMode]); // Removed 'history' from deps

  // 处理AI分析
  const handleAIAnalysis = useCallback(async (canvasSnapshot: string) => {
    console.log('[Whiteboard handleAIAnalysis] === AI分析流程开始 ===');
    
    try {
      // 导入AI服务
      const { AihubmixVisionService } = await import('./ImageSticker/services/aihubmix-vision.service');
      const visionService = AihubmixVisionService.getInstance();
      
      console.log('[Whiteboard handleAIAnalysis] 🤖 开始AI分析...');
      setAiPrompt('正在分析中...');
      setIsPromptSidebarOpen(true);
      
      const analysisResult = await visionService.analyzeImage(canvasSnapshot, systemPrompt);
      
      console.log('[Whiteboard handleAIAnalysis] ✅ AI分析完成');
      console.log('  - 返回prompt长度:', analysisResult.analysis.length, '字符');
      
      setAiPrompt(analysisResult.analysis);
      
    } catch (error) {
      console.error('[Whiteboard handleAIAnalysis] ❌ AI分析失败:', error);
      setAiPrompt('AI分析失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  }, [systemPrompt]);

  // 处理AI生成面板打开
  const handleOpenAIGeneration = useCallback(() => {
    console.log('[Whiteboard handleOpenAIGeneration] === AI生成流程开始 ===');
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      console.error('[Whiteboard handleOpenAIGeneration] ❌ Canvas不可用，无法生成快照');
      return;
    }

    try {
      console.log('[Whiteboard handleOpenAIGeneration] 📊 画布信息:');
      console.log('  - 画布尺寸:', canvas.getWidth(), 'x', canvas.getHeight());
      console.log('  - 对象数量:', canvas.getObjects().length);
      console.log('  - 背景色:', canvas.backgroundColor);
      
      // 获取画布快照
      console.log('[Whiteboard handleOpenAIGeneration] 📸 开始生成画布快照...');
      const startTime = performance.now();
      
      const dataURL = canvas.toDataURL({
        format: 'png',
        quality: 0.8,
        multiplier: 1
      });
      
      const endTime = performance.now();
      const snapshotSize = Math.round(dataURL.length / 1024); // KB
      console.log('[Whiteboard handleOpenAIGeneration] ✅ 快照生成完成:');
      console.log('  - 耗时:', Math.round(endTime - startTime), 'ms');
      console.log('  - 大小:', snapshotSize, 'KB');
      console.log('  - 格式:', dataURL.substring(0, 30) + '...');
      
      // 自动下载PNG文件
      console.log('[Whiteboard handleOpenAIGeneration] 💾 开始下载PNG文件...');
      try {
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `whiteboard-snapshot-${timestamp}.png`;
        
        link.href = dataURL;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log('[Whiteboard handleOpenAIGeneration] ✅ PNG文件下载完成:', filename);
      } catch (downloadError) {
        console.error('[Whiteboard handleOpenAIGeneration] ❌ PNG下载失败:', downloadError);
      }
      
      // 设置快照并打开AI生成面板
      setCanvasSnapshot(dataURL);
      setIsAIGenerationOpen(true);
      console.log('[Whiteboard handleOpenAIGeneration] 🎨 AI生成面板已打开');
      console.log('[Whiteboard handleOpenAIGeneration] === AI生成流程准备完成 ===');
      
    } catch (error) {
      console.error('[Whiteboard handleOpenAIGeneration] ❌ 快照生成失败:', error);
      console.error('  - 错误类型:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('  - 错误消息:', error instanceof Error ? error.message : String(error));
      console.error('  - 错误堆栈:', error instanceof Error ? error.stack : 'N/A');
    }
  }, []);

  // 处理AI生成的图片
  const handleAIImageGenerated = useCallback((imageUrl: string) => {
    console.log('[Whiteboard handleAIImageGenerated] === AI图片集成开始 ===');
    console.log('[Whiteboard handleAIImageGenerated] 📥 接收到图片URL:', imageUrl.substring(0, 50) + '...');
    
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      console.error('[Whiteboard handleAIImageGenerated] ❌ Canvas不可用，无法添加图片');
      return;
    }

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
          x: canvasCenter.x - img.width / 4,
          y: canvasCenter.y - img.height / 4
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
        canvas.renderAll();

        console.log('[Whiteboard handleAIImageGenerated] 💾 记录历史状态...');
        // 记录状态用于撤销
        requestAnimationFrame(() => {
          const historyStartTime = performance.now();
          const currentState: DrawingState = {
            canvasState: JSON.stringify(canvas.toJSON()),
            timestamp: Date.now()
          };

          setHistory(prev => {
            const newHistory = [...prev, currentState];
            if (newHistory.length > 20) {
              newHistory.shift();
            }
            const historyEndTime = performance.now();
            console.log('[Whiteboard handleAIImageGenerated] ✅ 历史状态已记录:');
            console.log('  - 序列化耗时:', Math.round(historyEndTime - historyStartTime), 'ms');
            console.log('  - 历史长度:', newHistory.length);
            return newHistory;
          });
        });

        console.log('[Whiteboard handleAIImageGenerated] ✅ AI图片集成完成');
        console.log('[Whiteboard handleAIImageGenerated] === AI图片集成结束 ===');
      } catch (error) {
        console.error('[Whiteboard handleAIImageGenerated] ❌ 图片添加到画布失败:', error);
        console.error('  - 错误类型:', error instanceof Error ? error.constructor.name : typeof error);
        console.error('  - 错误消息:', error instanceof Error ? error.message : String(error));
      }
    };

    img.onerror = (error) => {
      console.error('[Whiteboard handleAIImageGenerated] ❌ 图片加载失败:', error);
      console.error('  - 图片URL:', imageUrl);
      console.error('  - 加载耗时:', Math.round(performance.now() - loadStartTime), 'ms');
    };

    img.src = imageUrl;
  }, []);

  // --- Effects --- 

  // Effect for initializing and managing the Fabric canvas instance and its direct properties/event listeners
  // This effect handles canvas creation, updates to drawing mode, brush, and attaches core event listeners.
  useEffect(() => {
    console.log('[Whiteboard CanvasLifecycle useEffect] Running. Deps:', { width, height, initialIsDrawingMode, brushSize, brushColor });

    if (!canvasElRef.current) {
      console.warn('[Whiteboard CanvasLifecycle useEffect] canvasElRef is null. Bailing out.');
      return;
    }

    let canvasInstance = fabricCanvasRef.current;

    // If canvas doesn't exist, or width/height changed, create a new one
    // This ensures the canvas is responsive to dimension props.
    if (!canvasInstance || canvasInstance.getWidth() !== width || canvasInstance.getHeight() !== height) {
      if (canvasInstance) {
        console.log('[Whiteboard CanvasLifecycle useEffect] Disposing existing canvas due to dimension change or recreation.');
        canvasInstance.dispose(); // Dispose old instance before creating new
      }
      console.log('[Whiteboard CanvasLifecycle useEffect] Creating new Fabric canvas.');
      canvasInstance = new fabric.Canvas(canvasElRef.current, {
        width,
        height,
        backgroundColor: '#ffffff', // Default background
        isDrawingMode: initialIsDrawingMode, // Set initial drawing mode
      }) as FabricCanvas;
      fabricCanvasRef.current = canvasInstance; // Store new instance in ref
      console.log('[Whiteboard CanvasLifecycle useEffect] New canvas created and assigned to ref.');
    } else {
      console.log('[Whiteboard CanvasLifecycle useEffect] Using existing canvas instance.');
    }

    // Apply/update canvas properties whenever dependencies change
    console.log('[Whiteboard CanvasLifecycle useEffect] Applying properties. DrawingMode:', initialIsDrawingMode, 'BrushSize:', brushSize);
    canvasInstance.isDrawingMode = initialIsDrawingMode;
    canvasInstance.freeDrawingBrush = configureBrush(canvasInstance, brushSize, brushColor);
    canvasInstance.renderOnAddRemove = true; // Important for Fabric.js behavior
    canvasInstance.preserveObjectStacking = true; // Maintains object layering

    // Define event handlers (local to this effect, will be re-attached if effect re-runs)
    // These handlers use the 'canvasInstance' from this effect's closure.
    const handleMouseDownLocal = (e: fabric.TEvent) => { // Changed IEvent to TEvent
      console.log('[Whiteboard mouse:down] Event:', e);
      if (fabricCanvasRef.current?.isDrawingMode) {
        setStickerButtonPosition(null); // Hide sticker button when drawing starts
      }
    };

    const handlePathCreatedLocal = (e: fabric.TEvent & { path: fabric.Path }) => { // Changed IEvent to TEvent
      console.log('[Whiteboard path:created] Path created:', e.path);
      requestAnimationFrame(recordState); // recordState is a stable useCallback
    };

    const handleMouseUpLocal = (e: fabric.TEvent) => { // Changed IEvent to TEvent
      console.log('[Whiteboard mouse:up] Event:', e);
      // Future logic for mouse up if needed
    };

    // Keyboard listener for shortcuts like Ctrl+Z for undo
    const handleKeyboardLocal = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault(); // Prevent browser's default undo action
        handleUndo(); // handleUndo is now a stable useCallback
      }
      // Ctrl/Cmd + G 打开AI生成面板
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        handleOpenAIGeneration();
      }
    };

    // Attach event listeners to the current canvas instance and window
    console.log('[Whiteboard CanvasLifecycle useEffect] Attaching event listeners.');
    canvasInstance.on('mouse:down', handleMouseDownLocal);
    canvasInstance.on('path:created', handlePathCreatedLocal);
    canvasInstance.on('mouse:up', handleMouseUpLocal);
    window.addEventListener('keydown', handleKeyboardLocal);

    // Cleanup function for this effect: remove listeners
    return () => {
      console.log('[Whiteboard CanvasLifecycle useEffect Cleanup] Cleaning up listeners.');
      window.removeEventListener('keydown', handleKeyboardLocal);
      // Check if canvasInstance is still valid and same as ref before detaching listeners.
      // This ensures we're cleaning up listeners from the correct instance.
      if (canvasInstance && fabricCanvasRef.current === canvasInstance) {
        console.log('[Whiteboard CanvasLifecycle useEffect Cleanup] Detaching listeners from canvas:', canvasInstance);
        canvasInstance.off('mouse:down', handleMouseDownLocal);
        canvasInstance.off('path:created', handlePathCreatedLocal);
        canvasInstance.off('mouse:up', handleMouseUpLocal);
      }
      // Note: Canvas disposal itself is handled if width/height change (at the start of this effect)
      // or on component unmount (in a separate effect).
    };
  }, [width, height, initialIsDrawingMode, brushSize, brushColor, handleUndo, recordState, handleOpenAIGeneration]); // Dependencies that manage canvas and its core behavior

  // Effect for setting the initial history, runs once after canvas is ready and history is empty
  useEffect(() => {
    // Only run if canvas is available and history hasn't been initialized yet.
    if (fabricCanvasRef.current && history.length === 0) {
      console.log('[Whiteboard InitialHistory useEffect] Setting initial history state.');
      const initialState: DrawingState = {
        canvasState: JSON.stringify(fabricCanvasRef.current.toJSON()), // Get initial state from canvas
        timestamp: Date.now()
      };
      setHistory([initialState]); // Initialize history with the current canvas state
      console.log('[Whiteboard InitialHistory useEffect] Initial history state set.');
    }
  }, [fabricCanvasRef, history.length]); // Runs when canvas ref object changes or history length changes

  // Effect for component unmount: ensure canvas is disposed to prevent memory leaks
  useEffect(() => {
    return () => {
      if (fabricCanvasRef.current) {
        console.log('[Whiteboard Unmount Cleanup] Disposing canvas on component unmount.');
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, []); // Empty dependency array means this runs only on mount and unmount

  // Handler for context menu (right-click)
  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    console.log('[Whiteboard handleContextMenu] Context menu event triggered at:', event.clientX, event.clientY);
    event.preventDefault();
    
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;
    
    // 获取画布上的点击位置
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // 检查点击位置是否有图片
    const pointer = canvas.getPointer(event.nativeEvent);
    const objects = canvas.getObjects();
    const clickedImage = objects.find(obj => 
      obj instanceof fabric.Image && 
      obj.containsPoint(pointer)
    ) as fabric.Image | undefined;

    if (clickedImage) {
      // 如果点击了图片，显示贴纸按钮
      const bounds = clickedImage.getBoundingRect();
      
      // 移除之前的选中框
      const existingSelection = objects.find(obj => 
        obj instanceof fabric.Rect && 
        (obj as any).data?.type === 'selection-rect'
      );
      if (existingSelection) {
        canvas.remove(existingSelection);
      }
      
      // 创建新的选中框
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
    } else {
      // 如果点击了空白处，显示上传菜单
      // 移除选中框
      const existingSelection = objects.find(obj => 
        obj instanceof fabric.Rect && 
        (obj as any).data?.type === 'selection-rect'
      );
      if (existingSelection) {
        canvas.remove(existingSelection);
        canvas.renderAll();
      }

      setMenuPosition({ x: event.clientX, y: event.clientY });
      setClickPosition({ x, y });
      setStickerButtonPosition(null);
    }
  }, []);

  // 处理贴纸转换
  const handleStickerConvert = useCallback(() => {
    console.log('[Whiteboard handleStickerConvert] Sticker convert called.');
    if (!stickerButtonPosition) return;
    console.log('[Whiteboard handleStickerConvert] 开始转换贴纸...');
    // 贴纸转换逻辑已在FloatingButton组件中实现
    // 这里不需要做任何操作，因为FloatingButton组件会处理转换过程
    // 并在完成后自动关闭
  }, [stickerButtonPosition]);

  // 处理图片上传
  const handleImageProcessed = useCallback(async (processedImage: ProcessedImage) => {
    console.log('[Whiteboard handleImageProcessed] === 图片上传处理开始 ===');
    console.log('[Whiteboard handleImageProcessed] 📊 图片信息:');
    console.log('  - 尺寸:', processedImage.width, 'x', processedImage.height);
    console.log('  - 数据大小:', Math.round(processedImage.dataUrl.length / 1024), 'KB');
    
    if (!fabricCanvasRef.current || !clickPosition) {
        console.error('[Whiteboard handleImageProcessed] ❌ Canvas或点击位置不可用');
        console.error('  - Canvas可用:', !!fabricCanvasRef.current);
        console.error('  - 点击位置:', clickPosition);
        return;
    }

    const canvas = fabricCanvasRef.current;
    console.log('[Whiteboard handleImageProcessed] 📍 放置位置:', clickPosition);
    
    const img = new Image();
    const loadStartTime = performance.now();
    
    img.onload = () => {
      const loadEndTime = performance.now();
      console.log('[Whiteboard handleImageProcessed] ✅ 图片加载完成，耗时:', Math.round(loadEndTime - loadStartTime), 'ms');
      
      const imagePosition = {
        x: clickPosition.x - processedImage.width / 2,
        y: clickPosition.y - processedImage.height / 2
      };
      
      console.log('[Whiteboard handleImageProcessed] 🎯 计算最终位置:', imagePosition);

      const fabricImage = new fabric.Image(img, {
        left: imagePosition.x,
        top: imagePosition.y,
        selectable: false,
        hasControls: false,
        evented: true
      });

      // 先添加到画布
      console.log('[Whiteboard handleImageProcessed] ➕ 添加图片到画布...');
      canvas.add(fabricImage);

      // 应用照片效果
      try {
        console.log('[Whiteboard handleImageProcessed] ✨ 应用照片效果...');
        PhotoEffect.applyPhotoEffect(fabricImage, {
          animation: {
            initial: {
              scale: 0.7,
              opacity: 0,
              rotation: -20
            },
            final: {
              scale: 1,
              opacity: 1,
              rotation: Math.random() * 6 - 3
            },
            duration: 1200,
            easing: 'easeOutBack'
          }
        });

        // 设置图片可选中和可控制
        fabricImage.set({
          selectable: true,
          hasControls: true,
          evented: true
        });

        // 监听选中事件
        fabricImage.on('selected', () => {
          console.log('[Whiteboard handleImageProcessed] 🎯 图片被选中');
          const bounds = fabricImage.getBoundingRect();
          setStickerButtonPosition({
            x: bounds.left + bounds.width / 2,
            y: bounds.top - 20,
            target: fabricImage
          });
        });

        // 监听取消选中事件
        fabricImage.on('deselected', () => {
          console.log('[Whiteboard handleImageProcessed] ⭕ 图片取消选中');
          setStickerButtonPosition(null);
        });

        console.log('[Whiteboard handleImageProcessed] ✅ 照片效果应用完成');
      } catch (error: any) {
        console.error('[Whiteboard handleImageProcessed] ❌ 照片效果应用失败:', error);
      } finally {
        canvas.renderAll();
      }

      // 记录状态用于撤销
      console.log('[Whiteboard handleImageProcessed] 💾 记录历史状态...');
      requestAnimationFrame(() => {
        const historyStartTime = performance.now();
        const currentState: DrawingState = {
          canvasState: JSON.stringify(canvas.toJSON()),
          timestamp: Date.now()
        };

        setHistory(prev => {
          const newHistory = [...prev, currentState];
          if (newHistory.length > 20) {
            newHistory.shift();
          }
          const historyEndTime = performance.now();
          console.log('[Whiteboard handleImageProcessed] ✅ 历史状态记录完成，耗时:', Math.round(historyEndTime - historyStartTime), 'ms');
          return newHistory;
        });
      });

      // 关闭菜单
      console.log('[Whiteboard handleImageProcessed] 🔄 清理UI状态...');
      setMenuPosition(null);
      setClickPosition(null);
      console.log('[Whiteboard handleImageProcessed] === 图片上传处理完成 ===');
    };

    img.src = processedImage.dataUrl;
  }, [clickPosition]);

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
      
      {/* AI生成按钮 */}
      <div className="ai-generation-trigger">
        <button
          className="ai-generation-btn"
          onClick={handleOpenAIGeneration}
          title="AI生成图片"
        >
          🎨 生图
        </button>
        <button
          className="ai-generation-btn"
          onClick={() => setIsPromptSidebarOpen(true)}
          title="打开AI分析工具"
        >
          🤖 AI工具
        </button>
        <button 
          className="log-viewer-button"
          onClick={() => setIsLogViewerOpen(true)}
          title="查看系统日志"
        >
          📊 日志
        </button>
        {isPromptSidebarOpen && (
          <button 
            className="close-sidebar-button"
            onClick={() => setIsPromptSidebarOpen(false)}
            title="关闭Prompt侧边栏"
          >
            ✖️ 关闭
          </button>
        )}
      </div>

      <div className="whiteboard-main-content">
        <div 
          className="whiteboard-container"
          onContextMenu={handleContextMenu}
        >
          <UndoButton 
            canUndo={history.length > 1}
            onUndo={handleUndo}
          />
          <div className="canvas-wrapper">
            <canvas ref={canvasElRef} />
          </div>
          {menuPosition && (
            <ImageUploader onImageProcessed={handleImageProcessed}>
              <FloatingMenu
                position={menuPosition}
                onUploadClick={() => {}}
                onClose={() => {
                  setMenuPosition(null);
                  setClickPosition(null);
                }}
              />
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

        {/* AI Prompt 侧边栏 */}
        {isPromptSidebarOpen && (
          <div className="ai-prompt-sidebar">
            <div className="sidebar-header">
              <h3>🤖 AI分析工具</h3>
              <button 
                className="sidebar-close-btn"
                onClick={() => setIsPromptSidebarOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="sidebar-content">
              {/* System Prompt 编辑器 */}
              <div className="system-prompt-section">
                <h4>🎯 System Prompt 编辑</h4>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="输入System Prompt..."
                  rows={8}
                  className="system-prompt-textarea"
                />
                
                {/* 分析按钮 */}
                <button 
                  className="analyze-button"
                  onClick={handleOpenAIGeneration}
                  title="使用当前System Prompt分析画板"
                >
                  🚀 开始分析
                </button>
              </div>

              {/* AI分析结果 */}
              {aiPrompt && (
                <div className="prompt-display">
                  <h4>📝 AI分析结果 (生图Prompt):</h4>
                  <div className="prompt-text">
                    <pre>{aiPrompt}</pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
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
