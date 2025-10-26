import { useSprint } from '../contexts/SprintContext';
import { Calendar, Target, BookOpen, TrendingUp, ArrowRight, CheckCircle2, Circle } from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Card } from './ui/card';

export function SprintDashboard() {
  const { currentSprint, setViewMode, loading, error } = useSprint();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading sprint...</p>
        </div>
      </div>
    );
  }

  if (error || !currentSprint) {
    return (
      <div className="flex items-center justify-center h-screen bg-white p-4">
        <Card className="max-w-md p-6">
          <p className="text-red-600">{error || 'No sprint loaded'}</p>
        </Card>
      </div>
    );
  }

  const today = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDay = dayNames[today.getDay()];
  const todaySession = currentSprint.dailySessions.find(s => s.day === currentDay);
  
  const completedDays = currentSprint.dailySessions.filter(s => s.completed).length;
  const totalDays = currentSprint.dailySessions.length;
  
  const avgMastery = currentSprint.knowledgeGraph.length > 0
    ? Math.round(
        currentSprint.knowledgeGraph.reduce((sum, node) => sum + node.mastery, 0) / 
        currentSprint.knowledgeGraph.length
      )
    : 0;

  return (
    <div className="min-h-screen bg-white">
      {/* Minimal Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-blue-500" />
            <span className="text-gray-900">{currentSprint.course_code}</span>
            <span className="text-gray-400">/</span>
            <span className="text-gray-600">Week {currentSprint.week_number}</span>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">{avgMastery}% mastery</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">{currentDay}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Sprint Overview */}
        <div className="mb-12">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-gray-900 mb-2">{currentSprint.course_name || currentSprint.course_code}</h1>
              <p className="text-gray-600 max-w-3xl">{currentSprint.week_topic}</p>
            </div>
            <Button 
              onClick={() => setViewMode('detail')}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              View Details
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{completedDays} of {totalDays} days completed</span>
              <span className="text-gray-900">{currentSprint.progress}%</span>
            </div>
            <Progress value={currentSprint.progress} className="h-1.5" />
          </div>
        </div>

        {/* Today's Session */}
        {todaySession && (
          <Card className="p-6 mb-8 border-blue-500 border-2 bg-blue-50/30">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-sm text-gray-600">Today's Session</span>
                </div>
                <h2 className="text-gray-900">{todaySession.topic}</h2>
              </div>
              {todaySession.completed && (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              )}
            </div>

            <div className="space-y-3 mb-6">
              {todaySession.activities.map((activity, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm">
                  <Circle className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">{activity}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <Button 
                onClick={() => setViewMode('reader')}
                className="bg-blue-500 hover:bg-blue-600 text-white"
              >
                {todaySession.completed ? 'Review' : 'Start Session'}
              </Button>
              <span className="text-sm text-gray-600">
                Pages {todaySession.pages[0]}-{todaySession.pages[1]}
              </span>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-3 gap-6">
          {/* Weekly Schedule */}
          <Card className="p-6 col-span-2">
            <h3 className="text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              Weekly Schedule
            </h3>
            <div className="space-y-2">
              {currentSprint.dailySessions.map((session, idx) => (
                <div 
                  key={idx}
                  className={`flex items-center justify-between p-3 rounded border transition-colors ${
                    session.day === currentDay 
                      ? 'border-blue-500 bg-blue-50/30' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    {session.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm text-gray-600">{session.day}</span>
                        {session.day === currentDay && (
                          <span className="text-xs text-blue-600 font-medium">TODAY</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-900">{session.topic}</div>
                    </div>
                  </div>
                  {session.pages.length > 0 && (
                    <span className="text-xs text-gray-500">
                      pp. {session.pages[0]}-{session.pages[1]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Knowledge Map */}
          <Card className="p-6">
            <h3 className="text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gray-400" />
              Knowledge Map
            </h3>
            <div className="space-y-3">
              {currentSprint.knowledgeGraph.map((node, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between mb-1 text-sm">
                    <span className="text-gray-700">{node.concept}</span>
                    <span className={`${
                      node.mastery >= 80 ? 'text-green-600' :
                      node.mastery >= 60 ? 'text-blue-600' :
                      'text-orange-600'
                    }`}>
                      {node.mastery}%
                    </span>
                  </div>
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${
                        node.mastery >= 80 ? 'bg-green-500' :
                        node.mastery >= 60 ? 'bg-blue-500' :
                        'bg-orange-500'
                      }`}
                      style={{ width: `${node.mastery}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

