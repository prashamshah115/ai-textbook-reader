import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useWeekBundle } from '../../contexts/WeekBundleContext';
import ContentCatalog from './ContentCatalog';
import ContentViewer from './ContentViewer';
import { MinimalAIPane } from '../MinimalAIPane';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2 } from 'lucide-react';

/**
 * Main view for Week Bundle
 * 3-column layout: Catalog | Viewer | AI Pane
 */
export default function WeekBundleView() {
  const { bundleId } = useParams<{ bundleId: string }>();
  const { currentBundle, loading, error, loadBundle } = useWeekBundle();

  useEffect(() => {
    if (bundleId) {
      loadBundle(bundleId);
    }
  }, [bundleId]);

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
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {currentBundle.course_code} - Week {currentBundle.week_number}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {currentBundle.week_topic} • {currentBundle.institution}
            </p>
          </div>
          <div className="text-sm text-gray-500">
            {currentBundle.course_name}
          </div>
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
          <MinimalAIPane />
        </aside>
      </div>
    </div>
  );
}


