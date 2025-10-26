
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import App from './App.tsx';
import WeekBundleView from './components/week/WeekBundleView.tsx';
import './index.css';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './contexts/AuthContext';
import { TextbookProvider } from './contexts/TextbookContext';
import { NotesProvider } from './contexts/NotesContext';
import { ChatProvider } from './contexts/ChatContext';
import { WeekBundleProvider } from './contexts/WeekBundleContext';
import { SprintProvider } from './contexts/SprintContext';
import { ErrorBoundary } from './components/ErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <TextbookProvider>
            <NotesProvider>
              <ChatProvider>
                <WeekBundleProvider>
                  <SprintProvider>
                    <Routes>
                      {/* Main textbook reader route */}
                      <Route path="/" element={<App />} />
                      
                      {/* Week bundle route - new feature */}
                      <Route path="/week/:bundleId" element={<WeekBundleView />} />
                    </Routes>
                    <Toaster position="top-right" />
                  </SprintProvider>
                </WeekBundleProvider>
              </ChatProvider>
            </NotesProvider>
          </TextbookProvider>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);
  