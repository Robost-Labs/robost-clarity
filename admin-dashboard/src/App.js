import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Toaster } from './components/ui/toaster';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './components/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Requests from './pages/Requests';
import FlaggedPrompts from './pages/FlaggedPrompts';
import Sessions from './pages/Sessions';
import LiveFeed from './pages/LiveFeed';
import DetectionRules from './pages/DetectionRules';
import Anomalies from './pages/Anomalies';
import ReviewQueue from './pages/ReviewQueue';
import Alerts from './pages/Alerts';
import Analytics from './pages/Analytics';
import UserManagement from './pages/UserManagement';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import SignupPage from './pages/SignupPage';
import OrganizationSettings from './pages/OrganizationSettings';
import './App.css';

function App() {
  return (
    <ThemeProvider>
      <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID || "832846281418-imi8thvrec39v4rt05a8vk97eaaduch8.apps.googleusercontent.com"}>
        <AuthProvider>
          <Router>
            <div className="App">
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />

                {/* Protected routes with dashboard layout */}
                <Route path="/" element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }>
                  {/* Activity section */}
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="requests" element={<Requests />} />
                  <Route path="flagged" element={<FlaggedPrompts />} />
                  <Route path="sessions" element={<Sessions />} />
                  <Route path="live" element={<LiveFeed />} />

                  {/* Intelligence section */}
                  <Route path="rules" element={<DetectionRules />} />
                  <Route path="anomalies" element={<Anomalies />} />
                  <Route path="review" element={<ReviewQueue />} />
                  <Route path="alerts" element={<Alerts />} />
                  <Route path="analytics" element={<Analytics />} />

                  {/* Administration section */}
                  <Route path="users" element={<UserManagement />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="organization" element={<OrganizationSettings />} />

                  {/* Profile section (dropdown only) */}
                  <Route path="profile" element={<Profile />} />
                </Route>
              </Routes>
              <Toaster />
            </div>
          </Router>
        </AuthProvider>
      </GoogleOAuthProvider>
    </ThemeProvider>
  );
}

export default App;