# 🚀 AI FEATURES ROADMAP
## Implementation Plan for Next-Gen Learning Features

---

## ✅ COMPLETED: Highlight-to-Notes
**Status:** DONE ✨
**What:** Select any text and click "Add to Notes" - instantly saved to your notes
**Implementation:** 
- Added `addHighlightedText()` function to NotesContext
- Updated SelectionToolbar with green "Add to Notes" button
- Auto-appends to active note or creates new note
- Includes page number and timestamp

**Usage:**
1. Select text on any page
2. Click green "Add to Notes" button in toolbar
3. Text is saved with page reference

---

## 🎯 PRIORITY QUEUE (Ordered by Impact × Speed)

### 1. 🎙️ Voice-to-Text Questions (NEXT - 1 DAY)
**Impact:** ⭐⭐⭐⭐⭐
**Difficulty:** Easy
**Timeline:** 1 day
**Cost:** $0 (browser native)

**Why First:** Fastest to implement, massive UX improvement for mobile users

**Implementation Plan:**
```typescript
// src/components/ai-panels/ChatPanel.tsx

import { Mic, MicOff } from 'lucide-react';
import { useState } from 'react';

const [isRecording, setIsRecording] = useState(false);
const [recognition, setRecognition] = useState<any>(null);

// Initialize speech recognition
useEffect(() => {
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognitionInstance = new SpeechRecognition();
    
    recognitionInstance.continuous = false;
    recognitionInstance.interimResults = false;
    recognitionInstance.lang = 'en-US';
    
    recognitionInstance.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsRecording(false);
    };
    
    recognitionInstance.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      toast.error('Speech recognition failed. Please try again.');
      setIsRecording(false);
    };
    
    recognitionInstance.onend = () => {
      setIsRecording(false);
    };
    
    setRecognition(recognitionInstance);
  }
}, []);

const toggleRecording = () => {
  if (!recognition) {
    toast.error('Speech recognition not supported in this browser');
    return;
  }
  
  if (isRecording) {
    recognition.stop();
  } else {
    recognition.start();
    setIsRecording(true);
    toast.loading('Listening...', { id: 'voice' });
  }
};

// Add button next to send button:
<Button
  onClick={toggleRecording}
  size="sm"
  variant={isRecording ? "destructive" : "outline"}
  className="h-[60px] px-3"
>
  {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
</Button>
```

**Testing:**
- Test on Chrome, Safari, Firefox
- Test on mobile devices
- Handle permission denied gracefully

---

### 2. 📊 Spaced Repetition System (3-4 DAYS)
**Impact:** ⭐⭐⭐⭐⭐
**Difficulty:** Medium
**Timeline:** 3-4 days
**Cost:** $0 (pure algorithm)

**Why Second:** Highest learning impact, no API costs

**Database Schema:**
```sql
-- Add to Supabase schema
CREATE TABLE flashcards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  textbook_id UUID REFERENCES textbooks(id) ON DELETE CASCADE,
  page_number INTEGER,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  ease_factor NUMERIC DEFAULT 2.5,
  interval_days INTEGER DEFAULT 1,
  repetitions INTEGER DEFAULT 0,
  next_review TIMESTAMPTZ DEFAULT NOW(),
  last_reviewed TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT DEFAULT 'manual' -- 'manual', 'ai_generated', 'highlighted'
);

CREATE INDEX idx_flashcards_user_next_review 
  ON flashcards(user_id, next_review) 
  WHERE next_review <= NOW();

CREATE INDEX idx_flashcards_textbook ON flashcards(textbook_id);
```

**Implementation - SuperMemo SM-2 Algorithm:**
```typescript
// src/lib/spacedRepetition.ts

export interface FlashCard {
  id: string;
  question: string;
  answer: string;
  easeFactor: number;  // 1.3 - 2.5
  intervalDays: number;
  repetitions: number;
  nextReview: Date;
}

export type ReviewQuality = 0 | 1 | 2 | 3 | 4 | 5;
// 0: Complete blackout
// 1: Incorrect, but familiar
// 2: Incorrect, but easy to recall
// 3: Correct with difficulty
// 4: Correct with hesitation
// 5: Perfect recall

export function calculateNextReview(
  card: FlashCard,
  quality: ReviewQuality
): Partial<FlashCard> {
  let { easeFactor, intervalDays, repetitions } = card;

  // Update ease factor
  easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

  // Failed? Reset to beginning
  if (quality < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions++;
    
    // Calculate new interval
    if (repetitions === 1) {
      intervalDays = 1;
    } else if (repetitions === 2) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }
  }

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + intervalDays);

  return {
    easeFactor,
    intervalDays,
    repetitions,
    nextReview,
  };
}
```

**FlashcardsPanel Component:**
```typescript
// src/components/ai-panels/FlashcardsPanel.tsx

export function FlashcardsPanel() {
  const [dueCards, setDueCards] = useState<FlashCard[]>([]);
  const [currentCard, setCurrentCard] = useState<FlashCard | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [stats, setStats] = useState({ due: 0, reviewed: 0, streak: 0 });

  useEffect(() => {
    loadDueCards();
  }, []);

  const loadDueCards = async () => {
    const { data } = await supabase
      .from('flashcards')
      .select('*')
      .eq('user_id', user.id)
      .lte('next_review', new Date().toISOString())
      .order('next_review', { ascending: true })
      .limit(20);

    setDueCards(data || []);
    if (data && data.length > 0) {
      setCurrentCard(data[0]);
    }
  };

  const reviewCard = async (quality: ReviewQuality) => {
    if (!currentCard) return;

    const updates = calculateNextReview(currentCard, quality);
    
    await supabase
      .from('flashcards')
      .update({
        ...updates,
        last_reviewed: new Date().toISOString(),
      })
      .eq('id', currentCard.id);

    // Show next card
    const nextCards = dueCards.filter(c => c.id !== currentCard.id);
    setDueCards(nextCards);
    setCurrentCard(nextCards[0] || null);
    setShowAnswer(false);
    setStats(prev => ({ ...prev, reviewed: prev.reviewed + 1 }));
  };

  return (
    <div className="flex flex-col h-full p-4">
      {/* Stats Header */}
      <div className="flex justify-between mb-4 text-sm">
        <span>{stats.due} cards due today</span>
        <span>{stats.reviewed} reviewed</span>
        <span>🔥 {stats.streak} day streak</span>
      </div>

      {currentCard ? (
        <div className="flex-1 flex flex-col justify-center items-center">
          {/* Question Card */}
          <div className="w-full max-w-md p-6 bg-card rounded-lg shadow-lg mb-4">
            <p className="text-lg text-center">{currentCard.question}</p>
          </div>

          {/* Answer (shown after clicking) */}
          {showAnswer && (
            <div className="w-full max-w-md p-6 bg-muted rounded-lg mb-4">
              <p className="text-center">{currentCard.answer}</p>
            </div>
          )}

          {/* Controls */}
          {!showAnswer ? (
            <Button onClick={() => setShowAnswer(true)}>
              Show Answer
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="destructive" onClick={() => reviewCard(0)}>
                Again
              </Button>
              <Button variant="outline" onClick={() => reviewCard(3)}>
                Hard
              </Button>
              <Button variant="outline" onClick={() => reviewCard(4)}>
                Good
              </Button>
              <Button variant="default" onClick={() => reviewCard(5)}>
                Easy
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">
            🎉 All caught up! No cards due for review.
          </p>
        </div>
      )}
    </div>
  );
}
```

---

### 3. 🧠 Smart Question Generation (2-3 DAYS)
**Impact:** ⭐⭐⭐⭐⭐
**Difficulty:** Medium
**Timeline:** 2-3 days
**Cost:** ~$0.05 per page (GPT-4)

**Why Third:** Combines with spaced repetition, auto-generates flashcards

**Track Reading Performance:**
```sql
-- Add user_reading_stats table
CREATE TABLE user_reading_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  textbook_id UUID REFERENCES textbooks(id) ON DELETE CASCADE,
  topic VARCHAR(100),
  confidence_score NUMERIC DEFAULT 0.5, -- 0.0 to 1.0
  times_reviewed INTEGER DEFAULT 0,
  times_failed INTEGER DEFAULT 0,
  last_reviewed TIMESTAMPTZ,
  UNIQUE(user_id, textbook_id, topic)
);
```

**Generate Adaptive Questions:**
```typescript
// api/generate-adaptive-questions.ts

export default async function handler(req: Request) {
  const { textbookId, userId, count = 5 } = await req.json();

  // Get weak topics
  const { data: stats } = await supabase
    .from('user_reading_stats')
    .select('*')
    .eq('user_id', userId)
    .eq('textbook_id', textbookId)
    .order('confidence_score', { ascending: true })
    .limit(3);

  const weakTopics = stats?.map(s => s.topic) || [];
  
  // Get page content for those topics
  const { data: pages } = await supabase
    .from('pages')
    .select('raw_text')
    .eq('textbook_id', textbookId)
    .limit(5);

  const pageTexts = pages?.map(p => p.raw_text).join('\n\n') || '';

  // Generate questions with OpenAI
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{
      role: 'system',
      content: `You are generating practice questions for a student.
      
Student struggles with: ${weakTopics.join(', ')}

Generate ${count} questions in JSON format:
{
  "questions": [
    {
      "question": "...",
      "answer": "...",
      "difficulty": "easy|medium|hard",
      "topic": "...",
      "hint": "..."
    }
  ]
}

Focus on the topics where the student struggles. Include helpful hints.`
    }, {
      role: 'user',
      content: pageTexts.slice(0, 4000)
    }],
    response_format: { type: 'json_object' }
  });

  const questions = JSON.parse(response.choices[0].message.content);

  // Save to flashcards
  for (const q of questions.questions) {
    await supabase.from('flashcards').insert({
      user_id: userId,
      textbook_id: textbookId,
      question: q.question + (q.hint ? `\n\nHint: ${q.hint}` : ''),
      answer: q.answer,
      source: 'ai_generated'
    });
  }

  return new Response(JSON.stringify(questions), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

---

### 4. 🔍 Semantic Search (2-3 DAYS)
**Impact:** ⭐⭐⭐⭐⭐
**Difficulty:** Medium
**Timeline:** 2-3 days
**Cost:** ~$0.0001 per page (embeddings)

**Why Fourth:** Game-changer for finding information

**Enable pgvector in Supabase:**
```sql
-- Run in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embeddings column to pages
ALTER TABLE pages ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create index for similarity search
CREATE INDEX ON pages USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Function for similarity search
CREATE OR REPLACE FUNCTION match_pages(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_textbook_id uuid
)
RETURNS TABLE (
  id uuid,
  page_number int,
  raw_text text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    pages.id,
    pages.page_number,
    pages.raw_text,
    1 - (pages.embedding <=> query_embedding) as similarity
  FROM pages
  WHERE pages.textbook_id = filter_textbook_id
    AND 1 - (pages.embedding <=> query_embedding) > match_threshold
  ORDER BY pages.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

**Generate Embeddings (Background Job):**
```typescript
// api/generate-embeddings.ts

export default async function handler(req: Request) {
  const { textbookId } = await req.json();

  // Get pages without embeddings
  const { data: pages } = await supabase
    .from('pages')
    .select('id, raw_text')
    .eq('textbook_id', textbookId)
    .is('embedding', null)
    .limit(100); // Process in batches

  for (const page of pages || []) {
    // Generate embedding
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: page.raw_text.slice(0, 8000), // Truncate long pages
    });

    const embedding = response.data[0].embedding;

    // Save to database
    await supabase
      .from('pages')
      .update({ embedding })
      .eq('id', page.id);
  }

  return new Response(JSON.stringify({ processed: pages?.length || 0 }));
}
```

**Search Component:**
```typescript
// src/components/SemanticSearch.tsx

export function SemanticSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    
    try {
      // Generate embedding for search query
      const embeddingResponse = await fetch('/api/generate-query-embedding', {
        method: 'POST',
        body: JSON.stringify({ query }),
      });
      const { embedding } = await embeddingResponse.json();

      // Search similar pages
      const { data, error } = await supabase.rpc('match_pages', {
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: 10,
        filter_textbook_id: currentTextbook.id,
      });

      setResults(data || []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex gap-2 mb-4">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask anything... e.g. 'What is momentum?'"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : 'Search'}
        </Button>
      </div>

      <div className="space-y-2">
        {results.map((result, idx) => (
          <div key={idx} className="p-3 bg-muted rounded">
            <div className="flex justify-between mb-1">
              <span className="font-medium">Page {result.page_number}</span>
              <span className="text-sm text-muted-foreground">
                {(result.similarity * 100).toFixed(0)}% match
              </span>
            </div>
            <p className="text-sm">{result.raw_text.slice(0, 200)}...</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### 5. 💬 Multi-Turn Conversations with Memory (1-2 DAYS)
**Impact:** ⭐⭐⭐⭐
**Difficulty:** Easy
**Timeline:** 1-2 days
**Cost:** Minimal (uses existing API)

**Implementation:** (already mostly done, just need summarization)

---

### 6. 🗺️ Concept Mapping (4-5 DAYS)
**Impact:** ⭐⭐⭐⭐
**Difficulty:** Hard
**Timeline:** 4-5 days
**Cost:** ~$0.10 per chapter (GPT-4)

(Full implementation in next phase)

---

### 7. 📝 Auto-Generated Study Guides (2 DAYS)
**Impact:** ⭐⭐⭐⭐
**Difficulty:** Easy
**Timeline:** 2 days
**Cost:** ~$0.20 per guide (GPT-4 Turbo)

(Full implementation in next phase)

---

## 📅 RECOMMENDED IMPLEMENTATION SCHEDULE

**Week 1:**
- Day 1: Voice-to-Text ✨
- Days 2-4: Spaced Repetition System 📊
- Day 5: Deploy & test

**Week 2:**
- Days 1-3: Smart Question Generation 🧠
- Days 4-5: Semantic Search setup 🔍

**Week 3:**
- Days 1-2: Complete Semantic Search
- Day 3: Multi-Turn Conversations
- Days 4-5: Study Guides

**Week 4:**
- Days 1-5: Concept Mapping
- Polish & deploy all features

---

## 💰 COST ESTIMATE

**One-time setup:**
- Embedding generation: ~$5 for 1000 pages
- Initial concept extraction: ~$10

**Ongoing per user per month:**
- Question generation: ~$2
- Chat conversations: ~$3
- Study guides: ~$1
- Semantic search queries: ~$0.50

**Total: ~$6-7 per active user per month**

---

## 🎯 SUCCESS METRICS

**Engagement:**
- Daily active users +50%
- Average session time +3x
- Return rate +40%

**Learning:**
- Spaced repetition completion rate >70%
- Voice questions usage >30%
- Semantic search queries per session >3

**Retention:**
- 7-day retention >60%
- 30-day retention >35%
- Premium conversion >15%

---

## 🚀 NEXT STEPS

1. Review this roadmap
2. Approve priority order
3. Start with Voice-to-Text (1 day)
4. Ship incrementally (don't wait for everything)

**Want to start now? I can implement Voice-to-Text in the next 30 minutes!**

