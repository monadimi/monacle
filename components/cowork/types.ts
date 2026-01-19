export interface SlideElement {
  id: string;
  type: 'text' | 'shape' | 'image' | 'code' | 'stat';
  x: number;
  y: number;
  w: number;
  h: number;
  content?: string;
  src?: string; // For images
  settings?: any;
  style?: React.CSSProperties & {
    fillType?: 'solid' | 'gradient',
    fillGradient?: string
  };
  animation?: {
    type: 'none' | 'fade-in' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'scale-up' | 'pop';
    duration: number;
    delay: number;
  };
}

export interface Slide {
  id: string;
  elements: SlideElement[];
  background: { type: 'solid' | 'gradient' | 'image', value: string };
  notes?: string;
  layout: 'blank' | 'title' | 'image-left' | 'bullets';
}

export interface DeckData {
  id: string;
  title: string;
  slides: Slide[];
  theme_config: any;
  author: string;
  is_shared: boolean;
  share_type: string;
}
