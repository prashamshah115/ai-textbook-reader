// LocalStorage Paper Management
// Based on OpenPaper's proven client-side architecture
// No Supabase DB - everything in browser localStorage

import type { Paper, PaperHighlight, PaperAnnotation, PaperConversation, PaperMessage, PaperNote } from './types';

const STORAGE_KEYS = {
  PAPERS: 'openpaper_papers',
  HIGHLIGHTS: 'openpaper_highlights',
  ANNOTATIONS: 'openpaper_annotations',
  CONVERSATIONS: 'openpaper_conversations',
  MESSAGES: 'openpaper_messages',
  NOTES: 'openpaper_notes',
};

// ============================================
// PAPERS
// ============================================

export function savePaper(paper: Paper): void {
  const papers = getAllPapers();
  const index = papers.findIndex(p => p.id === paper.id);
  
  if (index >= 0) {
    papers[index] = paper;
  } else {
    papers.push(paper);
  }
  
  localStorage.setItem(STORAGE_KEYS.PAPERS, JSON.stringify(papers));
  console.log('[localStorage] Saved paper:', paper.id);
}

export function getAllPapers(): Paper[] {
  const stored = localStorage.getItem(STORAGE_KEYS.PAPERS);
  return stored ? JSON.parse(stored) : [];
}

export function getPaper(paperId: string): Paper | null {
  const papers = getAllPapers();
  return papers.find(p => p.id === paperId) || null;
}

export function deletePaper(paperId: string): void {
  const papers = getAllPapers();
  const filtered = papers.filter(p => p.id !== paperId);
  localStorage.setItem(STORAGE_KEYS.PAPERS, JSON.stringify(filtered));
  
  // Also delete related data
  deleteHighlightsForPaper(paperId);
  deleteConversationsForPaper(paperId);
  deleteNotesForPaper(paperId);
}

export function updatePaper(paperId: string, updates: Partial<Paper>): Paper | null {
  const paper = getPaper(paperId);
  if (!paper) return null;
  
  const updated = { ...paper, ...updates, updated_at: new Date().toISOString() };
  savePaper(updated);
  return updated;
}

// ============================================
// HIGHLIGHTS
// ============================================

export function saveHighlight(highlight: PaperHighlight): void {
  const highlights = getAllHighlights();
  const index = highlights.findIndex(h => h.id === highlight.id);
  
  if (index >= 0) {
    highlights[index] = highlight;
  } else {
    highlights.push(highlight);
  }
  
  localStorage.setItem(STORAGE_KEYS.HIGHLIGHTS, JSON.stringify(highlights));
}

export function getAllHighlights(): PaperHighlight[] {
  const stored = localStorage.getItem(STORAGE_KEYS.HIGHLIGHTS);
  return stored ? JSON.parse(stored) : [];
}

export function getHighlightsForPaper(paperId: string): PaperHighlight[] {
  return getAllHighlights().filter(h => h.paper_id === paperId);
}

export function deleteHighlight(highlightId: string): void {
  const highlights = getAllHighlights();
  const filtered = highlights.filter(h => h.id !== highlightId);
  localStorage.setItem(STORAGE_KEYS.HIGHLIGHTS, JSON.stringify(filtered));
  
  // Also delete related annotations
  deleteAnnotationsForHighlight(highlightId);
}

function deleteHighlightsForPaper(paperId: string): void {
  const highlights = getAllHighlights();
  const filtered = highlights.filter(h => h.paper_id !== paperId);
  localStorage.setItem(STORAGE_KEYS.HIGHLIGHTS, JSON.stringify(filtered));
}

// ============================================
// ANNOTATIONS
// ============================================

export function saveAnnotation(annotation: PaperAnnotation): void {
  const annotations = getAllAnnotations();
  const index = annotations.findIndex(a => a.id === annotation.id);
  
  if (index >= 0) {
    annotations[index] = annotation;
  } else {
    annotations.push(annotation);
  }
  
  localStorage.setItem(STORAGE_KEYS.ANNOTATIONS, JSON.stringify(annotations));
}

export function getAllAnnotations(): PaperAnnotation[] {
  const stored = localStorage.getItem(STORAGE_KEYS.ANNOTATIONS);
  return stored ? JSON.parse(stored) : [];
}

export function getAnnotationsForHighlight(highlightId: string): PaperAnnotation[] {
  return getAllAnnotations().filter(a => a.highlight_id === highlightId);
}

export function deleteAnnotation(annotationId: string): void {
  const annotations = getAllAnnotations();
  const filtered = annotations.filter(a => a.id !== annotationId);
  localStorage.setItem(STORAGE_KEYS.ANNOTATIONS, JSON.stringify(filtered));
}

function deleteAnnotationsForHighlight(highlightId: string): void {
  const annotations = getAllAnnotations();
  const filtered = annotations.filter(a => a.highlight_id !== highlightId);
  localStorage.setItem(STORAGE_KEYS.ANNOTATIONS, JSON.stringify(filtered));
}

// ============================================
// CONVERSATIONS
// ============================================

export function saveConversation(conversation: PaperConversation): void {
  const conversations = getAllConversations();
  const index = conversations.findIndex(c => c.id === conversation.id);
  
  if (index >= 0) {
    conversations[index] = conversation;
  } else {
    conversations.push(conversation);
  }
  
  localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations));
}

export function getAllConversations(): PaperConversation[] {
  const stored = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
  return stored ? JSON.parse(stored) : [];
}

export function getConversationsForPaper(paperId: string): PaperConversation[] {
  return getAllConversations().filter(c => c.paper_id === paperId);
}

export function deleteConversation(conversationId: string): void {
  const conversations = getAllConversations();
  const filtered = conversations.filter(c => c.id !== conversationId);
  localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(filtered));
  
  // Also delete messages
  deleteMessagesForConversation(conversationId);
}

function deleteConversationsForPaper(paperId: string): void {
  const conversations = getAllConversations();
  const filtered = conversations.filter(c => c.paper_id !== paperId);
  localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(filtered));
}

// ============================================
// MESSAGES
// ============================================

export function saveMessage(message: PaperMessage): void {
  const messages = getAllMessages();
  messages.push(message);
  localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
}

export function getAllMessages(): PaperMessage[] {
  const stored = localStorage.getItem(STORAGE_KEYS.MESSAGES);
  return stored ? JSON.parse(stored) : [];
}

export function getMessagesForConversation(conversationId: string): PaperMessage[] {
  return getAllMessages().filter(m => m.conversation_id === conversationId);
}

function deleteMessagesForConversation(conversationId: string): void {
  const messages = getAllMessages();
  const filtered = messages.filter(m => m.conversation_id !== conversationId);
  localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(filtered));
}

// ============================================
// NOTES
// ============================================

export function saveNote(note: PaperNote): void {
  const notes = getAllNotes();
  const index = notes.findIndex(n => n.id === note.id);
  
  if (index >= 0) {
    notes[index] = note;
  } else {
    notes.push(note);
  }
  
  localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
}

export function getAllNotes(): PaperNote[] {
  const stored = localStorage.getItem(STORAGE_KEYS.NOTES);
  return stored ? JSON.parse(stored) : [];
}

export function getNotesForPaper(paperId: string): PaperNote[] {
  return getAllNotes().filter(n => n.paper_id === paperId);
}

export function deleteNote(noteId: string): void {
  const notes = getAllNotes();
  const filtered = notes.filter(n => n.id !== noteId);
  localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(filtered));
}

function deleteNotesForPaper(paperId: string): void {
  const notes = getAllNotes();
  const filtered = notes.filter(n => n.paper_id !== paperId);
  localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(filtered));
}

// ============================================
// UTILITY
// ============================================

export function clearAllData(): void {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
  console.log('[localStorage] All paper data cleared');
}

export function exportData(): string {
  const data = {
    papers: getAllPapers(),
    highlights: getAllHighlights(),
    annotations: getAllAnnotations(),
    conversations: getAllConversations(),
    messages: getAllMessages(),
    notes: getAllNotes(),
  };
  return JSON.stringify(data, null, 2);
}

export function importData(jsonString: string): void {
  try {
    const data = JSON.parse(jsonString);
    
    if (data.papers) localStorage.setItem(STORAGE_KEYS.PAPERS, JSON.stringify(data.papers));
    if (data.highlights) localStorage.setItem(STORAGE_KEYS.HIGHLIGHTS, JSON.stringify(data.highlights));
    if (data.annotations) localStorage.setItem(STORAGE_KEYS.ANNOTATIONS, JSON.stringify(data.annotations));
    if (data.conversations) localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(data.conversations));
    if (data.messages) localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(data.messages));
    if (data.notes) localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(data.notes));
    
    console.log('[localStorage] Data imported successfully');
  } catch (error) {
    console.error('[localStorage] Import failed:', error);
    throw error;
  }
}

