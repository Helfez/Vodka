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
import { DEFAULT_SYSTEM_PROMPT } from '../config/ai-prompts';
import { AihubmixVisionService } from './ImageSticker/services/aihubmix-vision.service';
import { AihubmixDalleService } from './ImageSticker/services/aihubmix-dalle.service';

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

  // State for AI generation panel - isAIGenerationOpen might not be needed if panel is fully replaced
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isAIGenerationOpen, setIsAIGenerationOpen] = useState(false); 
  // canvasSnapshot is still useful for analysis/generation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [canvasSnapshot, setCanvasSnapshot] = useState<string>(''); 

  // State for log viewer
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);

  // State for AI prompt sidebar and related AI logic
  const [isPromptSidebarOpen, setIsPromptSidebarOpen] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState<string>(DEFAULT_SYSTEM_PROMPT);
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const visionService = AihubmixVisionService.getInstance();
  const dalleService = AihubmixDalleService.getInstance();

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
  }, [fabricCanvasRef, setHistory]);

  // Callback to handle the undo action
  const handleUndo = useCallback(() => {
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
          currentCanvas.renderAll();
          currentCanvas.isDrawingMode = initialIsDrawingMode; 
          currentCanvas.freeDrawingBrush = configureBrush(currentCanvas, brushSize, brushColor);
          console.log('[Whiteboard handleUndo] Canvas loaded from previous state.');
        });
        return prevHistory.slice(0, -1); 
      } catch (error) {
        console.error('[Whiteboard handleUndo] Failed to undo:', error);
        return prevHistory; 
      }
    });
  }, [setHistory, fabricCanvasRef, brushSize, brushColor, initialIsDrawingMode]); 

  // Helper to get canvas snapshot
  const getCanvasSnapshotDataURL = useCallback((): string | null => {
    console.log('[Whiteboard getCanvasSnapshotDataURL] Attempting to get canvas snapshot.');
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      console.error('[Whiteboard getCanvasSnapshotDataURL] ❌ Canvas is not available.');
      return null;
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
      setCanvasSnapshot(dataURL); // Keep updating this state if other parts still use it
      return dataURL;
    } catch (error) {
      console.error('[Whiteboard getCanvasSnapshotDataURL] ❌ Failed to generate snapshot:', error);
      return null;
    }
  }, [fabricCanvasRef]); // Removed setCanvasSnapshot from deps as it's directly in function

  // 处理AI生成的图片 (Remains largely the same)
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
        // Adjust positioning logic if needed, e.g., make it smarter
        const imagePosition = {
          x: clickPosition?.x || canvasCenter.x - img.width / 4, // Use click position if available
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
        canvas.renderAll();

        console.log('[Whiteboard handleAIImageGenerated] 💾 记录历史状态...');
        requestAnimationFrame(() => {
          const historyStartTime = performance.now();
          recordState(); // Use the existing recordState function
          const historyEndTime = performance.now();
          console.log('[Whiteboard handleAIImageGenerated] ✅ 历史状态已记录 (approx time):', Math.round(historyEndTime - historyStartTime), 'ms');
        });

        console.log('[Whiteboard handleAIImageGenerated] ✅ AI图片集成完成');
        console.log('[Whiteboard handleAIImageGenerated] === AI图片集成结束 ===');
      } catch (error) {
        console.error('[Whiteboard handleAIImageGenerated] ❌ 图片添加到画布失败:', error);
      }
    };

    img.onerror = (errorEvent) => {
      console.error('[Whiteboard handleAIImageGenerated] ❌ 图片加载失败:', errorEvent);
      console.error('  - 图片URL:', imageUrl);
      console.error('  - 加载耗时:', Math.round(performance.now() - loadStartTime), 'ms');
       // More detailed error logging
       if (typeof errorEvent === 'string') {
        console.error('  - Error message (string):', errorEvent);
      } else if (errorEvent instanceof Event) {
        console.error('  - Event type:', errorEvent.type);
        // Check for target and other properties if available and relevant
        if (errorEvent.target && (errorEvent.target as HTMLImageElement).src) {
          console.error('  - Error source (img.src):', (errorEvent.target as HTMLImageElement).src);
        }
      } else {
        console.error('  - Error object:', errorEvent);
      }
    };

    img.src = imageUrl;
  }, [clickPosition, recordState]); // Added recordState, clickPosition is used

  // New: Analyze canvas and update generatedPrompt state
  const handleAnalyzeCanvas = useCallback(async (currentSystemPrompt: string): Promise<string | null> => {
    console.log('[Whiteboard handleAnalyzeCanvas] === Canvas Analysis Initiated ===');
    setIsAnalyzing(true);
    setGeneratedPrompt(''); 

    const snapshotDataURL = getCanvasSnapshotDataURL();
    if (!snapshotDataURL) {
      setIsAnalyzing(false);
      console.error('[Whiteboard handleAnalyzeCanvas] ❌ Analysis failed: Could not get canvas snapshot.');
      setGeneratedPrompt('错误：无法获取画板快照进行分析。');
      return null;
    }

    try {
      console.log('[Whiteboard handleAnalyzeCanvas] 🧠 Calling vision service...');
      console.log('  - System Prompt used (first 100 chars):', currentSystemPrompt.substring(0, 100) + '...');
      
      const analysisResult = await visionService.analyzeImage(snapshotDataURL, currentSystemPrompt);
      const newPrompt = analysisResult.analysis || '错误: 未能从AI分析结果中提取有效的Prompt。';
      
      console.log('[Whiteboard handleAnalyzeCanvas] ✅ Analysis successful. Generated prompt (first 100 chars):', newPrompt.substring(0, 100) + '...');
      setGeneratedPrompt(newPrompt);
      return newPrompt;
    } catch (error) {
      console.error('[Whiteboard handleAnalyzeCanvas] ❌ Error during canvas analysis:', error);
      const errorMessage = error instanceof Error ? error.message : '未知分析错误';
      setGeneratedPrompt(`分析时发生错误: ${errorMessage.substring(0,100)}...`);
      return null;
    } finally {
      setIsAnalyzing(false);
      console.log('[Whiteboard handleAnalyzeCanvas] === Canvas Analysis Completed (Success or Failure) ===');
    }
  }, [getCanvasSnapshotDataURL, visionService]);

  // New: Generate image using a given prompt
  const handleGenerateImageFromPrompt = useCallback(async (promptToUse: string) => {
    console.log('[Whiteboard handleGenerateImageFromPrompt] === Image Generation Initiated ===');
    if (!promptToUse || promptToUse.startsWith('错误:')) {
      console.error('[Whiteboard handleGenerateImageFromPrompt] ❌ Invalid or missing prompt for image generation:', promptToUse);
      alert('错误：没有有效Prompt可用于生成图片。请先成功分析画板。');
      return;
    }
    setIsGenerating(true);

    try {
      console.log('[Whiteboard handleGenerateImageFromPrompt] 🎨 Calling DALL-E service with prompt (first 100 chars):', promptToUse.substring(0,100) + '...');
      
      const generationResult = await dalleService.generateImage(promptToUse, {
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: "vivid"
      });

      if (generationResult && generationResult.images && generationResult.images.length > 0 && generationResult.images[0].url) {
        const imageUrl = generationResult.images[0].url;
        console.log('[Whiteboard handleGenerateImageFromPrompt] ✅ Image generation successful. Image URL (first 50 chars):', imageUrl.substring(0, 50) + '...');
        handleAIImageGenerated(imageUrl); 
      } else {
        console.error('[Whiteboard handleGenerateImageFromPrompt] ❌ Could not find image URL in DALL-E service response:', generationResult);
        alert('错误：未能从AI服务响应中找到图片URL。');
        throw new Error('Image URL not found in DALL-E service response.');
      }
    } catch (error) {
      console.error('[Whiteboard handleGenerateImageFromPrompt] ❌ Error during image generation:', error);
      const errorMessage = error instanceof Error ? error.message : '未知图片生成错误';
      alert(`图片生成时发生错误: ${errorMessage.substring(0,100)}...`);
    } finally {
      setIsGenerating(false);
      console.log('[Whiteboard handleGenerateImageFromPrompt] === Image Generation Completed (Success or Failure) ===');
    }
  }, [handleAIImageGenerated, dalleService]);

  // New: "生图" button's main handler
  const handleDirectImageGeneration = useCallback(async () => {
    console.log('[Whiteboard handleDirectImageGeneration] === Direct Image Generation Flow Started ===');
    // Ensure sidebar is open to show prompts, or open it.
    if (!isPromptSidebarOpen) {
        setIsPromptSidebarOpen(true);
    }

    const analysisPrompt = await handleAnalyzeCanvas(systemPrompt);
    
    if (analysisPrompt && !analysisPrompt.startsWith('错误:')) {
      await handleGenerateImageFromPrompt(analysisPrompt);
    } else {
      console.error('[Whiteboard handleDirectImageGeneration] ❌ Flow aborted: Analysis did not return a valid prompt.');
      alert('错误：AI分析未能成功生成有效的Prompt，无法继续生图。请检查侧边栏中的分析结果。');
    }
    console.log('[Whiteboard handleDirectImageGeneration] === Direct Image Generation Flow Ended ===');
  }, [systemPrompt, handleAnalyzeCanvas, handleGenerateImageFromPrompt, isPromptSidebarOpen, setIsPromptSidebarOpen]);

  // --- Effects --- 

  // Effect for initializing and managing the Fabric canvas instance
  useEffect(() => {
    console.log('[Whiteboard CanvasLifecycle useEffect] Running. Deps:', { width, height, initialIsDrawingMode, brushSize, brushColor });

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

    console.log('[Whiteboard CanvasLifecycle useEffect] Applying properties. DrawingMode:', initialIsDrawingMode, 'BrushSize:', brushSize);
    canvasInstance.isDrawingMode = initialIsDrawingMode;
    canvasInstance.freeDrawingBrush = configureBrush(canvasInstance, brushSize, brushColor);
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
      requestAnimationFrame(recordState); 
    };

    const handleMouseUpLocal = (e: fabric.TEvent) => { 
      console.log('[Whiteboard mouse:up] Event:', e);
    };

    const handleKeyboardLocal = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault(); 
        handleUndo(); 
      }
      // Ctrl/Cmd + G for the new direct image generation flow
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        // handleOpenAIGeneration(); // Old behavior
        handleDirectImageGeneration(); // New behavior
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
  }, [width, height, initialIsDrawingMode, brushSize, brushColor, handleUndo, recordState, handleDirectImageGeneration]); // Added handleDirectImageGeneration to deps

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
    console.log('[Whiteboard handleContextMenu] Context menu event triggered at:', event.clientX, event.clientY);
    event.preventDefault();
    
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;
    
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const pointer = canvas.getPointer(event.nativeEvent);
    const objects = canvas.getObjects();
    const clickedImage = objects.find(obj => 
      obj instanceof fabric.Image && 
      obj.containsPoint(pointer)
    ) as fabric.Image | undefined;

    if (clickedImage) {
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
    } else {
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
    
    const img = new Image();
    const loadStartTime = performance.now();
    
    img.onload = () => {
      const loadEndTime = performance.now();
      console.log('[Whiteboard handleImageProcessed] ✅ 图片加载完成，耗时:', Math.round(loadEndTime - loadStartTime), 'ms');
      
      const imagePosition = {
        x: clickPosition.x - processedImage.width / 2,
        y: clickPosition.y - processedImage.height / 2
      };
      
      const fabricImage = new fabric.Image(img, {
        left: imagePosition.x,
        top: imagePosition.y,
        selectable: false,
        hasControls: false,
        evented: true
      });

      canvas.add(fabricImage);

      try {
        console.log('[Whiteboard handleImageProcessed] ✨ 应用照片效果...');
        PhotoEffect.applyPhotoEffect(fabricImage, {
          animation: {
            initial: { scale: 0.7, opacity: 0, rotation: -20 },
            final: { scale: 1, opacity: 1, rotation: Math.random() * 6 - 3 },
            duration: 1200,
            easing: 'easeOutBack'
          }
        });

        fabricImage.set({ selectable: true, hasControls: true, evented: true });

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

      } catch (error: any) {
        console.error('[Whiteboard handleImageProcessed] ❌ 照片效果应用失败:', error);
      } finally {
        canvas.renderAll();
      }

      requestAnimationFrame(() => {
        recordState(); // Use existing recordState
      });

      setMenuPosition(null);
      setClickPosition(null);
      console.log('[Whiteboard handleImageProcessed] === 图片上传处理完成 ===');
    };

    img.src = processedImage.dataUrl;
  }, [clickPosition, recordState]); // Added recordState

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
          onClick={handleDirectImageGeneration} // Updated onClick
          title="AI分析画板并自动生成图片"
          disabled={isAnalyzing || isGenerating}
        >
          {isGenerating ? '🎨 生成中...' : (isAnalyzing ? '🧠 分析中...' : '🎨 生图')}
        </button>
        <button
          className="ai-generation-btn" // Consider a different class if styles diverge
          onClick={() => setIsPromptSidebarOpen(prev => !prev)} // Toggle sidebar
          title={isPromptSidebarOpen ? "关闭AI分析工具" : "打开AI分析工具"}
        >
          {isPromptSidebarOpen ? '✖️ 关闭工具' : '🤖 AI工具'}
        </button>
        <button 
          className="log-viewer-button"
          onClick={() => setIsLogViewerOpen(true)}
          title="查看系统日志"
        >
          📊 日志
        </button>
        {/* Removed the extra close button, toggle is now on the AI工具 button itself */}
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
                onUploadClick={() => {}} // This probably triggers the uploader
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
              {/* Close button inside sidebar can be kept or rely on toggle button */}
              <button 
                className="sidebar-close-btn-internal" // new class if styling needed
                onClick={() => setIsPromptSidebarOpen(false)}
                title="关闭AI分析工具侧边栏"
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
                  rows={10} 
                  className="system-prompt-textarea"
                  disabled={isAnalyzing || isGenerating}
                />
                <button 
                  className="analyze-button-sidebar" 
                  onClick={() => handleAnalyzeCanvas(systemPrompt)}
                  disabled={isAnalyzing || isGenerating}
                  title="使用当前System Prompt分析画板，结果将显示在下方"
                >
                  {isAnalyzing && !isGenerating ? '🧠 分析中...' : '🚀 分析画板'}
                </button>
              </div>

              {/* AI分析结果 */}
              {(generatedPrompt || (isAnalyzing && !isGenerating) ) && ( 
                <div className="prompt-display-section">
                  <h4>📝 AI分析返回的生图Prompt:</h4>
                  {isAnalyzing && !isGenerating && !generatedPrompt && <p>分析中，请稍候...</p>}
                  {generatedPrompt && (
                    <div className="prompt-text">
                      <pre>{generatedPrompt}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* AI生成面板 - Commented out as per new flow */}
      {/* 
      <AIGenerationPanel
        isOpen={isAIGenerationOpen} 
        onClose={() => setIsAIGenerationOpen(false)}
        canvasSnapshot={canvasSnapshot}
        onImageGenerated={handleAIImageGenerated}
      /> 
      */}

      {/* 日志查看器 */}
      <LogViewer
        isOpen={isLogViewerOpen}
        onClose={() => setIsLogViewerOpen(false)}
      />
    </div>
  );
};

export default Whiteboard;
