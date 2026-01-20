
import React, { useState } from 'react';
import { AppProvider, useApp } from './store.tsx';
import PublicDashboard from './components/PublicDashboard.tsx';
import AdminDashboard from './components/AdminDashboard.tsx';
import LoginPage from './components/LoginPage.tsx';

const AppContent: React.FC = () => {
  const { state, isLoading } = useApp();
  const [showLogin, setShowLogin] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 font-medium animate-pulse">Syncing Infrastructure Map...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Simple Navigation Bar */}
      <nav className="bg-white border-b border-gray-200 h-16 flex items-center shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 w-full flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
              </svg>
            </div>
            <span className="font-bold text-xl tracking-tight text-gray-900">StatusGuard <span className="text-indigo-600">Pro</span></span>
          </div>
          
          <div className="flex gap-6 items-center">
            {state.isAuthenticated ? (
               <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-tighter">Admin Mode</span>
            ) : (
              <button 
                onClick={() => setShowLogin(true)}
                className="text-sm font-semibold text-gray-500 hover:text-indigo-600 transition-colors"
              >
                Admin Login
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* View Logic */}
      <main className="animate-in fade-in duration-500">
        {state.isAuthenticated ? <AdminDashboard /> : <PublicDashboard />}
      </main>

      {/* Login Overlay */}
      {showLogin && !state.isAuthenticated && (
        <LoginPage onCancel={() => setShowLogin(false)} />
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
