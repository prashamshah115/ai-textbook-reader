// PaperMetadataHeader - Display paper metadata
// Based on Open Paper's metadata display

import React, { useState } from 'react';
import type { Paper } from '../../lib/papers/types';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { FileText, Users, Calendar, Edit2, Check, X } from 'lucide-react';
import { Input } from '../ui/input';
import { usePaper } from '../../contexts/PaperContext';

interface PaperMetadataHeaderProps {
  paper: Paper;
}

export default function PaperMetadataHeader({ paper }: PaperMetadataHeaderProps) {
  const { updatePaperMetadata } = usePaper();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(paper.title);

  const handleSaveTitle = async () => {
    if (editedTitle.trim() && editedTitle !== paper.title) {
      await updatePaperMetadata(paper.id, { title: editedTitle });
    }
    setIsEditingTitle(false);
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center w-8 h-8 rounded bg-primary/10 shrink-0">
        <FileText className="h-4 w-4 text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        {isEditingTitle ? (
          <div className="flex items-center gap-2">
            <Input
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTitle();
                if (e.key === 'Escape') {
                  setIsEditingTitle(false);
                  setEditedTitle(paper.title);
                }
              }}
              className="h-8"
              autoFocus
            />
            <Button size="sm" onClick={handleSaveTitle} className="h-8 w-8 p-0">
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setIsEditingTitle(false);
                setEditedTitle(paper.title);
              }}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h2 className="font-semibold truncate">{paper.title}</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditingTitle(true)}
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          </div>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
          {/* Authors */}
          {paper.authors && paper.authors.length > 0 && (
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span className="truncate max-w-[200px]">
                {paper.authors.slice(0, 2).join(', ')}
                {paper.authors.length > 2 && ` +${paper.authors.length - 2}`}
              </span>
            </div>
          )}

          {/* Year */}
          {paper.metadata?.year && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{paper.metadata.year}</span>
            </div>
          )}

          {/* Pages */}
          <div className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            <span>{paper.total_pages} pages</span>
          </div>

          {/* Keywords */}
          {paper.metadata?.keywords && paper.metadata.keywords.length > 0 && (
            <div className="flex items-center gap-1">
              {paper.metadata.keywords.slice(0, 2).map((keyword: string) => (
                <Badge key={keyword} variant="secondary" className="text-xs">
                  {keyword}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

