# AI Textbook Reader

> A personal experiment in making textbook reading more engaging and effective through AI-powered features.

## What is this?

This is a web application that transforms static PDF textbooks into an interactive learning experience. Instead of passively reading, students get real-time AI-generated summaries, practice questions, and an intelligent chat assistant that understands the context of what they're reading.

**Live Demo**: [https://ai-textbook-reader-design.vercel.app](https://ai-textbook-reader-design.vercel.app)

## Why I built this

Reading textbooks is often boring and inefficient. I wanted to see if AI could make the process more active and engaging by:
- Automatically summarizing complex pages
- Extracting key concepts as you read
- Generating practice questions for self-testing
- Providing an AI tutor you can ask questions in real-time

## How to use it

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/ai-textbook-reader.git
   cd ai-textbook-reader
   npm install
   ```

2. **Set up environment variables**
   
   Create a `.env` file:
   ```bash
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_KEY=your_service_key
   GROQ_API_KEY=your_groq_key  # For AI features
   ```

3. **Set up the database**
   
   Run `supabase-schema.sql` in your Supabase SQL editor, then whitelist your email:
   ```sql
   INSERT INTO allowed_users (email, role) VALUES ('your@email.com', 'admin');
   ```

4. **Run locally**
   ```bash
   npm run dev
   ```

5. **Deploy to Vercel**
   ```bash
   vercel
   ```

### Using the app

1. **Sign up** with your whitelisted email
2. **Upload a PDF** textbook
3. **Read and take notes** in the left panel
4. **View AI-generated content** in the right panel:
   - Page summaries
   - Key concepts
   - Practice questions
   - Real-world applications
5. **Ask questions** using the chat feature

## What's built

✅ **Core Features**
- PDF text extraction (client-side with fallback to server)
- Real-time note-taking with auto-save
- AI-powered page summaries
- Key concept extraction
- Practice question generation
- Interactive chat with context awareness
- Whitelist-based authentication
- User data isolation (Supabase RLS)

✅ **Tech Stack**
- Frontend: React 18 + TypeScript + Vite + TailwindCSS
- Backend: Supabase (PostgreSQL, Auth, Storage)
- AI: Groq API (Llama 3.1)
- Deployment: Vercel (frontend) + Railway (PDF extraction service)
- UI Components: shadcn/ui + Radix UI

## What I'm working on

🚧 **Current Focus**
- Improving PDF extraction reliability for scanned documents
- Optimizing AI content generation speed
- Adding progress tracking and analytics

🔜 **Next Up**
- Real PDF.js rendering (currently showing extracted text)
- Batch PDF upload and processing
- Full-text search across textbooks
- Export notes as Markdown/PDF
- Spaced repetition flashcards

💡 **Future Ideas**
- Mobile app (React Native)
- Collaborative notes (share with classmates)
- Voice-based AI tutor
- Multi-textbook cross-references
- Subscription model for public access

## Tech details

**Architecture**
```
Frontend (Vercel)
  ├─ React app with client-side PDF extraction
  └─ API routes for AI processing

Backend (Supabase)
  ├─ PostgreSQL with Row-Level Security
  ├─ Authentication + file storage
  └─ Real-time sync

PDF Service (Railway)
  └─ Fallback extraction for complex PDFs

AI Layer (Groq)
  └─ Llama 3.1 for all AI features
```

**Key Design Decisions**
- Client-side PDF extraction first (fast), server fallback for scanned PDFs
- Batch database inserts to handle large textbooks efficiently
- Proactive session refresh to prevent auth timeouts
- Chat API timeout (30s) to prevent hanging requests

## License

I own full rights to this repository.

---

**Status**: MVP complete and deployed. Actively improving based on real-world usage.

**Built by**: Prasham Shah

**Contact**: prashamshah115@gmail.com
