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

type FabricObject = fabric.Object & {
  set(options: Record<string, any>): fabric.Object;
};

type FabricCanvas = fabric.Canvas & {
  freeDrawingBrush?: fabric.PencilBrush;
};

interface DrawingState {
  canvasState: string;
  timestamp: number;
}

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

const Whiteboard = ({ 
  width = 800, 
  height = 600,
  isDrawingMode = true
}: WhiteboardProps) => {
  console.log('[Whiteboard] Component rendered/re-rendered');
  // 浮动菜单状态
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null);
  const [brushSize, setBrushSize] = useState(5);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [brushColor, setBrushColor] = useState('#000000');
  const [history, setHistory] = useState<DrawingState[]>([]);
  
  // 贴纸按钮状态
  const [stickerButtonPosition, setStickerButtonPosition] = useState<FloatingButtonPosition | null>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);
  
  // 撤销功能
  const handleUndo = useCallback(() => {
    console.log('[Whiteboard handleUndo] Undo called. History length:', history.length);
    
    if (history.length <= 1 || !fabricCanvasRef.current) {
      console.log('[Whiteboard handleUndo] Cannot undo: no history or no canvas');
      return;
    }

    const canvas = fabricCanvasRef.current;
    const previousState = history[history.length - 2];

    try {
      const state = JSON.parse(previousState.canvasState);
      canvas.clear();

      if (state.objects) {
        state.objects.forEach((obj: any) => {
          const path = new fabric.Path(obj.path, obj) as FabricObject;
          path.set({
            selectable: false,
            hasControls: false,
            evented: false
          });
          canvas.add(path);
          canvas.renderAll();
        });
      }

      canvas.isDrawingMode = isDrawingMode;
      canvas.freeDrawingBrush = configureBrush(canvas, brushSize, brushColor);

      setHistory(prev => prev.slice(0, -1));
    } catch (error) {
      console.error('[Whiteboard handleUndo] Failed to undo:', error);
    }
  }, [history, brushSize, brushColor, isDrawingMode]);

  // 初始化画布
  useEffect(() => {
    console.log('[Whiteboard useEffect] Running. Deps:', { width, height, brushSize, brushColor, isDrawingMode, handleUndo: typeof handleUndo, historyLength: history.length });
    
    if (!canvasElRef.current) { 
      console.log(`[Whiteboard useEffect] Bailing out. canvasElRef.current is falsy.`);
      return;
    }

    console.log('[Whiteboard useEffect] Proceeding to create canvas. fabricCanvasRef.current BEFORE new canvas:', fabricCanvasRef.current);
    const canvas = new fabric.Canvas(canvasElRef.current, {
      width,
      height,
      backgroundColor: '#ffffff',
      isDrawingMode: isDrawingMode 
    }) as FabricCanvas;
    console.log('[Whiteboard useEffect] Local canvas instance created.');

    // Configure the local canvas instance
    canvas.isDrawingMode = isDrawingMode;
    canvas.freeDrawingBrush = configureBrush(canvas, brushSize, brushColor);
    canvas.renderOnAddRemove = true;
    canvas.preserveObjectStacking = true;

    // Define event handlers that close over this 'canvas' instance
    const handleMouseDown = (e: any) => {
      console.log('[Whiteboard mouse:down] Mouse down event:', e);
      if (canvas.isDrawingMode) { // Use local 'canvas'
        const objects = canvas.getObjects(); // Use local 'canvas'
        const existingSelection = objects.find(obj => 
          obj instanceof fabric.Rect && 
          (obj as any).data?.type === 'selection-rect'
        );
        if (existingSelection) {
          canvas.remove(existingSelection); // Use local 'canvas'
          canvas.renderAll(); // Use local 'canvas'
        }
        setStickerButtonPosition(null);
      }
    };

    const recordState = () => {
      console.log('[Whiteboard recordState] Recording state.');
      const currentCanvasRef = fabricCanvasRef.current; // Use the ref here
      if (!currentCanvasRef) {
        console.log('[Whiteboard recordState] Canvas ref is null, cannot record state.');
        return;
      }
      const objects = currentCanvasRef.getObjects();
      console.log('[Whiteboard recordState] Current objects:', objects.length);
      const currentState: DrawingState = {
        canvasState: JSON.stringify(currentCanvasRef.toJSON()),
        timestamp: Date.now()
      };
      setHistory(prev => {
        const newHistory = [...prev, currentState];
        if (newHistory.length > 20) {
          newHistory.shift();
        }
        return newHistory;
      });
    };

    const handlePathCreated = (e: any) => {
      console.log('[Whiteboard path:created] Path created:', e.path);
      requestAnimationFrame(recordState); // recordState will use the ref
    };

    const handleMouseUp = () => {
      console.log('[Whiteboard mouse:up] Mouse up event.');
      // Use local 'canvas' if logic depends on the instance from this effect run
      if (canvas.isDrawingMode) { 
        console.log('[Whiteboard mouse:up] Mouse up in drawing mode (local canvas context)');
      }
    };

    // Attach listeners to the local 'canvas'
    canvas.on('mouse:down', handleMouseDown);
    canvas.on('path:created', handlePathCreated);
    canvas.on('mouse:up', handleMouseUp);
    console.log('[Whiteboard useEffect] Event listeners attached to local canvas.');

    // Now assign to the ref
    fabricCanvasRef.current = canvas;
    console.log('[Whiteboard useEffect] fabricCanvasRef.current AFTER new canvas assignment:', fabricCanvasRef.current);

    // Record initial state (uses the local canvas for toJSON)
    const initialState: DrawingState = {
      canvasState: JSON.stringify(canvas.toJSON()), // Use local canvas for initial JSON
      timestamp: Date.now()
    };
    setHistory([initialState]); 
    console.log('[Whiteboard useEffect] Initial history set/reset. history.length is now 1.');

    // 添加键盘快捷键
    const handleKeyboard = (e: KeyboardEvent) => {
      console.log('[Whiteboard handleKeyboard] Keydown event:', e.key, 'Ctrl:', e.ctrlKey);
      if (e.ctrlKey && e.key === 'z') {
        console.log('[Whiteboard handleKeyboard] Ctrl+Z detected, calling handleUndo.');
        handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyboard);

    return () => {
      console.log('[Whiteboard useEffect Cleanup] Cleaning up canvas and listeners.');
      window.removeEventListener('keydown', handleKeyboard);
      const canvasToCleanup = fabricCanvasRef.current; // Capture ref for cleanup closure
      if (canvasToCleanup) {
        console.log('[Whiteboard useEffect Cleanup] Disposing canvas:', canvasToCleanup);
        // Ensure these are the same handler instances if they were defined in this scope
        canvasToCleanup.off('path:created', handlePathCreated); 
        canvasToCleanup.off('mouse:down', handleMouseDown);
        canvasToCleanup.off('mouse:up', handleMouseUp);
        canvasToCleanup.dispose();
        fabricCanvasRef.current = null; // Set ref to null after disposing
        console.log('[Whiteboard useEffect Cleanup] Canvas disposed, ref set to null.');
      }
    };
  }, [width, height, brushSize, brushColor, isDrawingMode, handleUndo, history.length]);

  // 处理画笔大小变化
  const handleBrushSizeChange = useCallback((newSize: number) => {
    console.log('[Whiteboard handleBrushSizeChange] New size:', newSize);
    setBrushSize(newSize);
    const canvas = fabricCanvasRef.current;
    if (canvas?.freeDrawingBrush) {
      canvas.freeDrawingBrush.width = newSize;
    }
  }, []);

  // 处理右键点击事件
  const handleContextMenu = useCallback((event: React.MouseEvent) => {
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
    console.log('[Whiteboard handleImageProcessed] Image processed. Dimensions:', processedImage.width, 'x', processedImage.height);
    if (!fabricCanvasRef.current || !clickPosition) {
        console.error('[Whiteboard handleImageProcessed] Canvas or clickPosition not available.');
        return;
    }

    const canvas = fabricCanvasRef.current;
    
    const img = new Image();
    
    img.onload = () => {
      const fabricImage = new fabric.Image(img, {
        left: clickPosition.x - processedImage.width / 2,
        top: clickPosition.y - processedImage.height / 2,
        selectable: false,
        hasControls: false,
        evented: true
      });

      // 先添加到画布
      canvas.add(fabricImage);

      // 应用照片效果
      try {
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
          const bounds = fabricImage.getBoundingRect();
          setStickerButtonPosition({
            x: bounds.left + bounds.width / 2,
            y: bounds.top - 20,
            target: fabricImage
          });
        });

        // 监听取消选中事件
        fabricImage.on('deselected', () => {
          setStickerButtonPosition(null);
        });

      } catch (error: any) {
        console.error('[Whiteboard handleImageProcessed] Error applying photo effect or adding image to canvas:', error);
      } finally {
        canvas.renderAll();
      }

      // 记录状态用于撤销
      requestAnimationFrame(() => {
        const currentState: DrawingState = {
          canvasState: JSON.stringify(canvas.toJSON()),
          timestamp: Date.now()
        };

        setHistory(prev => {
          const newHistory = [...prev, currentState];
          if (newHistory.length > 20) {
            newHistory.shift();
          }
          return newHistory;
        });
      });

      // 关闭菜单
      setMenuPosition(null);
      setClickPosition(null);
    };

    img.src = processedImage.dataUrl;
  }, [clickPosition]);

  return (
    <div className="whiteboard-wrapper">
      <Toolbar 
        brushSize={brushSize}
        onBrushSizeChange={handleBrushSizeChange}
      />
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
          />
        )}
      </div>
    </div>
  );
};

export default Whiteboard;
