// PaperLibrary - Main library view for all papers
// Based on Open Paper's library design

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as paperApi from '../../lib/papers/api';
import type { Paper } from '../../lib/papers/types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Skeleton } from '../ui/skeleton';
import {
  Upload,
  Search,
  Grid3x3,
  List,
  SortAsc,
  Filter,
  Plus,
} from 'lucide-react';
import PaperCard from './PaperCard';
import PaperUploadDialog from './PaperUploadDialog';
import { cn } from '@/lib/utils';

export default function PaperLibrary() {
  const navigate = useNavigate();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'accessed'>('date');

  useEffect(() => {
    loadPapers();
  }, []);

  const loadPapers = async () => {
    setLoading(true);
    try {
      const data = await paperApi.listPapers(100);
      setPapers(data);
    } catch (error) {
      console.error('Failed to load papers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadPapers();
      return;
    }

    setLoading(true);
    try {
      const results = await paperApi.searchPapers(searchQuery);
      setPapers(results.papers);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadComplete = (paperId: string) => {
    setUploadDialogOpen(false);
    loadPapers();
    // Navigate to the new paper (it will be processing)
    navigate(`/papers/${paperId}`);
  };

  const handleDeletePaper = async (paperId: string) => {
    if (!confirm('Delete this paper? This cannot be undone.')) return;
    try {
      await paperApi.deletePaper(paperId);
      setPapers((prev) => prev.filter((p) => p.id !== paperId));
    } catch (error) {
      console.error('Failed to delete paper:', error);
    }
  };

  // Sort papers
  const sortedPapers = [...papers].sort((a, b) => {
    switch (sortBy) {
      case 'title':
        return a.title.localeCompare(b.title);
      case 'accessed':
        return (
          new Date(b.last_accessed_at || 0).getTime() -
          new Date(a.last_accessed_at || 0).getTime()
        );
      case 'date':
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">Research Papers</h1>
              <p className="text-sm text-muted-foreground">
                {papers.length} paper{papers.length !== 1 ? 's' : ''} in your library
              </p>
            </div>
            <Button onClick={() => setUploadDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Upload Paper
            </Button>
          </div>

          {/* Search and filters */}
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search papers by title, authors, abstract..."
                  className="pl-9"
                />
              </div>
              <Button onClick={handleSearch} variant="secondary">
                Search
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="h-9 px-3 rounded-md border bg-background text-sm"
              >
                <option value="date">Recent</option>
                <option value="title">Title</option>
                <option value="accessed">Last Accessed</option>
              </select>

              {/* View mode toggle */}
              <div className="flex items-center gap-1 bg-muted rounded-md p-1">
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="h-7 w-7 p-0"
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-7 w-7 p-0"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Papers grid/list */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-6">
            <LibrarySkeleton viewMode={viewMode} />
          </div>
        ) : papers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No papers yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              Upload your first research paper to get started. You can highlight, annotate,
              and chat with your papers.
            </p>
            <Button onClick={() => setUploadDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Upload Paper
            </Button>
          </div>
        ) : (
          <div className="p-6">
            <div
              className={cn(
                viewMode === 'grid'
                  ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                  : 'space-y-3'
              )}
            >
              {sortedPapers.map((paper) => (
                <PaperCard
                  key={paper.id}
                  paper={paper}
                  viewMode={viewMode}
                  onClick={() => navigate(`/papers/${paper.id}`)}
                  onDelete={() => handleDeletePaper(paper.id)}
                />
              ))}
            </div>
          </div>
        )}
      </ScrollArea>

      {/* Upload dialog */}
      <PaperUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  );
}

function LibrarySkeleton({ viewMode }: { viewMode: 'grid' | 'list' }) {
  return (
    <div
      className={cn(
        viewMode === 'grid'
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
          : 'space-y-3'
      )}
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(viewMode === 'grid' ? 'h-64' : 'h-24')}
        />
      ))}
    </div>
  );
}

