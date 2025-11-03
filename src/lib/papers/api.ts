// Simplified Paper API - LocalStorage Only
// Based on OpenPaper's client-side architecture

import * as pdfjsLib from 'pdfjs-dist';
import * as storage from './localStorage';
import type {
  Paper,
  PaperHighlight,
  PaperAnnotation,
  PaperConversation,
  PaperMessage,
  PaperNote,
  CreateHighlightRequest,
  CreateAnnotationRequest,
  CreateConversationRequest,
  SendMessageRequest,
  SearchPapersResponse,
} from './types';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// ============================================
// PAPERS
// ============================================

export async function uploadPaper(file: File, userId: string, title?: string): Promise<{ paper_id: string }> {
  console.log('1️⃣ [uploadPaper] Starting...', { fileName: file.name, size: file.size, userId });
  
  const fileId = crypto.randomUUID();
  const fileName = `papers/${userId}/${Date.now()}_${file.name}`;
  console.log('2️⃣ [uploadPaper] Will upload to Vercel Blob:', fileName);

  // Upload to Vercel Blob using REST API directly
  console.log('3️⃣ [uploadPaper] Uploading to Vercel Blob...');
  const blobToken = import.meta.env.VITE_BLOB_READ_WRITE_TOKEN;
  
  if (!blobToken) {
    throw new Error('VITE_BLOB_READ_WRITE_TOKEN not set in .env');
  }

  const uploadResponse = await fetch(
    `https://blob.vercel-storage.com/${fileName}`,
    {
      method: 'PUT',
      body: file,
      headers: {
        'x-content-type': 'application/pdf',
        'authorization': `Bearer ${blobToken}`,
      },
    }
  );

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    console.error('❌ [uploadPaper] Blob upload failed:', uploadResponse.status, errorText);
    throw new Error(`Blob upload failed: ${uploadResponse.statusText}`);
  }

  const { url: blobUrl } = await uploadResponse.json();
  console.log('4️⃣ [uploadPaper] Vercel Blob upload SUCCESS:', blobUrl);

  // Create paper record in localStorage
  console.log('5️⃣ [uploadPaper] Creating paper record in localStorage...');
  
  const paperId = crypto.randomUUID();
  const paper: Paper = {
    id: paperId,
    user_id: userId,
    title: title || file.name.replace('.pdf', ''),
    storage_path: fileName,
    pdf_url: blobUrl,
    status: 'processing',
    size_kb: Math.round(file.size / 1024),
    total_pages: 0,
    authors: null,
    abstract: null,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_accessed_at: null,
  };
  
  console.log('6️⃣ [uploadPaper] Paper created:', paperId);

  // Extract text CLIENT-SIDE using PDF.js
  try {
    console.log('7️⃣ [uploadPaper] Extracting text from PDF...');
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    console.log(`📄 PDF has ${pdf.numPages} pages`);
    
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      pages.push({
        page_number: i,
        text: text,
        word_count: text.split(/\s+/).filter(w => w.length > 0).length
      });
      
      console.log(`✅ Extracted page ${i}/${pdf.numPages}`);
    }
    
    // Update paper with extracted data
    paper.status = 'completed';
    paper.total_pages = pdf.numPages;
    paper.metadata = { pages };
    
    storage.savePaper(paper);
    
    console.log('✅ [uploadPaper] COMPLETE! Paper ID:', paperId);
    return { paper_id: paperId };
    
  } catch (extractError: any) {
    console.error('❌ Text extraction failed:', extractError);
    
    // Mark as failed
    paper.status = 'failed';
    storage.savePaper(paper);
    
    throw new Error(`Text extraction failed: ${extractError.message}`);
  }
}

export async function getPaper(paperId: string): Promise<Paper> {
  const paper = storage.getPaper(paperId);
  
  if (!paper) {
    throw new Error('Paper not found');
  }

  // Update last_accessed_at
  storage.updatePaper(paperId, {
    last_accessed_at: new Date().toISOString()
  });

  return paper;
}

export async function listPapers(limit = 50, offset = 0): Promise<Paper[]> {
  const papers = storage.getAllPapers();
  
  // Sort by created_at descending
  const sorted = papers.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  
  return sorted.slice(offset, offset + limit);
}

export async function updatePaper(paperId: string, updates: Partial<Paper>): Promise<Paper> {
  const updated = storage.updatePaper(paperId, updates);
  
  if (!updated) {
    throw new Error('Paper not found');
  }
  
  return updated;
}

export async function deletePaper(paperId: string): Promise<void> {
  storage.deletePaper(paperId);
}

export async function searchPapers(query: string, limit = 20): Promise<SearchPapersResponse> {
  const papers = storage.getAllPapers();
  const searchLower = query.toLowerCase();
  
  const results = papers.filter(paper => 
    paper.title.toLowerCase().includes(searchLower) ||
    paper.authors?.toLowerCase().includes(searchLower) ||
    paper.abstract?.toLowerCase().includes(searchLower)
  );
  
  return {
    papers: results.slice(0, limit),
    total_count: results.length,
  };
}

// ============================================
// HIGHLIGHTS
// ============================================

export async function createHighlight(request: CreateHighlightRequest): Promise<PaperHighlight> {
  const highlight: PaperHighlight = {
    id: crypto.randomUUID(),
    ...request,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  storage.saveHighlight(highlight);
  return highlight;
}

export async function getHighlights(paperId: string): Promise<PaperHighlight[]> {
  return storage.getHighlightsForPaper(paperId);
}

export async function updateHighlight(highlightId: string, updates: Partial<PaperHighlight>): Promise<PaperHighlight> {
  const highlights = storage.getAllHighlights();
  const highlight = highlights.find(h => h.id === highlightId);
  
  if (!highlight) throw new Error('Highlight not found');
  
  const updated = { ...highlight, ...updates, updated_at: new Date().toISOString() };
  storage.saveHighlight(updated);
  return updated;
}

export async function deleteHighlight(highlightId: string): Promise<void> {
  storage.deleteHighlight(highlightId);
}

// ============================================
// ANNOTATIONS
// ============================================

export async function createAnnotation(request: CreateAnnotationRequest): Promise<PaperAnnotation> {
  const annotation: PaperAnnotation = {
    id: crypto.randomUUID(),
    user_id: '', // Will be set by context
    ...request,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  storage.saveAnnotation(annotation);
  return annotation;
}

export async function getAnnotations(highlightId: string): Promise<PaperAnnotation[]> {
  return storage.getAnnotationsForHighlight(highlightId);
}

export async function updateAnnotation(annotationId: string, content: string): Promise<PaperAnnotation> {
  const annotations = storage.getAllAnnotations();
  const annotation = annotations.find(a => a.id === annotationId);
  
  if (!annotation) throw new Error('Annotation not found');
  
  const updated = { ...annotation, content, updated_at: new Date().toISOString() };
  storage.saveAnnotation(updated);
  return updated;
}

export async function deleteAnnotation(annotationId: string): Promise<void> {
  storage.deleteAnnotation(annotationId);
}

// ============================================
// CONVERSATIONS & CHAT
// ============================================

export async function createConversation(request: CreateConversationRequest): Promise<PaperConversation> {
  const conversation: PaperConversation = {
    id: crypto.randomUUID(),
    user_id: '', // Will be set by context
    ...request,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  storage.saveConversation(conversation);
  return conversation;
}

export async function getConversation(conversationId: string): Promise<PaperConversation> {
  const conversations = storage.getAllConversations();
  const conversation = conversations.find(c => c.id === conversationId);
  
  if (!conversation) throw new Error('Conversation not found');
  
  return conversation;
}

export async function listConversations(paperId?: string): Promise<PaperConversation[]> {
  if (paperId) {
    return storage.getConversationsForPaper(paperId);
  }
  return storage.getAllConversations();
}

export async function getMessages(conversationId: string): Promise<PaperMessage[]> {
  return storage.getMessagesForConversation(conversationId);
}

export async function sendMessage(request: SendMessageRequest): Promise<{ message_id: string }> {
  const message: PaperMessage = {
    id: crypto.randomUUID(),
    ...request,
    created_at: new Date().toISOString(),
  };
  
  storage.saveMessage(message);
  return { message_id: message.id };
}

// ============================================
// NOTES
// ============================================

export async function createNote(paperId: string, content: string, userId: string): Promise<PaperNote> {
  const note: PaperNote = {
    id: crypto.randomUUID(),
    paper_id: paperId,
    user_id: userId,
    content,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  storage.saveNote(note);
  return note;
}

export async function getNotes(paperId: string): Promise<PaperNote[]> {
  return storage.getNotesForPaper(paperId);
}

export async function updateNote(noteId: string, content: string): Promise<PaperNote> {
  const notes = storage.getAllNotes();
  const note = notes.find(n => n.id === noteId);
  
  if (!note) throw new Error('Note not found');
  
  const updated = { ...note, content, updated_at: new Date().toISOString() };
  storage.saveNote(updated);
  return updated;
}

export async function deleteNote(noteId: string): Promise<void> {
  storage.deleteNote(noteId);
}

// ============================================
// REALTIME SUBSCRIPTIONS (Mocked for localStorage)
// ============================================

export function subscribeToPaperUpdates(
  paperId: string,
  callback: (paper: Paper) => void
): { unsubscribe: () => void } {
  // Poll for changes
  const interval = setInterval(() => {
    const paper = storage.getPaper(paperId);
    if (paper) {
      callback(paper);
    }
  }, 1000);

  return {
    unsubscribe: () => clearInterval(interval),
  };
}

