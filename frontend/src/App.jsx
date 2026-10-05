// src/App.jsx — Main application with routing
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import CreateEvent from './pages/CreateEvent';
import EventRequestForm from './pages/EventRequestForm';
import Admin from './pages/Admin';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import ChangePassword from './pages/ChangePassword';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});

// Protected route wrapper — redirects to login if not authenticated
function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, loading, user } = useAuth();
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="skeleton" style={{ width: 200, height: 40 }} /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user?.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <Navbar />
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Home />} />
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/events" element={<Events />} />
        <Route path="/events/:id" element={<EventDetail />} />

        {/* Protected Routes */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/change-password" element={<ProtectedRoute roles={['admin']}><ChangePassword /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />

        {/* Admin & Faculty Only */}
        <Route path="/events/create" element={<ProtectedRoute roles={['admin', 'faculty']}><CreateEvent /></ProtectedRoute>} />

        {/* Student Only */}
        <Route path="/event-requests/new" element={<ProtectedRoute roles={['student']}><EventRequestForm /></ProtectedRoute>} />

        {/* Admin Only */}
        <Route path="/admin/*" element={<ProtectedRoute roles={['admin']}><Admin /></ProtectedRoute>} />

        {/* 404 */}
        <Route path="*" element={
          <div style={{ textAlign: 'center', padding: 80 }}>
            <h1 style={{ fontSize: 48, fontWeight: 800, color: '#e0e0e0' }}>404</h1>
            <p style={{ color: '#5a6270' }}>Page not found</p>
          </div>
        } />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster position="top-right" toastOptions={{
            style: { borderRadius: 10, background: '#1a1a2e', color: '#fff', fontSize: 14 },
            success: { iconTheme: { primary: '#2e7d32', secondary: '#fff' } },
            error: { iconTheme: { primary: '#c62828', secondary: '#fff' } },
          }} />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
