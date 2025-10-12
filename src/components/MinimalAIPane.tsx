import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { RecallPanel } from './ai-panels/RecallPanel';
import { ChatPanel } from './ai-panels/ChatPanel';

export function MinimalAIPane() {
  return (
    <div className="h-full flex flex-col border-l border-border bg-card">
      <Tabs defaultValue="recall" className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent h-10 p-0 gap-0">
          <TabsTrigger
            value="recall"
            className="flex-1 rounded-none border-r border-border data-[state=active]:bg-muted/50 data-[state=active]:shadow-none h-full text-xs font-medium"
          >
            Practice
          </TabsTrigger>
          <TabsTrigger
            value="chat"
            className="flex-1 rounded-none data-[state=active]:bg-muted/50 data-[state=active]:shadow-none h-full text-xs font-medium"
          >
            Chat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recall" className="flex-1 overflow-auto py-3 mt-0">
          <RecallPanel />
        </TabsContent>

        <TabsContent value="chat" className="flex-1 overflow-hidden mt-0">
          <ChatPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
