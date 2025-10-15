import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Eye, EyeOff, CheckCircle, Clock, Mic, MicOff } from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { useChat } from '../../contexts/ChatContext';
import { useTextbook } from '../../contexts/TextbookContext';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

export function ChatPanel() {
  const { messages, loading, sendMessage, currentContext } = useChat();
  const { currentPage, currentTextbook } = useTextbook();
  const [input, setInput] = useState('');
  const [showContext, setShowContext] = useState(false);
  const [contextReady, setContextReady] = useState(false);
  const [contextLoading, setContextLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 🎙️ Initialize Speech Recognition (Voice-to-Text)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    
    if (!SpeechRecognition) {
      console.log('[Voice] Speech recognition not supported in this browser');
      return;
    }
    
    const recognitionInstance = new SpeechRecognition();
    recognitionInstance.continuous = false;
    recognitionInstance.interimResults = false;
    recognitionInstance.lang = 'en-US';
    
    recognitionInstance.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      console.log('[Voice] Transcript:', transcript);
      setInput(transcript);
      setIsRecording(false);
      toast.success('Voice captured!', { id: 'voice' });
    };
    
    recognitionInstance.onerror = (event: any) => {
      console.error('[Voice] Error:', event.error);
      setIsRecording(false);
      
      if (event.error === 'no-speech') {
        toast.error('No speech detected. Please try again.', { id: 'voice' });
      } else if (event.error === 'not-allowed') {
        toast.error('Microphone permission denied', { id: 'voice' });
      } else {
        toast.error('Voice recognition failed. Please try again.', { id: 'voice' });
      }
    };
    
    recognitionInstance.onend = () => {
      setIsRecording(false);
      toast.dismiss('voice');
    };
    
    setRecognition(recognitionInstance);
    console.log('[Voice] Speech recognition initialized');
  }, []);

  // Check web context status
  useEffect(() => {
    if (currentTextbook) {
      setContextLoading(true);
      supabase
        .from('textbook_web_context')
        .select('status')
        .eq('textbook_id', currentTextbook.id)
        .maybeSingle()
        .then(({ data }) => {
          setContextReady(data?.status === 'fetched');
          setContextLoading(false);
        })
        .catch(() => {
          setContextLoading(false);
        });
    }
  }, [currentTextbook]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const messageText = input;
    setInput('');
    await sendMessage(messageText);
  };

  // 🎙️ Toggle voice recording
  const toggleRecording = () => {
    if (!recognition) {
      toast.error('Voice input not supported in this browser. Try Chrome or Safari.');
      return;
    }
    
    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
      toast.dismiss('voice');
    } else {
      try {
        recognition.start();
        setIsRecording(true);
        toast.loading('🎤 Listening... Speak now!', { id: 'voice' });
      } catch (error) {
        console.error('[Voice] Start error:', error);
        toast.error('Failed to start voice input', { id: 'voice' });
      }
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with Context Toggle */}
      <div className="border-b border-border px-3 py-2 flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground">AI Chat</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowContext(!showContext)}
          className="h-6 px-2 text-xs"
        >
          {showContext ? (
            <>
              <EyeOff className="w-3 h-3 mr-1" />
              Hide Context
            </>
          ) : (
            <>
              <Eye className="w-3 h-3 mr-1" />
              View Context
            </>
          )}
        </Button>
      </div>

      {/* Context Viewer */}
      {showContext && currentContext && (
        <div className="border-b border-border px-3 py-2 bg-muted/30">
          <div className="text-xs text-muted-foreground mb-1 font-medium">
            Current Context Being Used:
          </div>
          <pre className="text-xs bg-background p-2 rounded overflow-auto max-h-32 border border-border">
            {currentContext}
          </pre>
        </div>
      )}

      {/* 🔥 NEW: Context Status Indicator */}
      {contextLoading ? (
        <div className="border-b border-border px-3 py-2 bg-accent/5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Checking textbook context...</span>
          </div>
        </div>
      ) : contextReady ? (
        <div className="border-b border-border px-3 py-2 bg-green-50 dark:bg-green-950/20">
          <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400">
            <CheckCircle className="w-3 h-3" />
            <span>Textbook context ready • Ask anything now</span>
          </div>
        </div>
      ) : (
        <div className="border-b border-border px-3 py-2 bg-amber-50 dark:bg-amber-950/20">
          <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
            <Clock className="w-3 h-3" />
            <span>Loading textbook background context...</span>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto px-3 py-3 space-y-3">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-muted-foreground text-center px-4">
              Ask questions about the current page to get AI-powered explanations
            </p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <div
                key={index}
                className={`${
                  message.role === 'user' ? 'ml-8' : 'mr-8'
                }`}
              >
                <div
                  className={`rounded-md p-2.5 ${
                    message.role === 'user'
                      ? 'bg-accent text-accent-foreground ml-auto'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-xs leading-relaxed whitespace-pre-line">
                    {message.content}
                  </p>
                </div>
                
                {message.role === 'assistant' && (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    <span className="text-xs px-1.5 py-0.5 bg-accent/10 text-accent rounded border border-accent/20">
                      Page {currentPage}
                    </span>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="mr-8">
                <div className="rounded-md p-2.5 bg-muted flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="text-xs text-muted-foreground">Thinking...</span>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask about this page... (or use voice 🎙️)"
            className="min-h-[60px] text-xs resize-none"
            disabled={loading || isRecording}
          />
          <div className="flex flex-col gap-2">
            <Button
              onClick={toggleRecording}
              size="sm"
              variant={isRecording ? "destructive" : "outline"}
              className="h-7 px-3"
              disabled={loading}
              title={isRecording ? "Stop recording" : "Voice input (Chrome/Safari)"}
            >
              {isRecording ? (
                <>
                  <MicOff className="w-3 h-3 mr-1" />
                  <span className="text-xs">Stop</span>
                </>
              ) : (
                <>
                  <Mic className="w-3 h-3 mr-1" />
                  <span className="text-xs">Voice</span>
                </>
              )}
            </Button>
            <Button
              onClick={handleSend}
              size="sm"
              className="h-[45px] px-3"
              disabled={!input.trim() || loading}
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
