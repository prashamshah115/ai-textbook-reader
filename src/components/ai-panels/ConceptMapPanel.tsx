import { useState, useEffect, useRef } from 'react';
import { Network, Loader2, Plus, Zap } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { useTextbook } from '../../contexts/TextbookContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';

interface Concept {
  id: string;
  name: string;
  description: string;
  importance: 'high' | 'medium' | 'low';
}

interface Relationship {
  from: string;
  to: string;
  type: 'prerequisite' | 'related' | 'extends' | 'applies';
  description: string;
}

export function ConceptMapPanel() {
  const { user } = useAuth();
  const { currentTextbook, currentPage } = useTextbook();
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generateConceptMap = async () => {
    if (!user || !currentTextbook) return;

    setGenerating(true);
    toast.loading('Generating concept map...', { id: 'conceptmap' });

    try {
      // Generate for ±5 pages around current page
      const pageStart = Math.max(1, currentPage - 5);
      const pageEnd = Math.min(currentTextbook.total_pages, currentPage + 5);

      const response = await fetch('/api/generate-concept-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textbookId: currentTextbook.id,
          userId: user.id,
          pageStart,
          pageEnd,
        }),
      });

      if (!response.ok) throw new Error('Generation failed');

      const data = await response.json();
      setConcepts(data.concepts || []);
      setRelationships(data.relationships || []);
      
      toast.success('Concept map generated!', { id: 'conceptmap' });
    } catch (error) {
      console.error('[ConceptMap] Error:', error);
      toast.error('Failed to generate concept map', { id: 'conceptmap' });
    } finally {
      setGenerating(false);
    }
  };

  // Simple visualization using canvas
  useEffect(() => {
    if (!canvasRef.current || concepts.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Simple circle layout
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) / 3;

    const positions = concepts.map((_, i) => {
      const angle = (i / concepts.length) * 2 * Math.PI;
      return {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    });

    // Draw relationships (lines)
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    relationships.forEach((rel) => {
      const fromIdx = concepts.findIndex((c) => c.id === rel.from);
      const toIdx = concepts.findIndex((c) => c.id === rel.to);
      if (fromIdx >= 0 && toIdx >= 0) {
        const from = positions[fromIdx];
        const to = positions[toIdx];
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }
    });

    // Draw concepts (circles)
    concepts.forEach((concept, i) => {
      const pos = positions[i];
      const isSelected = concept.id === selectedConcept;

      // Circle
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 30, 0, 2 * Math.PI);
      ctx.fillStyle = isSelected ? '#3b82f6' : '#f0f0f0';
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#2563eb' : '#666';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Text
      ctx.fillStyle = isSelected ? '#fff' : '#000';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        concept.name.length > 15 ? concept.name.slice(0, 12) + '...' : concept.name,
        pos.x,
        pos.y
      );
    });
  }, [concepts, relationships, selectedConcept]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-4 py-3 bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Concept Map</h3>
          </div>
          <Button
            size="sm"
            onClick={generateConceptMap}
            disabled={generating}
          >
            {generating ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Zap className="w-3 h-3 mr-1" />
                Generate
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {concepts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Network className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-sm font-semibold mb-2">Visual Concept Map</h3>
            <p className="text-xs text-muted-foreground max-w-xs mb-4">
              AI extracts key concepts and shows how they relate to each other
            </p>
            <Button size="sm" onClick={generateConceptMap} disabled={generating}>
              <Plus className="w-4 h-4 mr-2" />
              Generate First Map
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Visualization */}
            <Card className="p-4 bg-white">
              <canvas
                ref={canvasRef}
                className="w-full h-64 cursor-pointer"
                onClick={(e) => {
                  // Simple click detection (would need proper math for production)
                  const rect = canvasRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  const x = e.clientX - rect.left;
                  const y = e.clientY - rect.top;
                  // Find nearest concept
                  console.log('Clicked:', x, y);
                }}
              />
            </Card>

            {/* Concept List */}
            <div>
              <div className="text-xs font-semibold mb-2">
                {concepts.length} Concepts
              </div>
              <div className="space-y-2">
                {concepts.map((concept) => (
                  <Card
                    key={concept.id}
                    className={`p-3 cursor-pointer transition-colors ${
                      selectedConcept === concept.id ? 'bg-primary/10' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedConcept(concept.id)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{concept.name}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          concept.importance === 'high'
                            ? 'bg-red-100 text-red-700'
                            : concept.importance === 'medium'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {concept.importance}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{concept.description}</p>
                  </Card>
                ))}
              </div>
            </div>

            {/* Relationships */}
            {selectedConcept && (
              <div>
                <div className="text-xs font-semibold mb-2">Relationships</div>
                <div className="space-y-2">
                  {relationships
                    .filter(
                      (r) => r.from === selectedConcept || r.to === selectedConcept
                    )
                    .map((rel, idx) => {
                      const otherConceptId =
                        rel.from === selectedConcept ? rel.to : rel.from;
                      const otherConcept = concepts.find((c) => c.id === otherConceptId);
                      return (
                        <Card key={idx} className="p-2 text-xs">
                          <div className="font-medium">{rel.type}</div>
                          <div className="text-muted-foreground">
                            → {otherConcept?.name}
                          </div>
                          {rel.description && (
                            <div className="text-muted-foreground mt-1">
                              {rel.description}
                            </div>
                          )}
                        </Card>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

