export interface SupportedImageFormat {
  mime: string;
  extension: string;
  description: string;
}

export const SUPPORTED_FORMATS: SupportedImageFormat[] = [
  {
    mime: 'image/webp',
    extension: '.webp',
    description: 'WebP Image'
  },
  {
    mime: 'image/jpeg',
    extension: '.jpg',
    description: 'JPEG Image'
  },
  {
    mime: 'image/png',
    extension: '.png',
    description: 'PNG Image'
  }
];
