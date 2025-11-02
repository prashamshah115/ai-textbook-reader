// PaperPDFViewer - PDF Display with Highlight Overlay
// Based on Open Paper's working highlight system
// Reuses your existing PDFReader as the base

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { usePaper } from '../../contexts/PaperContext';
import type { Paper, PaperHighlight } from '../../lib/papers/types';
import { Button } from '../ui/button';
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut,
  Highlighter 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set up PDF.js worker (your existing setup)
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';

interface PaperPDFViewerProps {
  paper: Paper;
  highlights: PaperHighlight[];
  selectedHighlight: PaperHighlight | null;
}

type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple';

const COLOR_MAP: Record<HighlightColor, string> = {
  yellow: 'rgba(255, 235, 59, 0.4)',
  green: 'rgba(76, 175, 80, 0.4)',
  blue: 'rgba(33, 150, 243, 0.4)',
  pink: 'rgba(233, 30, 99, 0.4)',
  purple: 'rgba(156, 39, 176, 0.4)',
};

export default function PaperPDFViewer({
  paper,
  highlights,
  selectedHighlight,
}: PaperPDFViewerProps) {
  const { 
    currentPage, 
    setCurrentPage, 
    createHighlight,
    selectHighlight 
  } = usePaper();

  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState(1.2);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedColor, setSelectedColor] = useState<HighlightColor>('yellow');
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  const handleTextSelection = useCallback(() => {
    if (!isSelecting) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const textContent = selection.toString().trim();

    if (textContent.length < 3) {
      selection.removeAllRanges();
      return;
    }

    // Get bounding rectangles for the selection
    const rects = Array.from(range.getClientRects()).map((rect) => {
      const pageRect = pageRef.current?.getBoundingClientRect();
      if (!pageRect) return null;

      return {
        x: (rect.left - pageRect.left) / scale,
        y: (rect.top - pageRect.top) / scale,
        width: rect.width / scale,
        height: rect.height / scale,
      };
    }).filter(Boolean);

    if (rects.length === 0) return;

    // Calculate bounding rect
    const left = Math.min(...rects.map((r) => r!.x));
    const top = Math.min(...rects.map((r) => r!.y));
    const right = Math.max(...rects.map((r) => r!.x + r!.width));
    const bottom = Math.max(...rects.map((r) => r!.y + r!.height));

    const position = {
      rects: rects as any[],
      pageIndex: currentPage - 1,
      boundingRect: {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
      },
    };

    // Create highlight
    createHighlight(currentPage, textContent, position, selectedColor);

    // Clear selection
    selection.removeAllRanges();
  }, [isSelecting, currentPage, selectedColor, scale, createHighlight]);

  const pageHighlights = highlights.filter((h) => h.page_number === currentPage);

  return (
    <div className="h-full flex flex-col bg-muted/20">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card">
        <div className="flex items-center gap-2">
          {/* Highlight mode toggle */}
          <Button
            variant={isSelecting ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIsSelecting(!isSelecting)}
            className="gap-2"
          >
            <Highlighter className="h-4 w-4" />
            {isSelecting ? 'Highlighting' : 'Highlight'}
          </Button>

          {/* Color picker (when highlighting) */}
          {isSelecting && (
            <div className="flex items-center gap-1 px-2">
              {Object.keys(COLOR_MAP).map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color as HighlightColor)}
                  className={cn(
                    "w-6 h-6 rounded border-2 transition-all",
                    selectedColor === color 
                      ? "border-foreground scale-110" 
                      : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: COLOR_MAP[color as HighlightColor] }}
                  title={color}
                />
              ))}
            </div>
          )}
        </div>

        {/* Page navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[100px] text-center">
            Page {currentPage} / {numPages || paper.total_pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(numPages || paper.total_pages, currentPage + 1))}
            disabled={currentPage >= (numPages || paper.total_pages)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setScale(Math.max(0.5, scale - 0.1))}
            disabled={scale <= 0.5}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[50px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setScale(Math.min(2.5, scale + 0.1))}
            disabled={scale >= 2.5}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF Display */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto flex items-start justify-center p-4"
        onMouseUp={handleTextSelection}
      >
        <div 
          ref={pageRef}
          className="relative bg-white shadow-lg"
          style={{
            cursor: isSelecting ? 'text' : 'default',
          }}
        >
          <Document
            file={paper.pdf_url}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex items-center justify-center h-96 w-96 bg-muted">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
              </div>
            }
          >
            <Page
              pageNumber={currentPage}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={false}
            />
          </Document>

          {/* Highlight Overlay */}
          <div className="absolute inset-0 pointer-events-none">
            {pageHighlights.map((highlight) => (
              <React.Fragment key={highlight.id}>
                {highlight.position.rects.map((rect, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "absolute transition-opacity cursor-pointer pointer-events-auto",
                      selectedHighlight?.id === highlight.id 
                        ? "opacity-100 ring-2 ring-foreground" 
                        : "opacity-70 hover:opacity-100"
                    )}
                    style={{
                      left: `${rect.x * scale}px`,
                      top: `${rect.y * scale}px`,
                      width: `${rect.width * scale}px`,
                      height: `${rect.height * scale}px`,
                      backgroundColor: COLOR_MAP[highlight.color],
                    }}
                    onClick={() => selectHighlight(highlight.id)}
                    title={highlight.text_content}
                  />
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="px-4 py-2 border-t bg-card text-xs text-muted-foreground">
        {pageHighlights.length} highlight{pageHighlights.length !== 1 ? 's' : ''} on this page
        {isSelecting && (
          <span className="ml-4">
            • Select text to highlight with <span className="font-medium capitalize">{selectedColor}</span>
          </span>
        )}
      </div>
    </div>
  );
}

