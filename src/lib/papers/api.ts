// Paper API Client
// Based on Open Paper's proven API patterns, adapted for Supabase + Vercel Blob

import { supabase } from '../supabase';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

import type {
  Paper,
  PaperHighlight,
  PaperAnnotation,
  PaperConversation,
  PaperMessage,
  PaperProject,
  ProjectPaper,
  PaperNote,
  CreateHighlightRequest,
  CreateAnnotationRequest,
  CreateConversationRequest,
  SendMessageRequest,
  CreateProjectRequest,
  AddPaperToProjectRequest,
  SearchPapersResponse,
  UploadProgress,
} from './types';

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

  // Create paper record in Supabase DB
  console.log('5️⃣ [uploadPaper] Creating database record...');
  const { data, error } = await supabase
    .from('papers')
    .insert({
      user_id: userId,
      title: title || file.name.replace('.pdf', ''),
      storage_path: fileName,
      pdf_url: blobUrl,
      status: 'processing',
      size_kb: Math.round(file.size / 1024),
    })
    .select()
    .single();

  if (error) {
    console.error('❌ [uploadPaper] Database insert failed:', error);
    throw error;
  }
  
  console.log('6️⃣ [uploadPaper] Paper record created:', data.id);

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
    const { error: updateError } = await supabase
      .from('papers')
      .update({
        status: 'completed',
        total_pages: pdf.numPages,
        metadata: { pages }
      })
      .eq('id', data.id);
    
    if (updateError) {
      console.error('❌ Update failed:', updateError);
      throw updateError;
    }
    
    console.log('✅ [uploadPaper] COMPLETE! Paper ID:', data.id);
    return { paper_id: data.id };
    
  } catch (extractError: any) {
    console.error('❌ Text extraction failed:', extractError);
    
    // Mark as failed
    await supabase
      .from('papers')
      .update({ status: 'failed' })
      .eq('id', data.id);
    
    throw new Error(`Text extraction failed: ${extractError.message}`);
  }
}

export async function getPaper(paperId: string): Promise<Paper> {
  const { data, error } = await supabase
    .from('papers')
    .select('*')
    .eq('id', paperId)
    .single();

  if (error) throw error;

  // Update last_accessed_at
  supabase
    .from('papers')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('id', paperId)
    .then();

  return data;
}

export async function listPapers(limit = 50, offset = 0): Promise<Paper[]> {
  const { data, error } = await supabase
    .from('papers')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data;
}

export async function updatePaper(
  paperId: string,
  updates: Partial<Paper>
): Promise<Paper> {
  const { data, error } = await supabase
    .from('papers')
    .update(updates)
    .eq('id', paperId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletePaper(paperId: string): Promise<void> {
  // First, delete from storage
  const { data: paper } = await supabase
    .from('papers')
    .select('storage_path')
    .eq('id', paperId)
    .single();

  if (paper?.storage_path) {
    await supabase.storage.from('papers').remove([paper.storage_path]);
  }

  // Then delete from database (cascades to related data)
  const { error } = await supabase.from('papers').delete().eq('id', paperId);

  if (error) throw error;
}

export async function searchPapers(
  query: string,
  limit = 20
): Promise<SearchPapersResponse> {
  // Use PostgreSQL full-text search
  const { data, error } = await supabase.rpc('search_papers', {
    search_query: query,
    user_uuid: (await supabase.auth.getSession()).data.session?.user.id,
  });

  if (error) throw error;

  return {
    papers: data || [],
    total: data?.length || 0,
    query,
  };
}

// ============================================
// HIGHLIGHTS
// ============================================

export async function createHighlight(
  request: CreateHighlightRequest
): Promise<PaperHighlight> {
  const { data, error } = await supabase
    .from('paper_highlights')
    .insert({
      paper_id: request.paper_id,
      page_number: request.page_number,
      text_content: request.text_content,
      position: request.position,
      color: request.color || 'yellow',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getHighlights(paperId: string): Promise<PaperHighlight[]> {
  const { data, error } = await supabase
    .from('paper_highlights')
    .select('*')
    .eq('paper_id', paperId)
    .order('page_number', { ascending: true });

  if (error) throw error;
  return data;
}

export async function updateHighlight(
  highlightId: string,
  updates: Partial<PaperHighlight>
): Promise<PaperHighlight> {
  const { data, error } = await supabase
    .from('paper_highlights')
    .update(updates)
    .eq('id', highlightId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteHighlight(highlightId: string): Promise<void> {
  const { error } = await supabase
    .from('paper_highlights')
    .delete()
    .eq('id', highlightId);

  if (error) throw error;
}

// ============================================
// ANNOTATIONS
// ============================================

export async function createAnnotation(
  request: CreateAnnotationRequest
): Promise<PaperAnnotation> {
  const { data, error } = await supabase
    .from('paper_annotations')
    .insert({
      highlight_id: request.highlight_id,
      content: request.content,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getAnnotations(highlightId: string): Promise<PaperAnnotation[]> {
  const { data, error } = await supabase
    .from('paper_annotations')
    .select('*')
    .eq('highlight_id', highlightId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

export async function updateAnnotation(
  annotationId: string,
  content: string
): Promise<PaperAnnotation> {
  const { data, error } = await supabase
    .from('paper_annotations')
    .update({ content })
    .eq('id', annotationId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAnnotation(annotationId: string): Promise<void> {
  const { error } = await supabase
    .from('paper_annotations')
    .delete()
    .eq('id', annotationId);

  if (error) throw error;
}

// ============================================
// CONVERSATIONS & MESSAGES
// ============================================

export async function createConversation(
  request: CreateConversationRequest
): Promise<PaperConversation> {
  const { data, error } = await supabase
    .from('paper_conversations')
    .insert({
      paper_id: request.paper_id || null,
      context_type: request.context_type || 'paper',
      context_ids: request.context_ids || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getConversation(
  conversationId: string
): Promise<PaperConversation> {
  const { data, error } = await supabase
    .from('paper_conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (error) throw error;
  return data;
}

export async function listConversations(paperId?: string): Promise<PaperConversation[]> {
  let query = supabase
    .from('paper_conversations')
    .select('*')
    .order('updated_at', { ascending: false });

  if (paperId) {
    query = query.eq('paper_id', paperId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

export async function getMessages(conversationId: string): Promise<PaperMessage[]> {
  const { data, error } = await supabase
    .from('paper_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

export async function sendMessage(
  request: SendMessageRequest
): Promise<ReadableStream> {
  // This calls the streaming API endpoint
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  const response = await fetch('/api/papers/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Chat API error: ${response.statusText}`);
  }

  return response.body!;
}

// ============================================
// PROJECTS
// ============================================

export async function createProject(
  request: CreateProjectRequest
): Promise<PaperProject> {
  const { data, error } = await supabase
    .from('paper_projects')
    .insert({
      name: request.name,
      description: request.description || null,
      color: request.color || '#3b82f6',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function listProjects(): Promise<PaperProject[]> {
  const { data, error } = await supabase
    .from('paper_projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getProject(projectId: string): Promise<PaperProject> {
  const { data, error } = await supabase
    .from('paper_projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (error) throw error;
  return data;
}

export async function updateProject(
  projectId: string,
  updates: Partial<PaperProject>
): Promise<PaperProject> {
  const { data, error } = await supabase
    .from('paper_projects')
    .update(updates)
    .eq('id', projectId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProject(projectId: string): Promise<void> {
  const { error } = await supabase
    .from('paper_projects')
    .delete()
    .eq('id', projectId);

  if (error) throw error;
}

export async function addPaperToProject(
  request: AddPaperToProjectRequest
): Promise<ProjectPaper> {
  const { data, error } = await supabase
    .from('project_papers')
    .insert({
      project_id: request.project_id,
      paper_id: request.paper_id,
      notes: request.notes || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removePaperFromProject(
  projectId: string,
  paperId: string
): Promise<void> {
  const { error } = await supabase
    .from('project_papers')
    .delete()
    .eq('project_id', projectId)
    .eq('paper_id', paperId);

  if (error) throw error;
}

export async function getProjectPapers(projectId: string): Promise<Paper[]> {
  const { data, error } = await supabase
    .from('project_papers')
    .select('paper_id, papers(*)')
    .eq('project_id', projectId);

  if (error) throw error;
  return data.map((item: any) => item.papers);
}

// ============================================
// NOTES
// ============================================

export async function createNote(
  paperId: string,
  content: string,
  pageNumber?: number
): Promise<PaperNote> {
  const { data, error } = await supabase
    .from('paper_notes')
    .insert({
      paper_id: paperId,
      content,
      page_number: pageNumber || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getNotes(paperId: string): Promise<PaperNote[]> {
  const { data, error } = await supabase
    .from('paper_notes')
    .select('*')
    .eq('paper_id', paperId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function updateNote(noteId: string, content: string): Promise<PaperNote> {
  const { data, error } = await supabase
    .from('paper_notes')
    .update({ content })
    .eq('id', noteId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteNote(noteId: string): Promise<void> {
  const { error } = await supabase.from('paper_notes').delete().eq('id', noteId);

  if (error) throw error;
}

// ============================================
// REAL-TIME SUBSCRIPTIONS
// ============================================

export function subscribeToPaperUpdates(
  paperId: string,
  callback: (paper: Paper) => void
) {
  return supabase
    .channel(`paper:${paperId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'papers',
        filter: `id=eq.${paperId}`,
      },
      (payload) => {
        callback(payload.new as Paper);
      }
    )
    .subscribe();
}

export function subscribeToHighlights(
  paperId: string,
  callback: (highlight: PaperHighlight) => void
) {
  return supabase
    .channel(`highlights:${paperId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'paper_highlights',
        filter: `paper_id=eq.${paperId}`,
      },
      (payload) => {
        callback(payload.new as PaperHighlight);
      }
    )
    .subscribe();
}

