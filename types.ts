export interface Chapter {
  id: string;
  title: string;
  content: string; // Markdown content
  memo?: string;   // Chapter notes/scratchpad (not exported)
  order: number;
}

export interface BookMetadata {
  title: string;
  author: string;
  publisher?: string;
  description?: string;
  language: string;
  coverData?: string; // Base64 data url
  coverMimeType?: string;
  isbn?: string;
  tags?: string[];
}

export interface Snapshot {
  id: string;
  timestamp: number;
  content: string;
  chapterId: string;
  description: string;
}

export interface PreviewConfig {
  viewMode: 'mobile' | 'desktop' | 'a4';
  fontSize: number;
  lineHeight: number;
  indent: number;
}

export type ViewMode = 'editor' | 'preview' | 'split';
