import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useScrollToTop, useScrollRestoration } from './hooks/useScrollToTop';
import { supabase } from './supabaseClient';

// Lazy load all page components
const HomePage = lazy(() => import('./pages/HomePage'));
const PatientViewPage = lazy(() => import('./pages/PatientViewPage'));
const DoctorViewPage = lazy(() => import('./pages/DoctorViewPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'));
const CookiePolicyPage = lazy(() => import('./pages/CookiePolicyPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const PatientConsultationsPage = lazy(() => import('./pages/PatientConsultationsPage'));
const ProfileSetupPage = lazy(() => import('./pages/ProfileSetupPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const AppointmentSettingsPage = lazy(() => import('./pages/AppointmentSettingsPage'));
const TestPage = lazy(() => import('./pages/TestPage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50">
    <div className="flex space-x-2">
      <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
      <div className="w-3 h-3 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
      <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
    </div>
  </div>
);

// Wrapper component to handle scroll behavior
const AppContent: React.FC = () => {
  // Enable scroll-to-top on route changes
  useScrollToTop();
  
  // Disable browser's automatic scroll restoration
  useScrollRestoration();

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/dashboard/patient" element={<PatientConsultationsPage />} />
        <Route path="/dashboard/doctor" element={<DoctorViewPage />} />
        <Route path="/dashboard/admin" element={<AdminDashboardPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/terms-of-service" element={<TermsOfServicePage />} />
        <Route path="/cookie-policy" element={<CookiePolicyPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/profile-setup" element={<ProfileSetupPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/appointment-settings" element={<AppointmentSettingsPage />} />
        <Route path="/pre-consult" element={<PatientViewPage />} />
        <Route path="/my-appointments" element={<PatientConsultationsPage />} />
        <Route path="/test" element={<TestPage />} />
      </Routes>
    </Suspense>
  );
};

function App() {
  useEffect(() => {
    const handleLogoutOnClose = async () => {
      await supabase.auth.signOut();
    };
    window.addEventListener('beforeunload', handleLogoutOnClose);
    return () => {
      window.removeEventListener('beforeunload', handleLogoutOnClose);
    };
  }, []);
  return (
    <Router>
      <div className="min-h-screen bg-white">
        <AppContent />
      </div>
    </Router>
  );
}

export default App;