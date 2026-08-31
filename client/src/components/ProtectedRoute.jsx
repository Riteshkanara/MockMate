import useAuth from '../hooks/useAuth';
import { Navigate, useLocation } from 'react-router-dom';

// Fields that must be present for onboarding to be considered complete.
// Matches what saveOnboarding writes — if any are missing the user
// hasn't finished onboarding and should be sent back.
const isOnboarded = (user) =>
  Boolean(user?.college && user?.branch && user?.semester);

const ProtectedRoute = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    // Minimal spinner — replace with your <PageLoader /> if you prefer
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F0F4FF',
        fontFamily: "'Inter', sans-serif",
        color: '#7A8BAF',
        fontSize: 14,
      }}>
        Loading…
      </div>
    );
  }

  // Not logged in → home
  if (!user) return <Navigate to="/" replace />;

  // Logged in but hasn't completed onboarding → onboarding
  // (except when they're already on /onboarding to avoid a redirect loop)
  if (!isOnboarded(user) && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
};

export default ProtectedRoute;