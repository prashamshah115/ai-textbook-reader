import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { RecallPanel } from '../ai-panels/RecallPanel';
import { ChatPanel } from '../ai-panels/ChatPanel';
import { NotesPanel } from '../NotesPanel';
import { StickyNote, MessageSquare, Sparkles } from 'lucide-react';

/**
 * Simplified AI Pane for Week Bundle View
 * 3 tabs: Notes, Chat, Recall (AI Summary)
 */
export function WeekAIPane() {
  return (
    <div className="h-full flex flex-col bg-white">
      <Tabs defaultValue="notes" className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b border-gray-200 bg-transparent h-12 p-0 gap-0">
          <TabsTrigger
            value="notes"
            className="flex-1 rounded-none border-r border-gray-200 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-none h-full text-sm font-medium flex items-center gap-2"
          >
            <StickyNote className="w-4 h-4" />
            Notes
          </TabsTrigger>
          <TabsTrigger
            value="chat"
            className="flex-1 rounded-none border-r border-gray-200 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-none h-full text-sm font-medium flex items-center gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            Chat
          </TabsTrigger>
          <TabsTrigger
            value="recall"
            className="flex-1 rounded-none data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-none h-full text-sm font-medium flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Recall
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="flex-1 overflow-auto mt-0">
          <NotesPanel />
        </TabsContent>

        <TabsContent value="chat" className="flex-1 overflow-hidden mt-0">
          <ChatPanel />
        </TabsContent>

        <TabsContent value="recall" className="flex-1 overflow-auto py-3 mt-0">
          <RecallPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

