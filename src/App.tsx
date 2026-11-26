import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppShell } from './components/layout/AppShell';
import { RegisterPage } from './pages/auth/RegisterPage';
import { LoginPage } from './pages/auth/LoginPage';
import { OnboardingPage } from './pages/onboarding/OnboardingPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { AdventureMapPage } from './pages/game/AdventureMapPage';
import { LevelPlayPage } from './pages/game/LevelPlayPage';
import { TranslatePage } from './pages/translate/TranslatePage';
import { DailyPhrasePage } from './pages/daily-phrase/DailyPhrasePage';
import { ChatbotPage } from './pages/chatbot/ChatbotPage';
import { ProvincesExplorerPage } from './pages/provinces/ProvincesExplorerPage';
import { ProfilePage } from './pages/profile/ProfilePage';

function FullScreenLoader() {
  return (
    <div className="min-h-screen bg-surface-parchment flex flex-col items-center justify-center gap-4 p-6">
      <img
        src="/assets/icons/logatara-logo.svg"
        alt="LOGATARA"
        width={180}
        height={45}
        className="h-11 w-auto"
      />
      <p className="font-display font-bold text-primary animate-pulse">
        Menyiapkan Kampung Nusantara...
      </p>
    </div>
  );
}

function ProtectedRoute({
  children,
  requireOnboarding = true,
}: {
  children: React.ReactNode;
  requireOnboarding?: boolean;
}) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (requireOnboarding && !user.onboarding_completed) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}

function PublicAuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (user) {
    return <Navigate to={user.onboarding_completed ? '/dashboard' : '/onboarding'} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/register"
            element={
              <PublicAuthRoute>
                <RegisterPage />
              </PublicAuthRoute>
            }
          />
          <Route
            path="/login"
            element={
              <PublicAuthRoute>
                <LoginPage />
              </PublicAuthRoute>
            }
          />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute requireOnboarding={false}>
                <OnboardingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppShell>
                  <DashboardPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/map"
            element={
              <ProtectedRoute>
                <AppShell>
                  <AdventureMapPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/level/:levelId"
            element={
              <ProtectedRoute>
                <AppShell>
                  <LevelPlayPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/translate"
            element={
              <ProtectedRoute>
                <AppShell>
                  <TranslatePage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/daily-phrase"
            element={
              <ProtectedRoute>
                <AppShell>
                  <DailyPhrasePage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/chatbot"
            element={
              <ProtectedRoute>
                <AppShell>
                  <ChatbotPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/provinces"
            element={
              <ProtectedRoute>
                <AppShell>
                  <ProvincesExplorerPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <AppShell>
                  <ProfilePage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/register" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
