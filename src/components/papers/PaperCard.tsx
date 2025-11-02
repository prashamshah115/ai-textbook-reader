// PaperCard - Individual paper display in library
// Based on Open Paper's paper card design

import React from 'react';
import type { Paper } from '../../lib/papers/types';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  FileText,
  MoreVertical,
  Trash2,
  Download,
  FolderPlus,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaperCardProps {
  paper: Paper;
  viewMode: 'grid' | 'list';
  onClick: () => void;
  onDelete: () => void;
}

export default function PaperCard({ paper, viewMode, onClick, onDelete }: PaperCardProps) {
  const statusColors = {
    processing: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    completed: 'bg-green-100 text-green-800 border-green-200',
    failed: 'bg-red-100 text-red-800 border-red-200',
  };

  const statusLabels = {
    processing: 'Processing',
    completed: 'Ready',
    failed: 'Failed',
  };

  if (viewMode === 'list') {
    return (
      <Card
        className="hover:shadow-md transition-shadow cursor-pointer"
        onClick={onClick}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            {/* Preview image or icon */}
            <div className="w-16 h-20 bg-muted rounded flex items-center justify-center shrink-0">
              {paper.preview_image_url ? (
                <img
                  src={paper.preview_image_url}
                  alt=""
                  className="w-full h-full object-cover rounded"
                />
              ) : (
                <FileText className="h-8 w-8 text-muted-foreground" />
              )}
            </div>

            {/* Metadata */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{paper.title}</h3>
                  {paper.authors && paper.authors.length > 0 && (
                    <p className="text-sm text-muted-foreground truncate">
                      {paper.authors.join(', ')}
                    </p>
                  )}
                </div>
                <Badge variant="outline" className={statusColors[paper.status]}>
                  {statusLabels[paper.status]}
                </Badge>
              </div>

              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span>{paper.total_pages} pages</span>
                {paper.metadata?.year && <span>• {paper.metadata.year}</span>}
                {paper.last_accessed_at && (
                  <span>• Opened {formatDate(paper.last_accessed_at)}</span>
                )}
              </div>

              {paper.abstract && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                  {paper.abstract}
                </p>
              )}
            </div>

            {/* Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                  <FolderPlus className="h-4 w-4 mr-2" />
                  Add to Project
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Grid view
  return (
    <Card
      className="hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col"
      onClick={onClick}
    >
      {/* Preview image */}
      <div className="h-40 bg-muted flex items-center justify-center border-b relative overflow-hidden">
        {paper.preview_image_url ? (
          <img
            src={paper.preview_image_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <FileText className="h-16 w-16 text-muted-foreground" />
        )}
        <Badge
          variant="outline"
          className={cn('absolute top-2 right-2', statusColors[paper.status])}
        >
          {statusLabels[paper.status]}
        </Badge>
      </div>

      <CardHeader className="flex-1">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base line-clamp-2">{paper.title}</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                <FolderPlus className="h-4 w-4 mr-2" />
                Add to Project
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {paper.authors && paper.authors.length > 0 && (
          <CardDescription className="line-clamp-1">
            {paper.authors.slice(0, 2).join(', ')}
            {paper.authors.length > 2 && ` +${paper.authors.length - 2}`}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{paper.total_pages} pages</span>
          {paper.metadata?.year && <span>{paper.metadata.year}</span>}
        </div>

        {paper.last_accessed_at && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
            <Clock className="h-3 w-3" />
            <span>Opened {formatDate(paper.last_accessed_at)}</span>
          </div>
        )}

        {paper.metadata?.keywords && paper.metadata.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {paper.metadata.keywords.slice(0, 3).map((keyword: string) => (
              <Badge key={keyword} variant="secondary" className="text-xs">
                {keyword}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

