
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import App from './App.tsx';
import PaperLibrary from './components/papers/PaperLibrary.tsx';
import PaperViewer from './components/papers/PaperViewer.tsx';
import { LegacyPDFReader } from './components/LegacyPDFReader.tsx';
import './index.css';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './contexts/AuthContext';
import { TextbookProvider } from './contexts/TextbookContext';
import { NotesProvider } from './contexts/NotesContext';
import { ChatProvider } from './contexts/ChatContext';
import { PaperProvider } from './contexts/PaperContext';
import { ErrorBoundary } from './components/ErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <TextbookProvider>
            <NotesProvider>
              <ChatProvider>
                <PaperProvider>
                  <Routes>
                    {/* Landing page / auth */}
                    <Route path="/" element={<App />} />
                    
                    {/* OpenPaper - Research papers routes */}
                    <Route path="/papers" element={<PaperLibrary />} />
                    <Route path="/papers/:paperId" element={<PaperViewer />} />
                    
                    {/* Legacy 3-column PDF reader (still accessible) */}
                    <Route path="/reader" element={<LegacyPDFReader />} />
                  </Routes>
                  <Toaster position="top-right" />
                </PaperProvider>
              </ChatProvider>
            </NotesProvider>
          </TextbookProvider>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);
  