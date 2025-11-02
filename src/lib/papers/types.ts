// Paper Management Types
// Ported from Open Paper's working models

export type PaperStatus = 'processing' | 'completed' | 'failed';

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple';

export type ConversationContextType = 'paper' | 'project' | 'library';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Paper {
  id: string;
  user_id: string;
  title: string;
  authors: string[] | null;
  abstract: string | null;
  pdf_url: string | null;
  storage_path: string | null;
  preview_image_url: string | null;
  total_pages: number;
  size_kb: number | null;
  status: PaperStatus;
  processing_error: string | null;
  metadata: PaperMetadata;
  last_accessed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaperMetadata {
  keywords?: string[];
  institutions?: string[];
  doi?: string;
  year?: number;
  journal?: string;
  citations?: number;
  url?: string;
  [key: string]: any; // Flexible for additional fields
}

export interface PaperHighlight {
  id: string;
  paper_id: string;
  user_id: string;
  page_number: number;
  text_content: string;
  position: HighlightPosition;
  color: HighlightColor;
  created_at: string;
  updated_at: string;
}

export interface HighlightPosition {
  rects: HighlightRect[];
  pageIndex: number;
  boundingRect: HighlightRect;
}

export interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber?: number;
}

export interface PaperAnnotation {
  id: string;
  highlight_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface PaperConversation {
  id: string;
  paper_id: string | null;
  user_id: string;
  title: string | null;
  context_type: ConversationContextType;
  context_ids: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface PaperMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: MessageRole;
  content: string;
  citations: Citation[] | null;
  model: string | null;
  created_at: string;
}

export interface Citation {
  page: number;
  text: string;
  confidence: number;
  paper_id?: string;
  paper_title?: string;
}

export interface PaperProject {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectPaper {
  id: string;
  project_id: string;
  paper_id: string;
  notes: string | null;
  position: number | null;
  added_at: string;
}

export interface PaperNote {
  id: string;
  paper_id: string;
  user_id: string;
  content: string;
  page_number: number | null;
  created_at: string;
  updated_at: string;
}

// Extended types with joins
export interface PaperWithDetails extends Paper {
  highlights?: PaperHighlight[];
  annotations?: PaperAnnotation[];
  conversations?: PaperConversation[];
  projects?: PaperProject[];
  notes?: PaperNote[];
}

export interface HighlightWithAnnotations extends PaperHighlight {
  annotations: PaperAnnotation[];
}

export interface ProjectWithPapers extends PaperProject {
  papers: Paper[];
  paper_count: number;
}

// API Request/Response types
export interface CreatePaperRequest {
  title: string;
  file: File;
}

export interface CreateHighlightRequest {
  paper_id: string;
  page_number: number;
  text_content: string;
  position: HighlightPosition;
  color?: HighlightColor;
}

export interface CreateAnnotationRequest {
  highlight_id: string;
  content: string;
}

export interface CreateConversationRequest {
  paper_id?: string;
  context_type?: ConversationContextType;
  context_ids?: string[];
}

export interface SendMessageRequest {
  conversation_id: string;
  content: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  color?: string;
}

export interface AddPaperToProjectRequest {
  project_id: string;
  paper_id: string;
  notes?: string;
}

export interface SearchPapersRequest {
  query: string;
  limit?: number;
  offset?: number;
}

export interface SearchPapersResponse {
  papers: Paper[];
  total: number;
  query: string;
}

// Upload progress tracking
export interface UploadProgress {
  paper_id: string;
  status: PaperStatus;
  progress: number; // 0-100
  current_step: string;
  error?: string;
}

// Streaming message chunk
export interface MessageChunk {
  type: 'content' | 'citation' | 'done' | 'error';
  content?: string;
  citation?: Citation;
  error?: string;
}

