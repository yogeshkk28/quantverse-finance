import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import HomePage from './pages/HomePage';
import ScreenerPage from './pages/ScreenerPage';
import PortfolioPage from './pages/PortfolioPage';
import AIAssistantPage from './pages/AIAssistantPage';
import AuthPage from './pages/AuthPage';

function AppWithAuth() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-accent-orange border-t-transparent rounded-full animate-spin" />
          <p className="text-white/30 text-sm font-medium">Loading QuantVerse...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/screener" element={<ScreenerPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/ai" element={<AIAssistantPage />} />
        </Route>
        <Route path="/auth" element={<AuthPage />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppWithAuth />
    </AuthProvider>
  );
}

export default App;
