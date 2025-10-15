import { X, Brain, FileText, Lightbulb, StickyNote } from 'lucide-react';
import { Button } from './ui/button';
import { useNotes } from '../contexts/NotesContext';
import { useTextbook } from '../contexts/TextbookContext';

interface SelectionToolbarProps {
  position: { x: number; y: number };
  selectedText: string;
  onClose: () => void;
}

export function SelectionToolbar({ position, selectedText, onClose }: SelectionToolbarProps) {
  const { addHighlightedText } = useNotes();
  const { currentPage } = useTextbook();

  const handleAddToNotes = async () => {
    await addHighlightedText(selectedText, currentPage);
    onClose();
  };

  const handleExplain = () => {
    console.log('Explain:', selectedText);
    // This would trigger AI explanation in the right panel
    onClose();
  };

  const handleSummarize = () => {
    console.log('Summarize:', selectedText);
    // This would trigger AI summarization
    onClose();
  };

  const handleApplications = () => {
    console.log('Find applications for:', selectedText);
    // This would trigger AI to find applications
    onClose();
  };

  return (
    <div 
      className="fixed z-50 bg-gray-900 text-white rounded-md shadow-lg flex items-center space-x-1 px-2 py-1"
      style={{
        left: position.x - 100, // Center the toolbar
        top: position.y - 50,
        transform: 'translateX(-50%)'
      }}
    >
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-3 text-white hover:bg-green-700 text-sm bg-green-600"
        onClick={handleAddToNotes}
      >
        <StickyNote className="h-3 w-3 mr-1" />
        Add to Notes
      </Button>

      <div className="w-px h-4 bg-gray-600 mx-1" />
      
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-3 text-white hover:bg-gray-700 text-sm"
        onClick={handleExplain}
      >
        <Brain className="h-3 w-3 mr-1" />
        Explain
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-3 text-white hover:bg-gray-700 text-sm"
        onClick={handleSummarize}
      >
        <FileText className="h-3 w-3 mr-1" />
        Summarize
      </Button>
      
      <Button
        variant="ghost"
        size="sm" 
        className="h-8 px-3 text-white hover:bg-gray-700 text-sm"
        onClick={handleApplications}
      >
        <Lightbulb className="h-3 w-3 mr-1" />
        Applications
      </Button>

      <div className="w-px h-4 bg-gray-600 mx-1" />
      
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-white hover:bg-gray-700"
        onClick={onClose}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}