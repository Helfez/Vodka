export interface PhotoStyle {
  border: {
    width: number;
    color: string;
  };
  shadow: {
    blur: number;
    spread: number;
    color: string;
  };
  background: {
    color: string;
  };
}

export interface PhotoAnimation {
  initial: {
    scale: number;
    opacity: number;
    rotation: number;
  };
  final: {
    scale: number;
    opacity: number;
    rotation: number;
  };
  duration: number;
  easing: 'easeInQuad' | 'easeOutQuad' | 'easeInOutQuad' | 
    'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic' | 
    'easeInQuart' | 'easeOutQuart' | 'easeInOutQuart' | 
    'easeInQuint' | 'easeOutQuint' | 'easeInOutQuint' | 
    'easeInSine' | 'easeOutSine' | 'easeInOutSine' | 
    'easeInExpo' | 'easeOutExpo' | 'easeInOutExpo' | 
    'easeInCirc' | 'easeOutCirc' | 'easeInOutCirc' | 
    'easeInElastic' | 'easeOutElastic' | 'easeInOutElastic' | 
    'easeInBack' | 'easeOutBack' | 'easeInOutBack' | 
    'easeInBounce' | 'easeOutBounce' | 'easeInOutBounce';
}

export interface PhotoEffectOptions {
  style: PhotoStyle;
  animation: PhotoAnimation;
}
