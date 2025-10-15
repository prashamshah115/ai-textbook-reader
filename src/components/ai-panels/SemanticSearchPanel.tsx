import { useState } from 'react';
import { Search, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { useTextbook } from '../../contexts/TextbookContext';
import { toast } from 'sonner';

interface SearchResult {
  id: string;
  page_number: number;
  raw_text: string;
  similarity: number;
}

export function SemanticSearchPanel() {
  const { currentTextbook, goToPage } = useTextbook();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim() || !currentTextbook) return;

    setLoading(true);
    setHasSearched(true);

    try {
      const response = await fetch('/api/semantic-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          textbookId: currentTextbook.id,
          threshold: 0.7,
          limit: 10,
        }),
      });

      if (!response.ok) throw new Error('Search failed');

      const data = await response.json();
      setResults(data.results || []);

      if (data.results?.length === 0) {
        toast.info('No results found. Try different keywords.');
      }
    } catch (error) {
      console.error('[Search] Error:', error);
      toast.error('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-4 py-3 bg-muted/30">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Semantic Search</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Search by meaning, not just keywords
        </p>
      </div>

      {/* Search Input */}
      <div className="p-4 border-b border-border">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="e.g., 'What is momentum?'"
            className="text-sm"
            disabled={loading}
          />
          <Button
            onClick={handleSearch}
            disabled={!query.trim() || loading}
            size="sm"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto p-4">
        {!hasSearched ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Search className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-sm font-semibold mb-2">Try Semantic Search</h3>
            <p className="text-xs text-muted-foreground max-w-xs mb-4">
              Search finds pages by meaning, not exact words. Try:
            </p>
            <div className="space-y-2 text-xs">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery('How do forces work?');
                  setTimeout(handleSearch, 100);
                }}
              >
                "How do forces work?"
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery('Examples of conservation');
                  setTimeout(handleSearch, 100);
                }}
              >
                "Examples of conservation"
              </Button>
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-sm text-muted-foreground">
              No results found for "{query}"
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Try different keywords or wait for more pages to be indexed
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground mb-2">
              Found {results.length} relevant pages
            </div>
            {results.map((result, idx) => (
              <Card
                key={idx}
                className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => {
                  goToPage(result.page_number);
                  toast.success(`Navigated to page ${result.page_number}`);
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">
                      Page {result.page_number}
                    </span>
                    <span className="text-xs text-green-600">
                      {Math.round(result.similarity * 100)}% match
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground line-clamp-3">
                  {result.raw_text.slice(0, 200)}...
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

