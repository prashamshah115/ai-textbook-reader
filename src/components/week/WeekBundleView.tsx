import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useWeekBundle } from '../../contexts/WeekBundleContext';
import ContentCatalog from './ContentCatalog';
import ContentViewer from './ContentViewer';
import { WeekAIPane } from './WeekAIPane';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, BookOpen, FileText, FileCode, GraduationCap } from 'lucide-react';
import { Button } from '../ui/button';

/**
 * Main view for Week Bundle
 * 3-column layout: Catalog | Viewer | AI Pane
 */
export default function WeekBundleView() {
  const { bundleId } = useParams<{ bundleId: string }>();
  const { currentBundle, contentItems, selectedContent, selectContent, loading, error, loadBundle } = useWeekBundle();

  useEffect(() => {
    if (bundleId) {
      loadBundle(bundleId);
    }
  }, [bundleId]);

  // Auto-select first content item when bundle loads
  useEffect(() => {
    if (contentItems.length > 0 && !selectedContent) {
      selectContent(contentItems[0]);
    }
  }, [contentItems, selectedContent]);

  const getContentIcon = (type: string) => {
    switch (type) {
      case 'textbook': return <BookOpen className="w-4 h-4" />;
      case 'slides': return <FileText className="w-4 h-4" />;
      case 'homework': return <FileCode className="w-4 h-4" />;
      case 'paper': return <GraduationCap className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading week bundle...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!currentBundle) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">No bundle found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {currentBundle.course_code} - Week {currentBundle.week_number}
            </h1>
            <p className="text-xs text-gray-600 mt-0.5">
              {currentBundle.week_topic}
            </p>
          </div>
        </div>

        {/* Content Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {contentItems.map((item) => (
            <Button
              key={item.id}
              variant={selectedContent?.id === item.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => selectContent(item)}
              className="flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              {getContentIcon(item.content_type)}
              <span className="text-sm">{item.title}</span>
            </Button>
          ))}
        </div>
      </header>

      {/* Main 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Content Catalog */}
        <aside className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
          <ContentCatalog />
        </aside>

        {/* Center: Content Viewer */}
        <main className="flex-1 overflow-hidden">
          <ContentViewer />
        </main>

        {/* Right: AI Learning Pane */}
        <aside className="w-96 bg-white border-l border-gray-200 overflow-y-auto">
          <WeekAIPane />
        </aside>
      </div>
    </div>
  );
}



