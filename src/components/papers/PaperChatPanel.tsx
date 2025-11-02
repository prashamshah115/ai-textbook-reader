// PaperChatPanel - AI Chat Interface for Papers
// Based on Open Paper's proven chat UI with citations

import React, { useState, useRef, useEffect } from 'react';
import { usePaper } from '../../contexts/PaperContext';
import type { Paper, PaperMessage } from '../../lib/papers/types';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { ScrollArea } from '../ui/scroll-area';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Send, Loader2, FileText, MessageSquare, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaperChatPanelProps {
  paper: Paper;
}

export default function PaperChatPanel({ paper }: PaperChatPanelProps) {
  const {
    currentConversation,
    messages,
    isStreaming,
    sendMessage,
    startConversation,
    setCurrentPage,
  } = usePaper();

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Start conversation if none exists
  useEffect(() => {
    if (!currentConversation && messages.length === 0) {
      startConversation();
    }
  }, [currentConversation, messages.length, startConversation]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const message = input;
    setInput('');
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      await sendMessage(message);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCitationClick = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  const suggestedQuestions = [
    "What is the main contribution of this paper?",
    "Summarize the methodology",
    "What are the key findings?",
    "How does this relate to prior work?",
  ];

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">AI Assistant</h3>
            <p className="text-xs text-muted-foreground">
              Ask questions about this paper
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        <div className="py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="space-y-4 py-8">
              <div className="text-center space-y-2">
                <div className="flex justify-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <MessageSquare className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <h4 className="font-semibold">Start a conversation</h4>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Ask me anything about "{paper.title}". I can explain concepts, summarize
                  sections, and help you understand the research.
                </p>
              </div>

              {/* Suggested questions */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Suggested questions:
                </p>
                {suggestedQuestions.map((question, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInput(question)}
                    className="w-full text-left px-3 py-2 text-sm rounded-lg border bg-card hover:bg-accent transition-colors"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onCitationClick={handleCitationClick}
              />
            ))
          )}

          {/* Streaming indicator */}
          {isStreaming && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Thinking...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t bg-card">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              // Auto-resize
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this paper..."
            className="min-h-[80px] max-h-[200px] resize-none"
            disabled={isStreaming}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            size="icon"
            className="shrink-0"
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onCitationClick,
}: {
  message: PaperMessage;
  onCitationClick: (page: number) => void;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <Avatar className="w-8 h-8 shrink-0">
        <AvatarFallback className={cn(isUser ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
          {isUser ? 'U' : 'AI'}
        </AvatarFallback>
      </Avatar>

      {/* Message content */}
      <div className={cn('flex-1 space-y-2', isUser && 'flex flex-col items-end')}>
        <div
          className={cn(
            'inline-block px-4 py-2 rounded-lg max-w-[85%]',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted'
          )}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Citations */}
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.citations.map((citation, idx) => (
              <button
                key={idx}
                onClick={() => onCitationClick(citation.page)}
                className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded border bg-card hover:bg-accent transition-colors"
                title={citation.text}
              >
                <FileText className="h-3 w-3" />
                <span>Page {citation.page}</span>
              </button>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <p className="text-xs text-muted-foreground">
          {new Date(message.created_at).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}

