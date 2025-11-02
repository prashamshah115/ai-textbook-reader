// PaperAnnotationsPanel - Highlights & Annotations Display
// Based on Open Paper's annotation sidebar

import React, { useState } from 'react';
import { usePaper } from '../../contexts/PaperContext';
import type { PaperHighlight, PaperAnnotation } from '../../lib/papers/types';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import {
  Highlighter,
  MessageSquare,
  Trash2,
  Edit2,
  Check,
  X,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaperAnnotationsPanelProps {
  highlights: PaperHighlight[];
  annotations: Record<string, PaperAnnotation[]>;
}

const COLOR_LABELS: Record<string, string> = {
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
  pink: 'Pink',
  purple: 'Purple',
};

export default function PaperAnnotationsPanel({
  highlights,
  annotations,
}: PaperAnnotationsPanelProps) {
  const {
    selectedHighlight,
    selectHighlight,
    updateHighlightColor,
    deleteHighlight,
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
    setCurrentPage,
  } = usePaper();

  const [editingAnnotation, setEditingAnnotation] = useState<string | null>(null);
  const [annotationText, setAnnotationText] = useState('');
  const [newAnnotationText, setNewAnnotationText] = useState('');
  const [filterColor, setFilterColor] = useState<string | null>(null);

  // Group highlights by page
  const highlightsByPage = highlights.reduce((acc, h) => {
    if (!acc[h.page_number]) acc[h.page_number] = [];
    acc[h.page_number].push(h);
    return acc;
  }, {} as Record<number, PaperHighlight[]>);

  const filteredHighlights = filterColor
    ? highlights.filter((h) => h.color === filterColor)
    : highlights;

  const handleAddAnnotation = async (highlightId: string) => {
    if (!newAnnotationText.trim()) return;
    await createAnnotation(highlightId, newAnnotationText);
    setNewAnnotationText('');
  };

  const handleUpdateAnnotation = async (annotationId: string) => {
    if (!annotationText.trim()) return;
    await updateAnnotation(annotationId, annotationText);
    setEditingAnnotation(null);
    setAnnotationText('');
  };

  const handleJumpToHighlight = (highlight: PaperHighlight) => {
    selectHighlight(highlight.id);
    setCurrentPage(highlight.page_number);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Highlighter className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Annotations</h3>
            <Badge variant="secondary">{highlights.length}</Badge>
          </div>
        </div>

        {/* Color filter */}
        {highlights.length > 0 && (
          <div className="flex gap-1">
            <Button
              variant={filterColor === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterColor(null)}
              className="text-xs"
            >
              All
            </Button>
            {Object.entries(COLOR_LABELS).map(([color, label]) => {
              const count = highlights.filter((h) => h.color === color).length;
              if (count === 0) return null;
              return (
                <Button
                  key={color}
                  variant={filterColor === color ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterColor(color)}
                  className="text-xs gap-1"
                >
                  <div
                    className="w-3 h-3 rounded"
                    style={{
                      backgroundColor:
                        color === 'yellow'
                          ? '#fef08a'
                          : color === 'green'
                          ? '#86efac'
                          : color === 'blue'
                          ? '#93c5fd'
                          : color === 'pink'
                          ? '#fbcfe8'
                          : '#d8b4fe',
                    }}
                  />
                  {count}
                </Button>
              );
            })}
          </div>
        )}
      </div>

      {/* Highlights list */}
      <ScrollArea className="flex-1">
        {filteredHighlights.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <Highlighter className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h4 className="font-semibold mb-2">No highlights yet</h4>
            <p className="text-sm text-muted-foreground max-w-xs">
              Enable highlight mode in the PDF viewer and select text to create your
              first highlight.
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {Object.entries(highlightsByPage)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([page, pageHighlights]) => {
                const filtered = pageHighlights.filter((h) =>
                  filterColor ? h.color === filterColor : true
                );
                if (filtered.length === 0) return null;

                return (
                  <div key={page} className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <span>Page {page}</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>

                    {filtered.map((highlight) => (
                      <HighlightCard
                        key={highlight.id}
                        highlight={highlight}
                        annotations={annotations[highlight.id] || []}
                        isSelected={selectedHighlight?.id === highlight.id}
                        onSelect={() => handleJumpToHighlight(highlight)}
                        onChangeColor={(color) => updateHighlightColor(highlight.id, color)}
                        onDelete={() => deleteHighlight(highlight.id)}
                        onAddAnnotation={(text) => createAnnotation(highlight.id, text)}
                        onEditAnnotation={updateAnnotation}
                        onDeleteAnnotation={deleteAnnotation}
                      />
                    ))}
                  </div>
                );
              })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

interface HighlightCardProps {
  highlight: PaperHighlight;
  annotations: PaperAnnotation[];
  isSelected: boolean;
  onSelect: () => void;
  onChangeColor: (color: string) => void;
  onDelete: () => void;
  onAddAnnotation: (text: string) => void;
  onEditAnnotation: (id: string, text: string) => void;
  onDeleteAnnotation: (id: string) => void;
}

function HighlightCard({
  highlight,
  annotations,
  isSelected,
  onSelect,
  onChangeColor,
  onDelete,
  onAddAnnotation,
  onEditAnnotation,
  onDeleteAnnotation,
}: HighlightCardProps) {
  const [showAnnotationInput, setShowAnnotationInput] = useState(false);
  const [annotationInput, setAnnotationInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const handleAddAnnotation = () => {
    if (!annotationInput.trim()) return;
    onAddAnnotation(annotationInput);
    setAnnotationInput('');
    setShowAnnotationInput(false);
  };

  const handleEditAnnotation = (id: string) => {
    if (!editText.trim()) return;
    onEditAnnotation(id, editText);
    setEditingId(null);
    setEditText('');
  };

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-3 space-y-2 transition-all cursor-pointer hover:shadow-md',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={onSelect}
    >
      {/* Highlight text */}
      <div className="flex items-start gap-2">
        <div
          className="w-1 h-full rounded-full shrink-0 mt-1"
          style={{
            backgroundColor:
              highlight.color === 'yellow'
                ? '#fef08a'
                : highlight.color === 'green'
                ? '#86efac'
                : highlight.color === 'blue'
                ? '#93c5fd'
                : highlight.color === 'pink'
                ? '#fbcfe8'
                : '#d8b4fe',
          }}
        />
        <p className="text-sm flex-1">{highlight.text_content}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setShowAnnotationInput(!showAnnotationInput);
          }}
          className="gap-1 h-7 text-xs"
        >
          <MessageSquare className="h-3 w-3" />
          Note {annotations.length > 0 && `(${annotations.length})`}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="gap-1 h-7 text-xs text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {/* Annotations */}
      {annotations.length > 0 && (
        <div className="space-y-2 pl-3 border-l-2 ml-1">
          {annotations.map((annotation) => (
            <div key={annotation.id} className="text-sm space-y-1">
              {editingId === annotation.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="min-h-[60px]"
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditAnnotation(annotation.id);
                      }}
                      className="h-7"
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(null);
                      }}
                      className="h-7"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-muted-foreground">{annotation.content}</p>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(annotation.id);
                        setEditText(annotation.content);
                      }}
                      className="h-6 px-2 text-xs"
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteAnnotation(annotation.id);
                      }}
                      className="h-6 px-2 text-xs text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add annotation input */}
      {showAnnotationInput && (
        <div className="space-y-2 pl-3">
          <Textarea
            value={annotationInput}
            onChange={(e) => setAnnotationInput(e.target.value)}
            placeholder="Add a note..."
            className="min-h-[60px]"
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
          <div className="flex gap-1">
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleAddAnnotation();
              }}
              className="h-7"
            >
              Add Note
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setShowAnnotationInput(false);
                setAnnotationInput('');
              }}
              className="h-7"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

