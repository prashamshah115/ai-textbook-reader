// PaperViewer - Main Component for Reading Papers
// Based on Open Paper's proven split-view design
// Reuses existing PDFReader + adds highlight layer + AI chat

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePaper } from '../../contexts/PaperContext';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../ui/resizable';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  ArrowLeft, 
  FileText, 
  MessageSquare, 
  Highlighter,
  Download,
  Share2 
} from 'lucide-react';
import PaperPDFViewer from './PaperPDFViewer';
import PaperChatPanel from './PaperChatPanel';
import PaperAnnotationsPanel from './PaperAnnotationsPanel';
import PaperMetadataHeader from './PaperMetadataHeader';

export default function PaperViewer() {
  const { paperId } = useParams<{ paperId: string }>();
  const navigate = useNavigate();
  const { 
    currentPaper, 
    loading, 
    error, 
    loadPaper,
    highlights,
    selectedHighlight,
    annotations 
  } = usePaper();

  const [activePanel, setActivePanel] = useState<'chat' | 'annotations'>('chat');

  useEffect(() => {
    if (paperId) {
      loadPaper(paperId);
    }
  }, [paperId, loadPaper]);

  if (loading && !currentPaper) {
    return (
      <div className="h-screen flex flex-col">
        <PaperViewerSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>
            <p className="font-semibold">Failed to load paper</p>
            <p className="text-sm mt-1">{error}</p>
            <Button 
              onClick={() => navigate('/papers')} 
              className="mt-4"
              variant="outline"
            >
              Back to Library
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!currentPaper) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Paper not found</p>
      </div>
    );
  }

  if (currentPaper.status === 'processing') {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="text-lg font-medium">Processing PDF...</p>
          <p className="text-sm text-muted-foreground">
            Extracting text and generating metadata
          </p>
        </div>
      </div>
    );
  }

  if (currentPaper.status === 'failed') {
    return (
      <div className="h-screen flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>
            <p className="font-semibold">Processing failed</p>
            <p className="text-sm mt-1">
              {currentPaper.processing_error || 'An error occurred while processing this PDF'}
            </p>
            <Button 
              onClick={() => navigate('/papers')} 
              className="mt-4"
              variant="outline"
            >
              Back to Library
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header with paper metadata and actions */}
      <div className="border-b bg-card">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/papers')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Library
            </Button>
            <div className="h-6 w-px bg-border" />
            <PaperMetadataHeader paper={currentPaper} />
          </div>

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center gap-1 bg-muted rounded-md p-1">
              <Button
                variant={activePanel === 'chat' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setActivePanel('chat')}
                className="gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Chat
              </Button>
              <Button
                variant={activePanel === 'annotations' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setActivePanel('annotations')}
                className="gap-2"
              >
                <Highlighter className="h-4 w-4" />
                Annotations
                {highlights.length > 0 && (
                  <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                    {highlights.length}
                  </span>
                )}
              </Button>
            </div>

            {/* Actions */}
            <div className="h-6 w-px bg-border" />
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>
        </div>
      </div>

      {/* Main content: PDF + Side Panel */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* PDF Viewer */}
        <ResizablePanel defaultSize={60} minSize={40}>
          <PaperPDFViewer 
            paper={currentPaper}
            highlights={highlights}
            selectedHighlight={selectedHighlight}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Side Panel (Chat or Annotations) */}
        <ResizablePanel defaultSize={40} minSize={30}>
          {activePanel === 'chat' ? (
            <PaperChatPanel paper={currentPaper} />
          ) : (
            <PaperAnnotationsPanel 
              highlights={highlights}
              annotations={annotations}
            />
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function PaperViewerSkeleton() {
  return (
    <>
      <div className="border-b bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-6 w-64" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-[1fr,400px]">
        <div className="flex items-center justify-center">
          <Skeleton className="h-[600px] w-[450px]" />
        </div>
        <div className="border-l p-4 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </>
  );
}

