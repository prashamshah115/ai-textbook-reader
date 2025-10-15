import { X, FileText, Loader2, Sparkles, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useTextbook } from '../contexts/TextbookContext';

interface ExplainTooltipProps {
  text: string;
  position: { x: number; y: number };
  onClose: () => void;
  onAddToNotes: () => void;
}

export function ExplainTooltip({ text, position, onClose, onAddToNotes }: ExplainTooltipProps) {
  const { currentTextbook, currentPage } = useTextbook();
  const [explanation, setExplanation] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [cached, setCached] = useState(false);
  const [duration, setDuration] = useState<number>(0);

  useEffect(() => {
    const fetchExplanation = async () => {
      try {
        setLoading(true);
        setError(false);

        // 🔥 PHASE 3: Use new explain-highlight API with Groq
        const response = await fetch('/api/explain-highlight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            context: {
              docId: currentTextbook?.id,
              pageNum: currentPage,
              fileName: currentTextbook?.title,
            },
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to get explanation');
        }

        const data = await response.json();
        setExplanation(data.explanation);
        setCached(data.cached || false);
        setDuration(data.duration || 0);
        
        console.log(`[ExplainTooltip] Explained in ${data.duration}ms ${data.cached ? '(cached)' : ''}`);
      } catch (err) {
        console.error('[ExplainTooltip] Error:', err);
        setError(true);
        toast.error('Failed to generate explanation');
      } finally {
        setLoading(false);
      }
    };

    fetchExplanation();
  }, [text, currentTextbook, currentPage]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className="fixed z-50 bg-white border border-border shadow-lg rounded-md"
        style={{
          left: `${position.x}px`,
          top: `${position.y - 10}px`,
          transform: 'translate(-50%, -100%)',
          maxWidth: '360px',
        }}
      >
        <div className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="text-xs text-muted-foreground mb-1">Selected</div>
              <div className="text-xs bg-muted px-2 py-1 rounded italic">{text}</div>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          
          <div className="pt-2 border-t border-border">
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1 justify-between">
              <div className="flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                AI Explanation
              </div>
              {cached && <Zap className="w-3 h-3 text-amber-500" title="Instant (cached)" />}
            </div>
            {loading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Generating explanation...</span>
              </div>
            ) : error ? (
              <p className="text-xs text-red-500">Failed to generate explanation. Try again.</p>
            ) : (
              <>
                <p className="text-xs leading-relaxed">{explanation}</p>
                {duration > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {cached ? '⚡ Instant' : `Generated in ${duration}ms`} • Powered by Groq
                  </p>
                )}
              </>
            )}
          </div>

          {!loading && !error && (
            <button
              onClick={onAddToNotes}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-accent text-accent-foreground hover:bg-accent/90 rounded text-xs transition-colors"
            >
              <FileText className="w-3 h-3" />
              Add to Notes
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
