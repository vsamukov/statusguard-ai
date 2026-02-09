
import React, { useState } from 'react';
import { AppProvider, useApp } from './store.tsx';
import AdminPortal from './AdminPortal.tsx';
import LoginPage from './components/LoginPage.tsx';

const AppContent: React.FC = () => {
  const { state, isLoading } = useApp();
  const [showLogin, setShowLogin] = useState(true);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 font-medium animate-pulse">Initializing Portal Hub...</p>
      </div>
    );
  }

  if (!state.isAuthenticated) {
    return <LoginPage onCancel={() => {}} />;
  }

  return <AdminPortal />;
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
