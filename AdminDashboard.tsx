
import React, { useState } from 'react';
import { useApp } from './store.tsx';
import ReportingTab from './components/admin/ReportingTab.tsx';
import ConfigurationTab from './components/admin/ConfigurationTab.tsx';
import TemplatesTab from './components/admin/TemplatesTab.tsx';
import AuditTab from './components/admin/AuditTab.tsx';
import SubscriptionsTab from './components/admin/SubscriptionsTab.tsx';

interface AdminDashboardProps {
  onViewPublic?: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onViewPublic }) => {
  const { state, logout } = useApp();
  const [activeTab, setActiveTab] = useState<'reporting' | 'config' | 'templates' | 'audit' | 'subscriptions'>('reporting');

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Status Manager</h1>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
            <p className="text-sm text-gray-400 font-medium">
              User: <span className="text-indigo-600 font-bold">{state.currentUser}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <nav className="flex bg-gray-200 p-1 rounded-xl flex-1 md:flex-none">
            {(['reporting', 'config', 'templates', 'subscriptions', 'audit'] as const).map(t => (
              <button 
                key={t}
                onClick={() => setActiveTab(t)}
                className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-lg capitalize transition-colors ${
                  activeTab === t 
                    ? 'bg-white shadow-sm text-indigo-600' 
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {t === 'config' ? 'Infrastructure' : t}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 border-l pl-5 border-gray-200">
            <button 
              onClick={onViewPublic} 
              className="text-xs font-bold text-gray-600 hover:text-indigo-600 transition-colors"
            >
              Public Preview
            </button>
            <button 
              onClick={logout} 
              className="px-4 py-2 bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100 transition-all border border-red-100"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main>
        {activeTab === 'reporting' && <ReportingTab />}
        {activeTab === 'config' && <ConfigurationTab />}
        {activeTab === 'templates' && <TemplatesTab />}
        {activeTab === 'audit' && <AuditTab />}
        {activeTab === 'subscriptions' && <SubscriptionsTab />}
      </main>

      <footer className="mt-16 pt-8 border-t border-gray-100 text-center">
        <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">
          Voximplant Management Console v1.1.0
        </p>
      </footer>
    </div>
  );
};

export default AdminDashboard;
