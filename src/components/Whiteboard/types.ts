import type { Object as FabricObject } from 'fabric/fabric-impl';

export interface DrawingState {
  objects: FabricObject[];
  timestamp: number;
}
