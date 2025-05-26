import React, { createContext, useContext, useState } from 'react';
import * as fabric from 'fabric';
import { Canvas, Image, Object as FabricObject } from 'fabric/fabric-impl';
import { StickerState, StickerConfig } from '../services/types';

interface ImageStickerContextType {
  state: StickerState;
  config: StickerConfig;
  setProcessing: (isProcessing: boolean) => void;
  setOriginalImage: (image: Image | null) => void;
  setStickerVersion: (sticker: FabricObject | null) => void;
}

const defaultState: StickerState = {
  isProcessing: false,
  originalImage: null,
  stickerVersion: null,
};

const defaultConfig: StickerConfig = {
  enabled: true,
  apiEndpoint: '/api/process-image',
};

const ImageStickerContext = createContext<ImageStickerContextType | undefined>(undefined);

export const ImageStickerProvider: React.FC<{
  children: React.ReactNode;
  initialConfig?: Partial<StickerConfig>;
}> = ({ children, initialConfig = {} }) => {
  const [state, setState] = useState<StickerState>(defaultState);
  const [config] = useState<StickerConfig>({ ...defaultConfig, ...initialConfig });

  const setProcessing = (isProcessing: boolean) => {
    setState(prev => ({ ...prev, isProcessing }));
  };

  const setOriginalImage = (originalImage: fabric.Image | null) => {
    setState(prev => ({ ...prev, originalImage }));
  };

  const setStickerVersion = (stickerVersion: fabric.Object | null) => {
    setState(prev => ({ ...prev, stickerVersion }));
  };

  return (
    <ImageStickerContext.Provider
      value={{
        state,
        config,
        setProcessing,
        setOriginalImage,
        setStickerVersion,
      }}
    >
      {children}
    </ImageStickerContext.Provider>
  );
};

export const useImageSticker = () => {
  const context = useContext(ImageStickerContext);
  if (context === undefined) {
    throw new Error('useImageSticker must be used within a ImageStickerProvider');
  }
  return context;
};
