# Research Paper Management Migration Plan

## Overview

This document outlines the migration of **all paper management features** from the Open Paper project into the AI Textbook Reader Design project.

---

## Architecture Comparison

### Open Paper (Source)
- **Frontend**: Next.js 15 + React + TypeScript
- **Backend**: FastAPI (Python) + PostgreSQL
- **Auth**: Google OAuth + Session cookies
- **Storage**: S3/CloudFlare R2
- **AI**: OpenAI GPT-4 + Google Gemini
- **PDF Processing**: Celery workers (async jobs)

### AI Textbook Reader (Target)
- **Frontend**: Vite + React + TypeScript
- **Backend**: Supabase (PostgreSQL + serverless functions)
- **Auth**: Supabase Auth (already using whitelist)
- **Storage**: Supabase Storage
- **AI**: Groq (Llama), Anthropic Claude
- **PDF Processing**: Vercel serverless functions + Railway workers

---

## Key Differences & Adaptation Strategy

| Feature | Open Paper | AI Textbook Reader | Migration Strategy |
|---------|-----------|-------------------|-------------------|
| **Database** | FastAPI + SQLAlchemy | Supabase + Direct SQL | Convert models to Supabase schema |
| **API Routes** | FastAPI endpoints | Vercel API routes | Convert Python to TypeScript |
| **Auth** | Custom session management | Supabase Auth | Use existing Supabase auth |
| **File Upload** | Direct to S3 | Supabase Storage | Adapt to Supabase Storage API |
| **Real-time** | Polling | Supabase Realtime | Use Supabase subscriptions |
| **PDF Processing** | Celery + RabbitMQ | Already has extraction | Enhance existing system |

---

## Features to Migrate

### 1. ✅ Paper Upload & Processing
**From Open Paper:**
- Multi-file PDF upload
- S3 storage integration
- Background processing with Celery
- Metadata extraction (title, authors, abstract)
- Preview image generation
- Status tracking (processing → complete)

**Adaptation:**
- Use Supabase Storage instead of S3
- Leverage existing Railway queue workers
- Add paper-specific metadata extraction
- Keep existing PDF extraction system

### 2. ✅ Paper Viewing with Annotations
**From Open Paper:**
- Split-view PDF reader (document + AI panel)
- Text highlighting with colors
- Inline annotations
- Comment threads
- Annotation search
- Export annotations

**Adaptation:**
- Enhance existing PDFReader component
- Add highlight/annotation layer
- Store annotations in Supabase
- Maintain existing UI patterns

### 3. ✅ AI Chat with Papers
**From Open Paper:**
- Context-aware chat (references paper content)
- Citation annotations (click to jump to page)
- Streaming responses
- Chat history per paper
- Multi-paper conversations

**Adaptation:**
- Extend existing chat API
- Add paper context retrieval
- Implement citation system
- Use existing AI providers (Groq/Claude)

### 4. ✅ Library & Search
**From Open Paper:**
- Paper library grid/list view
- Full-text search across papers
- Filter by tags, authors, dates
- Sort by relevance, date, title
- Paper metadata cards
- Preview on hover

**Adaptation:**
- Create new Library view
- Use PostgreSQL full-text search
- Add paper card components
- Integrate with existing UI

### 5. ✅ Projects & Organization
**From Open Paper:**
- Create projects (collections of papers)
- Add/remove papers from projects
- Project-specific conversations
- Share projects (optional)
- Project metadata and notes

**Adaptation:**
- Add projects table to Supabase
- Link papers to projects
- Extend existing context system
- Keep private by default

### 6. ✅ Paper Metadata & References
**From Open Paper:**
- Auto-extract title, authors, abstract
- Institution and keyword extraction
- Reference paper detection
- Related papers suggestions
- Citation count tracking

**Adaptation:**
- Add metadata extraction to processing
- Store in JSONB for flexibility
- Create metadata display components
- Optional: API integration for citations

---

## Database Schema Migration

### New Supabase Tables

```sql
-- Papers (replaces Open Paper's Paper model)
CREATE TABLE papers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  authors TEXT[],
  abstract TEXT,
  pdf_url TEXT,
  storage_path TEXT,
  preview_image_url TEXT,
  total_pages INTEGER DEFAULT 0,
  size_kb INTEGER,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  metadata JSONB DEFAULT '{}',
  search_vector TSVECTOR, -- For full-text search
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_papers_user_id ON papers(user_id);
CREATE INDEX idx_papers_search ON papers USING GIN(search_vector);
CREATE INDEX idx_papers_status ON papers(status);

-- Paper Highlights
CREATE TABLE paper_highlights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paper_id UUID REFERENCES papers(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  page_number INTEGER NOT NULL,
  text_content TEXT NOT NULL,
  position JSONB NOT NULL, -- {x, y, width, height, pageIndex}
  color TEXT DEFAULT 'yellow',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_highlights_paper ON paper_highlights(paper_id);
CREATE INDEX idx_highlights_user_paper ON paper_highlights(user_id, paper_id);

-- Paper Annotations (comments on highlights)
CREATE TABLE paper_annotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  highlight_id UUID REFERENCES paper_highlights(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_annotations_highlight ON paper_annotations(highlight_id);

-- Paper Conversations (AI chat)
CREATE TABLE paper_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paper_id UUID REFERENCES papers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT,
  context_type TEXT DEFAULT 'paper', -- 'paper', 'project', 'library'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_paper_conversations_user ON paper_conversations(user_id);
CREATE INDEX idx_paper_conversations_paper ON paper_conversations(paper_id);

-- Paper Messages
CREATE TABLE paper_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES paper_conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  citations JSONB, -- [{page: 3, text: "...", confidence: 0.9}]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_paper_messages_conversation ON paper_messages(conversation_id);

-- Projects
CREATE TABLE paper_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_user ON paper_projects(user_id);

-- Project Papers (many-to-many)
CREATE TABLE project_papers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES paper_projects(id) ON DELETE CASCADE NOT NULL,
  paper_id UUID REFERENCES papers(id) ON DELETE CASCADE NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, paper_id)
);

CREATE INDEX idx_project_papers_project ON project_papers(project_id);
CREATE INDEX idx_project_papers_paper ON project_papers(paper_id);

-- Paper Notes (standalone notes, different from textbook notes)
CREATE TABLE paper_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paper_id UUID REFERENCES papers(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  page_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_paper_notes_paper ON paper_notes(paper_id);
CREATE INDEX idx_paper_notes_user ON paper_notes(user_id, paper_id);
```

---

## File Structure (New Files to Create)

```
/api/
  /papers/
    upload.ts              # Paper upload endpoint
    process.ts             # Background processing
    [id].ts                # Get/update/delete paper
    metadata.ts            # Extract metadata
    
  /paper-chat/
    chat.ts                # Chat with paper context
    messages.ts            # Get conversation history
    
  /highlights/
    create.ts              # Create highlight
    [id].ts                # Update/delete highlight
    
  /annotations/
    create.ts              # Create annotation
    [id].ts                # Update/delete annotation
    
  /projects/
    create.ts              # Create project
    [id].ts                # Get/update/delete
    papers.ts              # Add/remove papers

/src/
  /components/
    /papers/
      PaperViewer.tsx           # Main paper viewing component
      PaperLibrary.tsx          # Library grid/list view
      PaperCard.tsx             # Paper preview card
      PaperUploadDialog.tsx     # Upload UI
      PaperAnnotations.tsx      # Annotations sidebar
      PaperHighlightLayer.tsx   # Highlight rendering
      PaperChat.tsx             # Paper chat interface
      PaperProjectSelector.tsx  # Project management
      
  /contexts/
    PaperContext.tsx            # Paper state management
    PaperProjectContext.tsx     # Project management
    
  /lib/
    /papers/
      api.ts                    # API client functions
      highlights.ts             # Highlight utilities
      citations.ts              # Citation parsing
      search.ts                 # Search functionality
```

---

## Migration Steps (Detailed)

### Phase 1: Database Setup ✅
1. Create `schema-papers.sql` with all new tables
2. Run migration in Supabase SQL Editor
3. Set up Row Level Security (RLS) policies
4. Test with sample data

### Phase 2: Paper Upload & Storage ✅
1. Create upload API endpoint (`/api/papers/upload.ts`)
2. Integrate with Supabase Storage
3. Adapt existing PDF processing worker
4. Add status tracking
5. Build upload UI component

### Phase 3: Paper Viewing ✅
1. Create PaperViewer component
2. Integrate existing PDFReader
3. Add highlight rendering layer
4. Build annotation sidebar
5. Implement click-to-highlight

### Phase 4: Highlights & Annotations ✅
1. Create highlight API endpoints
2. Build highlight storage system
3. Add color picker
4. Implement annotation creation
5. Build annotation thread UI

### Phase 5: AI Chat Integration ✅
1. Extend existing chat API for papers
2. Add paper content retrieval
3. Implement citation detection
4. Build citation click-to-page
5. Add chat history UI

### Phase 6: Library & Search ✅
1. Create paper library view
2. Implement full-text search
3. Build filter and sort UI
4. Add paper cards
5. Implement preview on hover

### Phase 7: Projects & Organization ✅
1. Create project API endpoints
2. Build project creation UI
3. Add paper-to-project linking
4. Create project view
5. Implement project chat

### Phase 8: Integration & Polish ✅
1. Add navigation to papers section
2. Create routing for papers
3. Add keyboard shortcuts
4. Implement export features
5. Add loading states
6. Handle errors gracefully

---

## What Might Be Wrong (Common Issues)

### 1. Authentication Differences
**Problem**: Open Paper uses custom Google OAuth, AI Textbook Reader uses Supabase Auth

**Solution**: 
- Use existing Supabase auth system
- Papers will be linked to `auth.users(id)`
- RLS policies will handle security
- No migration of auth system needed

### 2. File Storage Migration
**Problem**: Open Paper uses S3/CloudFlare R2, need to adapt to Supabase Storage

**Solution**:
```typescript
// Before (Open Paper - S3)
const uploadToS3 = async (file) => {
  const s3Client = new S3Client({...});
  await s3Client.send(new PutObjectCommand({...}));
}

// After (AI Textbook Reader - Supabase)
const uploadToSupabase = async (file) => {
  const { data, error } = await supabase.storage
    .from('papers')
    .upload(`${userId}/${fileId}.pdf`, file);
}
```

### 3. Background Job Processing
**Problem**: Open Paper uses Celery workers, AI Textbook Reader has simpler system

**Solution**:
- Leverage existing Railway queue worker
- Adapt to use same infrastructure as textbook processing
- Add paper-specific processing tasks
- Use Supabase real-time for status updates

### 4. API Architecture Differences
**Problem**: FastAPI (Python) vs Vercel Functions (TypeScript)

**Solution**:
- Convert Python endpoints to TypeScript
- Use existing patterns from AI Textbook Reader
- Keep same business logic
- Example conversion provided in next section

### 5. PDF Rendering
**Problem**: Two different approaches might conflict

**Solution**:
- Use existing `pdfjs-dist` from AI Textbook Reader
- Enhance existing PDFReader component
- Add annotation layer on top
- No need to replace PDF viewer

### 6. Real-time Updates
**Problem**: Open Paper uses polling, Supabase offers real-time

**Solution**:
- Use Supabase real-time subscriptions
- Update UI instantly when papers process
- Better UX than polling
- Use existing `useRealtimeEvents` hook

---

## Code Conversion Example

### FastAPI → Vercel Function

**Before (Open Paper - FastAPI):**
```python
@router.post("/api/paper/{paper_id}/highlight")
async def create_highlight(
    paper_id: str,
    highlight: HighlightCreate,
    current_user: CurrentUser = Depends(get_required_user),
    db: Session = Depends(get_db)
):
    new_highlight = Highlight(
        paper_id=paper_id,
        user_id=current_user.id,
        text_content=highlight.text_content,
        position=highlight.position,
        color=highlight.color
    )
    db.add(new_highlight)
    db.commit()
    return new_highlight.to_dict()
```

**After (AI Textbook Reader - Vercel Function):**
```typescript
// /api/highlights/create.ts
import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  // Get user from session
  const token = req.headers.authorization?.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { paper_id, text_content, position, color } = req.body;

  const { data, error } = await supabase
    .from('paper_highlights')
    .insert({
      paper_id,
      user_id: user.id,
      text_content,
      position,
      color: color || 'yellow'
    })
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json(data);
}
```

---

## Testing Strategy

### Unit Tests
- [ ] Paper upload flow
- [ ] Highlight creation/deletion
- [ ] Annotation CRUD operations
- [ ] Search functionality
- [ ] Project operations

### Integration Tests
- [ ] Full paper upload → process → view workflow
- [ ] Chat with paper context
- [ ] Multi-paper projects
- [ ] RLS policies work correctly

### Manual Testing
- [ ] Upload various PDF formats
- [ ] Test on mobile devices
- [ ] Verify keyboard shortcuts
- [ ] Test with large libraries (100+ papers)
- [ ] Concurrent user testing

---

## Deployment Checklist

### Environment Variables
```bash
# Add to Vercel
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_KEY=your_service_key

# For Railway worker (if needed)
SUPABASE_URL=your_url
SUPABASE_SERVICE_KEY=your_service_key
```

### Database
- [ ] Run `schema-papers.sql` in production Supabase
- [ ] Verify RLS policies are active
- [ ] Create storage bucket for papers
- [ ] Set up proper CORS for storage

### Code Deploy
- [ ] Push to GitHub
- [ ] Deploy to Vercel
- [ ] Deploy Railway workers (if updated)
- [ ] Verify API routes accessible
- [ ] Test file upload to production storage

---

## Timeline Estimate

| Phase | Estimated Time | Complexity |
|-------|---------------|------------|
| Database Setup | 2 hours | Low |
| Paper Upload | 4 hours | Medium |
| Paper Viewing | 6 hours | High |
| Highlights/Annotations | 8 hours | High |
| AI Chat Integration | 6 hours | Medium |
| Library & Search | 4 hours | Medium |
| Projects | 4 hours | Low |
| Integration & Polish | 4 hours | Medium |
| **Total** | **38 hours** | **~5 days** |

---

## Success Criteria

- [ ] Can upload PDF research papers
- [ ] Papers are processed and viewable
- [ ] Can highlight text in multiple colors
- [ ] Can add annotations to highlights
- [ ] Can chat with AI about paper content
- [ ] AI responses include citations
- [ ] Can search across all papers
- [ ] Can create and manage projects
- [ ] Can add papers to projects
- [ ] All features work with RLS
- [ ] No breaking changes to existing textbook features

---

## Next Steps

1. **Review this plan** - Make sure all required features are listed
2. **Run database migration** - Create all tables in Supabase
3. **Start with Phase 1** - Get basic paper upload working
4. **Iterate through phases** - Build and test each feature
5. **Integrate with UI** - Add navigation and routing
6. **Test thoroughly** - Ensure nothing breaks
7. **Deploy** - Push to production

---

**Questions? Issues?**
- Check existing Open Paper code for reference
- Existing AI Textbook Reader patterns for guidance
- Supabase docs for API details

**Status**: Ready to begin migration 🚀

