
export enum AppState {
  Configuration,
  Crawling,
  Results,
}

export enum AIProvider {
  Gemini = 'Google Gemini',
  DallE3 = 'OpenAI DALL-E 3',
  Stability = 'Stability AI',
  OpenRouter = 'OpenRouter',
  Pollinations = 'Pollinations.ai (Free)',
}

// New: Enum for text/content analysis providers
export enum TextAIProvider {
  Gemini = 'Google Gemini',
  OpenAI = 'OpenAI',
  Groq = 'Groq',
  OpenRouter = 'OpenRouter',
}

export enum ImageFormat {
  WebP = 'image/webp',
  JPEG = 'image/jpeg',
  PNG = 'image/png',
}

export enum AspectRatio {
  Landscape = '16:9',
  Square = '1:1',
  Portrait = '9:16',
}

export interface WordPressCredentials {
  url: string;
  username: string;
  appPassword?: string;
}

export interface ImageSettings {
  format: ImageFormat;
  quality: number;
  aspectRatio: AspectRatio;
  style: string;
  negativePrompt: string;
}

// New: Configuration for the content analysis AI
export interface AnalysisAIConfig {
  provider: TextAIProvider;
  apiKey?: string;
  model?: string;
}

export interface Configuration {
  wordpress: WordPressCredentials;
  ai: {
    provider: AIProvider;
    analysis: AnalysisAIConfig; // New: Added analysis provider config
  };
  image: ImageSettings;
}

export interface WordPressPost {
  id: number;
  title: {
    rendered: string;
  };
  link: string;
  excerpt: {
    rendered: string;
  };
  content: {
    rendered: string;
  };
  featured_media: number;
  imageCount: number;
  existingImageUrl?: string;
  existingImageAltText?: string;
  generatedImage?: {
    url: string;
    alt: string;
    mediaId: number;
    brief?: string;
  };
  analysis?: {
    score: number;
    altText: string;
    brief: string;
  };
  contentWithPlaceholder?: string;
  status?: 'idle' | 'pending' | 'generating_brief' | 'analyzing_placement' | 'generating_image' | 'uploading' | 'inserting' | 'setting_featured' | 'updating_meta' | 'analyzing' | 'analysis_success' | 'success' | 'error';
  statusMessage?: string;
}

export interface CrawlProgress {
  current: number;
  total: number;
}