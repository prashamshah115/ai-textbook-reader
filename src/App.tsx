import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LandingPage } from './components/LandingPage';
import { useAuth } from './contexts/AuthContext';

function AppContent() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect to paper library after login
  useEffect(() => {
    if (user) {
      navigate('/papers');
    }
  }, [user, navigate]);

  // Show landing page only if user is NOT authenticated
  if (!user) {
    return <LandingPage onEnterApp={() => {}} />;
  }

  // Redirecting to paper library...
  return null;
}

export default function App() {
  return <AppContent />;
}
