import React from 'react';
import { useWeekBundle } from '../../contexts/WeekBundleContext';
import type { ContentItem } from '../../contexts/WeekBundleContext';
import { BookOpen, Presentation, FileText, GraduationCap } from 'lucide-react';
import { cn } from '../ui/utils';

/**
 * Content Catalog - Left sidebar showing all materials
 */
export default function ContentCatalog() {
  const { contentItems, selectedContent, selectContent } = useWeekBundle();

  // Group items by type
  const textbooks = contentItems.filter(item => item.content_type === 'textbook');
  const slides = contentItems.filter(item => item.content_type === 'slides');
  const homework = contentItems.filter(item => item.content_type === 'homework');
  const papers = contentItems.filter(item => item.content_type === 'paper');

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Course Materials</h2>

      {/* Textbooks Section */}
      {textbooks.length > 0 && (
        <ContentSection
          title="Textbooks"
          icon={<BookOpen className="w-5 h-5" />}
          items={textbooks}
          selectedContent={selectedContent}
          onSelect={selectContent}
        />
      )}

      {/* Slides Section */}
      {slides.length > 0 && (
        <ContentSection
          title="Lecture Slides"
          icon={<Presentation className="w-5 h-5" />}
          items={slides}
          selectedContent={selectedContent}
          onSelect={selectContent}
        />
      )}

      {/* Homework Section */}
      {homework.length > 0 && (
        <ContentSection
          title="Homework"
          icon={<FileText className="w-5 h-5" />}
          items={homework}
          selectedContent={selectedContent}
          onSelect={selectContent}
        />
      )}

      {/* Papers Section */}
      {papers.length > 0 && (
        <ContentSection
          title="Research Papers"
          icon={<GraduationCap className="w-5 h-5" />}
          items={papers}
          selectedContent={selectedContent}
          onSelect={selectContent}
        />
      )}

      {contentItems.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No materials found</p>
        </div>
      )}
    </div>
  );
}

interface ContentSectionProps {
  title: string;
  icon: React.ReactNode;
  items: ContentItem[];
  selectedContent: ContentItem | null;
  onSelect: (item: ContentItem) => void;
}

function ContentSection({ title, icon, items, selectedContent, onSelect }: ContentSectionProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
        {icon}
        <span>{title}</span>
        <span className="text-xs text-gray-500">({items.length})</span>
      </div>

      <div className="space-y-1">
        {items.map((item) => (
          <ContentItemCard
            key={item.id}
            item={item}
            isSelected={selectedContent?.id === item.id}
            onSelect={() => onSelect(item)}
          />
        ))}
      </div>
    </div>
  );
}

interface ContentItemCardProps {
  item: ContentItem;
  isSelected: boolean;
  onSelect: () => void;
}

function ContentItemCard({ item, isSelected, onSelect }: ContentItemCardProps) {
  const metadata = item.metadata || {};

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left px-3 py-2 rounded-lg transition-colors',
        'hover:bg-gray-100',
        isSelected ? 'bg-blue-50 border border-blue-200' : 'border border-transparent'
      )}
    >
      <div className="font-medium text-sm text-gray-900 line-clamp-2">
        {item.title}
      </div>

      {/* Type-specific metadata */}
      {item.content_type === 'textbook' && metadata.pages && (
        <div className="text-xs text-gray-600 mt-1">
          Pages {metadata.pages[0]}-{metadata.pages[1]}
          {metadata.chapter && ` • Ch. ${metadata.chapter}`}
        </div>
      )}

      {item.content_type === 'slides' && metadata.pages && (
        <div className="text-xs text-gray-600 mt-1">
          {metadata.pages} slides
          {metadata.professor && ` • ${metadata.professor}`}
        </div>
      )}

      {item.content_type === 'homework' && metadata.problems && (
        <div className="text-xs text-gray-600 mt-1">
          Problems: {metadata.problems.join(', ')}
        </div>
      )}

      {item.content_type === 'paper' && (
        <div className="text-xs text-gray-600 mt-1">
          {metadata.year}
          {metadata.venue && ` • ${metadata.venue}`}
        </div>
      )}

      {/* Confidence score */}
      {item.confidence_score && (
        <div className="flex items-center gap-1 mt-1">
          <div className="w-full bg-gray-200 rounded-full h-1">
            <div
              className="bg-blue-500 h-1 rounded-full"
              style={{ width: `${item.confidence_score * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">
            {Math.round(item.confidence_score * 100)}%
          </span>
        </div>
      )}
    </button>
  );
}


