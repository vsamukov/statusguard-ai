
import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './store.tsx';
import PublicDashboard from './components/PublicDashboard.tsx';
// Fix: Import the root AdminDashboard component which accepts the onViewPublic prop
import AdminDashboard from './AdminDashboard.tsx';
import LoginPage from './components/LoginPage.tsx';

const TimezoneSelector: React.FC = () => {
  const { state, setTimezoneOffset } = useApp();

  const offsets = [];
  for (let i = -12; i <= 14; i++) {
    offsets.push({
      label: `UTC${i >= 0 ? '+' : ''}${i}`,
      value: i * 60
    });
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Timezone:</span>
      <select 
        className="bg-gray-50 border-gray-200 border rounded-md text-[11px] font-semibold py-1 px-2 outline-none focus:ring-2 focus:ring-indigo-500/20"
        value={state.timezoneOffset}
        onChange={(e) => setTimezoneOffset(parseInt(e.target.value, 10))}
      >
        {offsets.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { state, isLoading } = useApp();
  const [showLogin, setShowLogin] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(true);

  useEffect(() => {
    if (state.isAuthenticated) {
      setIsAdminMode(true);
    }
  }, [state.isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 font-medium animate-pulse">Syncing Infrastructure Map...</p>
      </div>
    );
  }

  const showAdminView = state.isAuthenticated && isAdminMode;

  return (
    <div className="min-h-screen">
      {state.isAuthenticated && !isAdminMode && (
        <div className="bg-indigo-900 text-white py-2 px-4 flex justify-center items-center gap-4 text-xs font-bold sticky top-0 z-[60] shadow-md border-b border-indigo-800">
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
            PREVIEW MODE: Viewing public status page
          </span>
          <button 
            onClick={() => setIsAdminMode(true)}
            className="bg-white text-indigo-900 px-3 py-1 rounded hover:bg-indigo-50 transition-colors"
          >
            Return to Manager
          </button>
        </div>
      )}

      <nav className={`bg-white border-b border-gray-200 h-16 flex items-center shadow-sm sticky ${state.isAuthenticated && !isAdminMode ? 'top-8' : 'top-0'} z-50`}>
        <div className="max-w-6xl mx-auto px-4 w-full flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
              </svg>
            </div>
            <span className="font-bold text-xl tracking-tight text-gray-900 hidden sm:inline">Voximplant <span className="text-indigo-600">Status</span></span>
          </div>
          
          <div className="flex gap-4 md:gap-8 items-center">
            <TimezoneSelector />
            {state.isAuthenticated ? (
               <div className="flex items-center gap-3">
                 <span className="hidden md:inline text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-tighter">
                   {isAdminMode ? 'Admin Portal' : 'Previewing'}
                 </span>
               </div>
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

      <main className="animate-in fade-in duration-500">
        {showAdminView ? (
          <AdminDashboard onViewPublic={() => setIsAdminMode(false)} />
        ) : (
          <PublicDashboard />
        )}
      </main>

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
