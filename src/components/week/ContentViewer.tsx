import React, { useEffect } from 'react';
import { useWeekBundle } from '../../contexts/WeekBundleContext';
import { PDFReader } from '../PDFReader';
import { Alert, AlertDescription } from '../ui/alert';
import { ExternalLink, FileText } from 'lucide-react';
import { Button } from '../ui/button';

/**
 * Content Viewer - Center pane that displays selected content
 * Conditionally renders appropriate viewer based on content type
 */
export default function ContentViewer() {
  const { selectedContent, trackAccess } = useWeekBundle();

  // Track access when content changes
  useEffect(() => {
    if (selectedContent) {
      trackAccess(selectedContent.id);
    }
  }, [selectedContent?.id]);

  if (!selectedContent) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-center text-gray-500">
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>Select a material from the catalog to view</p>
        </div>
      </div>
    );
  }

  // Render based on content type
  switch (selectedContent.content_type) {
    case 'textbook':
      return <TextbookViewer content={selectedContent} />;
    
    case 'slides':
      return <SlidesViewer content={selectedContent} />;
    
    case 'homework':
      return <HomeworkViewer content={selectedContent} />;
    
    case 'paper':
      return <PaperViewer content={selectedContent} />;
    
    default:
      return (
        <div className="flex items-center justify-center h-full">
          <Alert>
            <AlertDescription>
              Unsupported content type: {selectedContent.content_type}
            </AlertDescription>
          </Alert>
        </div>
      );
  }
}

/**
 * Textbook Viewer - Reuses existing PDFReader
 */
function TextbookViewer({ content }: { content: any }) {
  const metadata = content.metadata || {};

  return (
    <div className="h-full flex flex-col">
      {/* Header with metadata */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <h3 className="font-semibold text-gray-900">{content.title}</h3>
        <div className="text-sm text-gray-600 mt-1">
          {metadata.authors && (
            <span>{metadata.authors.join(', ')}</span>
          )}
          {metadata.chapter && (
            <span className="ml-2">Chapter {metadata.chapter}</span>
          )}
          {metadata.pages && (
            <span className="ml-2">
              Pages {metadata.pages[0]}-{metadata.pages[1]}
            </span>
          )}
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1">
        {content.source_url ? (
          <PDFReader />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Alert>
              <AlertDescription>
                No PDF URL available. Upload this textbook manually or provide a URL.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Slides Viewer - Also uses PDFReader (slides are PDFs)
 */
function SlidesViewer({ content }: { content: any }) {
  const metadata = content.metadata || {};

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <h3 className="font-semibold text-gray-900">{content.title}</h3>
        <div className="text-sm text-gray-600 mt-1">
          {metadata.professor && <span>{metadata.professor}</span>}
          {metadata.pages && (
            <span className="ml-2">{metadata.pages} slides</span>
          )}
        </div>
        {content.source_url && (
          <a
            href={content.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline flex items-center gap-1 mt-1"
          >
            <ExternalLink className="w-3 h-3" />
            View original
          </a>
        )}
      </div>

      {/* PDF Viewer */}
      <div className="flex-1">
        {content.source_url ? (
          <PDFReader />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Alert>
              <AlertDescription>
                Slides URL not available. Please check the course website.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Homework Viewer - Simple display of problems + link
 */
function HomeworkViewer({ content }: { content: any }) {
  const metadata = content.metadata || {};

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="max-w-3xl mx-auto p-8">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {content.title}
          </h2>
          {metadata.dueDate && (
            <p className="text-sm text-gray-600">
              Due: {new Date(metadata.dueDate).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Problems List */}
        {metadata.problems && metadata.problems.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Problems to Complete
            </h3>
            <div className="space-y-2">
              {metadata.problems.map((problem: string) => (
                <div
                  key={problem}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  <div className="w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full font-medium">
                    {problem}
                  </div>
                  <span className="text-gray-700">Problem {problem}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Link to assignment */}
        {content.source_url && (
          <div>
            <Button asChild>
              <a
                href={content.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                View Full Assignment
              </a>
            </Button>
          </div>
        )}

        {!content.source_url && (
          <Alert>
            <AlertDescription>
              Assignment URL not available. Check your course website or LMS.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}

/**
 * Paper Viewer - Uses PDFReader for academic papers
 */
function PaperViewer({ content }: { content: any }) {
  const metadata = content.metadata || {};

  return (
    <div className="h-full flex flex-col">
      {/* Header with paper metadata */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <h3 className="font-semibold text-gray-900">{content.title}</h3>
        <div className="text-sm text-gray-600 mt-1">
          {metadata.authors && metadata.authors.length > 0 && (
            <div>{metadata.authors.join(', ')}</div>
          )}
          <div className="flex items-center gap-2 mt-1">
            {metadata.year && <span>{metadata.year}</span>}
            {metadata.venue && <span>• {metadata.venue}</span>}
          </div>
        </div>
        {content.source_url && (
          <a
            href={content.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline flex items-center gap-1 mt-2"
          >
            <ExternalLink className="w-3 h-3" />
            View on publisher site
          </a>
        )}
      </div>

      {/* PDF Viewer */}
      <div className="flex-1">
        {content.source_url ? (
          <PDFReader />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Alert>
              <AlertDescription>
                Paper URL not available. Try searching on Google Scholar or arXiv.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>
    </div>
  );
}


