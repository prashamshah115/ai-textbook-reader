import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSprint } from '../contexts/SprintContext';
import { 
  ArrowLeft, BookOpen, FileText, ExternalLink, CheckCircle2, 
  Circle, Play, Globe, Video, FileCode, GraduationCap 
} from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';

export function SprintDetail() {
  const { currentSprint, contentItems, setViewMode, setActiveDayIndex } = useSprint();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  if (!currentSprint) return null;

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'textbook': return <BookOpen className="w-4 h-4" />;
      case 'slides': return <FileText className="w-4 h-4" />;
      case 'homework': return <FileCode className="w-4 h-4" />;
      case 'paper': return <GraduationCap className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  // Use real content items from database
  const sources = contentItems.map(item => ({
    id: item.id,
    title: item.title,
    type: item.content_type,
    url: item.source_url || '#',
    summary: `${item.content_type.charAt(0).toUpperCase() + item.content_type.slice(1)} material for this week`,
    relevance: `Relevance: ${Math.round((item.confidence_score || 0.8) * 100)}%`
  }));

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setViewMode('dashboard')}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div className="flex items-center gap-3">
              <span className="text-gray-900">{currentSprint.course_code}</span>
              <span className="text-gray-400">/</span>
              <span className="text-gray-600">Week {currentSprint.week_number}</span>
            </div>
          </div>
          <Button 
            onClick={() => navigate(`/week/${currentSprint.id}`)}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            <BookOpen className="w-4 h-4 mr-2" />
            Open Reader
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-gray-100">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="notes">Auto Notes</TabsTrigger>
            <TabsTrigger value="sources">Sources</TabsTrigger>
            <TabsTrigger value="progress">Progress</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-gray-900 mb-3">{currentSprint.week_topic}</h2>
              
              {/* Daily Sessions */}
              <div className="mt-6">
                <h3 className="text-gray-900 mb-4">Daily Sessions</h3>
                <div className="space-y-4">
                  {currentSprint.dailySessions.map((session, idx) => (
                    <Card 
                      key={idx} 
                      className={`p-5 border-l-4 ${
                        session.completed 
                          ? 'border-l-green-500 bg-green-50/30' 
                          : 'border-l-blue-500'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm text-gray-600">{session.day}</span>
                            {session.completed && (
                              <Badge className="bg-green-600 text-white text-xs">Completed</Badge>
                            )}
                          </div>
                          <h4 className="text-gray-900">{session.topic}</h4>
                          {session.pages.length > 0 && (
                            <span className="text-sm text-gray-500">
                              Pages {session.pages[0]}-{session.pages[1]}
                            </span>
                          )}
                        </div>
                        <Button 
                          size="sm"
                          onClick={() => {
                            setActiveDayIndex(idx);
                            setViewMode('reader');
                          }}
                          variant={session.completed ? 'outline' : 'default'}
                          className={!session.completed ? 'bg-blue-500 hover:bg-blue-600 text-white' : ''}
                        >
                          {session.completed ? 'Review' : 'Start'}
                          <Play className="w-3 h-3 ml-2" />
                        </Button>
                      </div>

                      <div className="space-y-2">
                        {session.activities.map((activity, actIdx) => (
                          <div key={actIdx} className="flex items-center gap-2 text-sm">
                            {session.completed ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                              <Circle className="w-4 h-4 text-gray-400" />
                            )}
                            <span className="text-gray-700">{activity}</span>
                          </div>
                        ))}
                      </div>

                      {session.questionsAnswered && (
                        <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-4 text-sm">
                          <span className="text-gray-600">
                            Questions: {session.questionsCorrect}/{session.questionsAnswered} correct
                          </span>
                          <span className={`${
                            (session.questionsCorrect! / session.questionsAnswered) >= 0.8 
                              ? 'text-green-600' 
                              : 'text-orange-600'
                          }`}>
                            {Math.round((session.questionsCorrect! / session.questionsAnswered) * 100)}%
                          </span>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Auto Notes Tab */}
          <TabsContent value="notes">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-gray-900">AI-Generated Study Notes</h3>
                <Badge variant="outline" className="text-xs">Auto-synced</Badge>
              </div>
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-gray-700 space-y-4">
                  {currentSprint.autoNotes}
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Sources Tab */}
          <TabsContent value="sources" className="space-y-4">
            {sources.map((source) => (
              <Card key={source.id} className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded">
                      {getSourceIcon(source.type)}
                    </div>
                    <div>
                      <h4 className="text-gray-900">{source.title}</h4>
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {source.type}
                      </Badge>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => window.open(source.url, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-sm text-gray-700 mb-2">{source.summary}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">
                    {source.relevance}
                  </span>
                </div>
              </Card>
            ))}
          </TabsContent>

          {/* Progress Tab */}
          <TabsContent value="progress">
            <Card className="p-6">
              <h3 className="text-gray-900 mb-6">Week {currentSprint.week_number} Progress Summary</h3>
              
              <div className="grid grid-cols-3 gap-6 mb-8">
                <div className="text-center p-4 bg-gray-50 rounded">
                  <div className="text-3xl text-gray-900 mb-1">
                    {currentSprint.dailySessions.filter(s => s.completed).length}/{currentSprint.dailySessions.length}
                  </div>
                  <div className="text-sm text-gray-600">Days Completed</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded">
                  <div className="text-3xl text-blue-600 mb-1">{currentSprint.progress}%</div>
                  <div className="text-sm text-gray-600">Overall Progress</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded">
                  <div className="text-3xl text-green-600 mb-1">
                    {currentSprint.dailySessions.reduce((sum, s) => sum + (s.questionsCorrect || 0), 0)}/
                    {currentSprint.dailySessions.reduce((sum, s) => sum + (s.questionsAnswered || 0), 0)}
                  </div>
                  <div className="text-sm text-gray-600">Questions Correct</div>
                </div>
              </div>

              <div>
                <h4 className="text-gray-900 mb-4">What's Next</h4>
                <div className="space-y-3">
                  {currentSprint.dailySessions
                    .filter(s => !s.completed)
                    .slice(0, 3)
                    .map((session, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div className="flex items-center gap-3">
                          <Circle className="w-4 h-4 text-gray-400" />
                          <div>
                            <div className="text-sm text-gray-900">{session.day}: {session.topic}</div>
                            {session.pages.length > 0 && (
                              <div className="text-xs text-gray-500">
                                Pages {session.pages[0]}-{session.pages[1]}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          onClick={() => {
                            setActiveDayIndex(currentSprint.dailySessions.indexOf(session));
                            setViewMode('reader');
                          }}
                          className="bg-blue-500 hover:bg-blue-600 text-white"
                        >
                          Start
                        </Button>
                      </div>
                    ))}
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
