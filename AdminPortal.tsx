
import React from 'react';
import { useApp } from './store.tsx';
import AdminDashboard from './AdminDashboard.tsx';

const AdminPortal: React.FC = () => {
  const { state, switchDashboard, logout } = useApp();

  const activeDashboard = state.dashboards.find(d => d.id === state.activeDashboardId);

  const handleViewPublic = () => {
    if (activeDashboard?.url) {
      // Ensure the URL is absolute
      const url = activeDashboard.url.startsWith('http') 
        ? activeDashboard.url 
        : `http://${activeDashboard.url}`;
      window.open(url, '_blank');
    } else {
      alert("No public URL configured for this dashboard.");
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-20 lg:w-64 bg-indigo-900 text-white flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          </div>
          <span className="hidden lg:inline font-black tracking-tight text-xl">Admin Hub</span>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
          {state.dashboards.map(dash => (
            <button
              key={dash.id}
              onClick={() => switchDashboard(dash.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                state.activeDashboardId === dash.id 
                  ? 'bg-white text-indigo-900 shadow-lg' 
                  : 'text-indigo-200 hover:bg-white/10'
              }`}
            >
              <div 
                className="w-3 h-3 rounded-full shrink-0" 
                style={{ backgroundColor: dash.color || '#4f46e5' }}
              />
              <span className="hidden lg:inline font-bold text-sm truncate">{dash.name}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 p-3 text-red-300 hover:bg-red-500/10 rounded-xl"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            <span className="hidden lg:inline font-bold text-sm">Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-gray-200 h-16 flex items-center px-8 sticky top-0 z-10">
          <div className="flex justify-between w-full items-center">
             <div className="flex items-center gap-3">
               <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Active Site:</span>
               <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-sm font-bold border border-indigo-100">
                 {activeDashboard?.name || 'Select a site'}
               </span>
             </div>
             <div className="flex items-center gap-4">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Agent: {state.currentUser}</span>
             </div>
          </div>
        </header>

        <div className="p-8">
           {state.activeDashboardId ? (
             <AdminDashboard onViewPublic={handleViewPublic} />
           ) : (
             <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-4">
                   <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Dashboard Selection Required</h2>
                <p className="text-gray-500 mt-2">Pick an instance from the left sidebar to manage its status.</p>
             </div>
           )}
        </div>
      </main>
    </div>
  );
};

export default AdminPortal;
