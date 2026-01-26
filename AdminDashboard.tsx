
import React, { useState } from 'react';
import { useApp } from './store.tsx';
import ReportingTab from './components/admin/ReportingTab.tsx';
import ConfigurationTab from './components/admin/ConfigurationTab.tsx';
import TemplatesTab from './components/admin/TemplatesTab.tsx';
import AuditTab from './components/admin/AuditTab.tsx';

interface AdminDashboardProps {
  onViewPublic?: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onViewPublic }) => {
  const { state, logout } = useApp();
  const [activeTab, setActiveTab] = useState<'reporting' | 'config' | 'templates' | 'audit'>('reporting');

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Refined Header Orchestrator */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Status Manager</h1>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
            <p className="text-sm text-gray-400 font-medium">
              Authenticated: <span className="text-indigo-600 font-bold">{state.currentUser}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <nav className="flex bg-gray-100 p-1.5 rounded-2xl shadow-inner flex-1 md:flex-none">
            {(['reporting', 'config', 'templates', 'audit'] as const).map(t => (
              <button 
                key={t}
                onClick={() => setActiveTab(t)}
                className={`flex-1 md:flex-none px-5 py-2.5 text-xs font-bold rounded-xl capitalize transition-all duration-200 ${
                  activeTab === t 
                    ? 'bg-white shadow-sm text-indigo-600 ring-1 ring-black/5' 
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {t === 'config' ? 'Infrastructure' : t}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 border-l pl-5 border-gray-200 ml-1">
            <button 
              onClick={onViewPublic} 
              className="group flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-indigo-600 transition-colors"
            >
              <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Preview
            </button>
            <button 
              onClick={logout} 
              className="px-4 py-2.5 bg-red-50 text-red-600 text-xs font-bold rounded-xl hover:bg-red-100 hover:text-red-700 transition-all border border-red-100 shadow-sm"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area with View Orchestration */}
      <main className="animate-in fade-in duration-700 slide-in-from-bottom-2">
        {activeTab === 'reporting' && <ReportingTab />}
        {activeTab === 'config' && <ConfigurationTab />}
        {activeTab === 'templates' && <TemplatesTab />}
        {activeTab === 'audit' && <AuditTab />}
      </main>

      <footer className="mt-16 pt-8 border-t border-gray-100 text-center">
        <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">
          Voximplant Management Console v1.1.0 • Enterprise Edition
        </p>
      </footer>
    </div>
  );
};

export default AdminDashboard;
