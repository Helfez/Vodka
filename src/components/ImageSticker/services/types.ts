import * as fabric from 'fabric';
import { Canvas, Image, Object as FabricObject } from 'fabric/fabric-impl';

export interface StickerState {
  isProcessing: boolean;
  originalImage: Image | null;
  stickerVersion: FabricObject | null;
}

export interface StickerConfig {
  enabled: boolean;
  apiEndpoint?: string;
}

export interface StickerResponse {
  coordinates: Array<{x: number; y: number}>;
  confidence: number;
  description: string;
}

export interface FloatingButtonPosition {
  x: number;
  y: number;
  target: Image;
}
