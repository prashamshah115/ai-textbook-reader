import { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2, Upload } from 'lucide-react';
import { Button } from './ui/button';
import { useTextbook } from '../contexts/TextbookContext';
import { UploadDialog } from './UploadDialog';
import type { UploadMetadata } from './UploadDialog';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { supabase } from '../lib/supabase';
import { PerformanceTimer } from '../lib/events';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PDFReaderProps {
  onTextSelect: (text: string, position: { x: number; y: number }) => void;
}

export function PDFReader({ onTextSelect }: PDFReaderProps) {
  const [zoom, setZoom] = useState(100);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageRenderTime, setPageRenderTime] = useState<number | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const pageTimerRef = useRef<PerformanceTimer | null>(null);
  const { currentTextbook, currentPage, currentPageData, loading, nextPage, prevPage, uploadTextbook, setActualPageCount } = useTextbook();

  // 🔥 DAY 5: Track page turn performance
  useEffect(() => {
    if (currentTextbook) {
      pageTimerRef.current = new PerformanceTimer(
        'page_turn',
        currentTextbook.id,
        { from_page: currentPage - 1, to_page: currentPage }
      );
    }
  }, [currentPage, currentTextbook]);

  // 🔥 PHASE 1: Enhanced PDF prefetching for instant page turns
  useEffect(() => {
    if (!currentTextbook || !numPages) return;

    // Prefetch first 5 pages aggressively on load
    const isInitialLoad = currentPage === 1;
    const pagesToPrefetch = isInitialLoad
      ? Array.from({ length: Math.min(5, numPages) }, (_, i) => i + 1)
      : [
          currentPage - 2,
          currentPage - 1,
          currentPage + 1,
          currentPage + 2,
        ].filter((p) => p >= 1 && p <= numPages && p !== currentPage);

    console.log('[PDFReader] Prefetching pages:', pagesToPrefetch);

    // Use pdfjs-dist to preload pages into cache
    if (currentTextbook.pdf_url) {
      pagesToPrefetch.forEach((pageNum) => {
        pdfjs.getDocument(currentTextbook.pdf_url!).promise
          .then((pdf) => pdf.getPage(pageNum))
          .then((page) => {
            // Create offscreen canvas to cache the page rendering
            const viewport = page.getViewport({ scale: 1.0 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const context = canvas.getContext('2d');
            if (context) {
              page.render({ canvasContext: context, viewport }).promise
                .then(() => console.log(`[PDFReader] ✓ Cached page ${pageNum}`))
                .catch(() => {}); // Silently fail prefetch
            }
          })
          .catch(() => {}); // Silently fail prefetch
      });
    }
  }, [currentPage, currentTextbook, numPages]);

  const handleUpload = async (file: File, metadata: UploadMetadata) => {
    await uploadTextbook(file, metadata);
  };

  const handleDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setActualPageCount(numPages);
    console.log('[PDFReader] PDF loaded successfully, pages:', numPages);
    
    // Record TTFP (Time to First Page) metric
    if (currentTextbook && pageTimerRef.current) {
      const duration = pageTimerRef.current.getDuration();
      
      // Use proper Supabase error handling pattern
      supabase.from('metrics').insert({
        metric_name: 'ttfp',
        value: duration,
        unit: 'ms',
        textbook_id: currentTextbook.id,
        metadata: { total_pages: numPages }
        // user_id auto-populated by DEFAULT in schema
      }).then(({ error }) => {
        if (error) {
          console.log('[PDFReader] Metrics insert failed (non-critical):', error.message);
        }
      });
      
      console.log(`[PDFReader] TTFP: ${duration.toFixed(0)}ms`);
    }
  };

  // 🔥 FIXED: Track page render WITHOUT blocking text extraction
  const handlePageLoadSuccess = async (page: any) => {
    if (pageTimerRef.current) {
      const duration = pageTimerRef.current.getDuration();
      setPageRenderTime(duration);
      
      // Record page turn metric
      if (currentTextbook) {
        pageTimerRef.current.end(supabase);
      }
      
      console.log(`[PDFReader] Page ${currentPage} rendered in ${duration.toFixed(0)}ms`);
    }

    // ✅ CLIENT-SIDE TEXT EXTRACTION DISABLED
    // Text extraction now happens via background queue worker
    // This prevents UI freezing and allows instant page navigation
    console.log(`[PDFReader] ✓ Page ${currentPage} ready (text extraction handled by queue)`);
  };

  const handleMouseUp = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    
    if (text && text.length > 10 && canvasRef.current) {
      const range = selection?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();
      
      if (rect) {
        onTextSelect(text, { x: rect.left + rect.width / 2, y: rect.top });
      }
    }
  };

  if (!currentTextbook) {
    return (
      <div className="h-full flex items-center justify-center bg-neutral-100">
        <div className="text-center space-y-6 max-w-md px-6">
          <div className="space-y-2">
            <div className="flex justify-center">
              <div className="p-4 bg-primary/10 rounded-full">
                <Upload className="w-12 h-12 text-primary" />
              </div>
            </div>
            <h3 className="text-xl font-semibold">No textbook loaded</h3>
            <p className="text-sm text-muted-foreground">
              Upload a PDF textbook to start reading with AI-powered summaries, practice questions, and interactive chat.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Upload button clicked!');
                setUploadDialogOpen(true);
              }} 
              size="lg"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload PDF
            </Button>
          </div>

          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Supported: PDF files up to 50MB
            </p>
          </div>
        </div>

        <UploadDialog 
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          onUpload={handleUpload}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Toolbar */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={prevPage}
            disabled={currentPage === 1 || loading}
            className="h-7 px-2"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground min-w-[80px] text-center">
            {currentPage} / {numPages || currentTextbook.total_pages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={nextPage}
            disabled={currentPage === (numPages || currentTextbook.total_pages) || loading}
            className="h-7 px-2"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setZoom(Math.max(50, zoom - 10))}
            className="h-7 px-2"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground min-w-[50px] text-center">
            {zoom}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setZoom(Math.min(200, zoom + 10))}
            className="h-7 px-2"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* PDF Canvas - Show actual PDF */}
      <div className="flex-1 overflow-auto bg-neutral-100 p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : currentTextbook?.pdf_url ? (
          <div className="flex justify-center" ref={canvasRef} onMouseUp={handleMouseUp}>
            <Document
              file={currentTextbook.pdf_url}
              onLoadSuccess={handleDocumentLoadSuccess}
              loading={
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              }
              error={
                <div className="flex items-center justify-center py-20">
                  <p className="text-red-500">Failed to load PDF</p>
                </div>
              }
            >
              <Page
                pageNumber={currentPage}
                scale={zoom / 100}
                className="shadow-lg"
                onLoadSuccess={handlePageLoadSuccess}
                loading={
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                }
                renderTextLayer={true}
                renderAnnotationLayer={false}
              />
            </Document>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">No PDF available</p>
          </div>
        )}
      </div>
    </div>
  );
}
