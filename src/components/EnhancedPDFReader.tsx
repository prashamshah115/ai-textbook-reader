import React, { useState, useRef } from 'react';
import { useSprint } from '../contexts/SprintContext';
import { PDFReader } from './PDFReader';
import { MinimalAIPane } from './MinimalAIPane';
import { ExplainTooltip } from './ExplainTooltip';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight,
  Menu,
  X
} from 'lucide-react';
import { cn } from './ui/utils';

/**
 * EnhancedPDFReader - Full 3-column reading experience
 * Left: Daily topics sidebar (collapsible)
 * Center: PDF/content viewer with selection support
 * Right: Notes, Recall, Chat tabs
 */
export function EnhancedPDFReader() {
  const {
    currentSprint,
    contentItems,
    selectedContent,
    selectContent,
    activeDayIndex,
    setViewMode,
  } = useSprint();

  const [showSidebar, setShowSidebar] = useState(true);
  const [tooltipData, setTooltipData] = useState<{
    text: string;
    position: { x: number; y: number };
  } | null>(null);

  const handleTextSelect = (text: string, position: { x: number; y: number }) => {
    setTooltipData({ text, position });
  };

  const handleCloseTooltip = () => {
    setTooltipData(null);
  };

  const handleAddToNotes = () => {
    console.log('Add to notes:', tooltipData?.text);
    setTooltipData(null);
  };

  if (!currentSprint) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <p className="text-gray-600">No sprint selected</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('detail')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="text-sm">
            <div className="font-semibold text-gray-900">
              {currentSprint.course_code} - Week {currentSprint.week_number}
            </div>
            <div className="text-gray-600">
              {currentSprint.week_topic}
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSidebar(!showSidebar)}
          className="lg:hidden"
        >
          {showSidebar ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </Button>
      </header>

      {/* Main 3-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Daily Topics */}
        <aside
          className={cn(
            'w-64 bg-white border-r border-gray-200 overflow-y-auto transition-all duration-200',
            showSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
            'absolute lg:relative h-full z-10 lg:z-0'
          )}
        >
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Daily Topics
            </h3>
            <div className="space-y-2">
              {currentSprint.dailySessions.map((session, index) => (
                <button
                  key={index}
                  className={cn(
                    'w-full text-left p-3 rounded-lg transition-colors',
                    activeDayIndex === index
                      ? 'bg-blue-50 border border-blue-200'
                      : 'bg-gray-50 border border-transparent hover:bg-gray-100'
                  )}
                >
                  <div className="text-xs font-medium text-gray-900">
                    {session.day}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {session.topic}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Materials
              </h3>
              <div className="space-y-2">
                {contentItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => selectContent(item)}
                    className={cn(
                      'w-full text-left p-2 rounded text-xs transition-colors',
                      selectedContent?.id === item.id
                        ? 'bg-blue-50 text-blue-700'
                        : 'hover:bg-gray-100 text-gray-700'
                    )}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Center: PDF Viewer */}
        <main className="flex-1 overflow-hidden relative">
          {selectedContent ? (
            <PDFReader onTextSelect={handleTextSelect} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Card className="p-8 text-center">
                <p className="text-gray-600">Select a material to start reading</p>
              </Card>
            </div>
          )}
        </main>

        {/* Right: AI Learning Pane */}
        <aside className="w-96 bg-white border-l border-gray-200 overflow-y-auto">
          <MinimalAIPane />
        </aside>
      </div>

      {/* Explain Tooltip */}
      {tooltipData && (
        <ExplainTooltip
          text={tooltipData.text}
          position={tooltipData.position}
          onClose={handleCloseTooltip}
          onAddToNotes={handleAddToNotes}
        />
      )}
    </div>
  );
}

