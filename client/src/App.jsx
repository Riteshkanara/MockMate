import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AuthCallback from './pages/AuthCallback';
import Onboarding from './pages/Onboarding';
import Interview from './pages/Interview';
import Result from './pages/Result';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Leaderboard from './pages/Leaderboard';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import History from './pages/History';
import Analytics from './pages/Analytics';
import PublicProfile from './pages/publicProfile';




function App() {
  return (
    <BrowserRouter>
      <Navbar /> 
      <Routes>
        <Route path="/" element={<Home />} /> 

        <Route path="/p/:slug" element={<PublicProfile />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        <Route path="/onboarding" element={
          <ProtectedRoute>
            <Onboarding />
          </ProtectedRoute>
        } />

        <Route path="/interview" element={
          <ProtectedRoute>
            <Interview />
          </ProtectedRoute>
        } />
        <Route path="/history" element={
          <ProtectedRoute>
          <History />
          </ProtectedRoute>
        } />

        <Route path="/result" element={
          <ProtectedRoute>
            <Result />
          </ProtectedRoute>
        } />

        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />

          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <Analytics />
              </ProtectedRoute>
            }
          />

        <Route path="/leaderboard" element={
          <ProtectedRoute>
            <Leaderboard />
          </ProtectedRoute>
        } />
      
         
      </Routes>
    </BrowserRouter>
  );
}

export default App;