
import React from 'react';
import { AppProvider, useApp } from './store.tsx';
import AdminPortal from './AdminPortal.tsx';
import PublicDashboard from './components/PublicDashboard.tsx';
import LoginPage from './components/LoginPage.tsx';

// The server injects this flag during transpilation
const IS_HUB_MODE = (process.env as any).IS_HUB === true;

const AppContent: React.FC = () => {
  const { state, isLoading } = useApp();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 font-medium animate-pulse">
          {IS_HUB_MODE ? 'Connecting to Portal Hub...' : 'Loading Service Status...'}
        </p>
      </div>
    );
  }

  // HUB MODE: Requires login to access the multi-tenant manager
  if (IS_HUB_MODE) {
    if (!state.isAuthenticated) {
      return <LoginPage onCancel={() => {}} />;
    }
    return <AdminPortal />;
  }

  // NODE MODE: Direct public status page
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-100 py-6">
        <div className="max-w-4xl mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
             </div>
             <span className="font-black text-xl tracking-tight text-gray-900">Infrastructure Status</span>
          </div>
        </div>
      </header>
      <PublicDashboard />
      <footer className="max-w-4xl mx-auto px-4 text-center mt-12 opacity-30 text-[10px] font-bold uppercase tracking-widest">
        Powered by Voximplant SRE Orchestrator
      </footer>
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
