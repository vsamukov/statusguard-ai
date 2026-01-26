
import React, { useState } from 'react';
import { useApp } from '../store.tsx';
import ReportingTab from './admin/ReportingTab.tsx';
import ConfigurationTab from './admin/ConfigurationTab.tsx';
import TemplatesTab from './admin/TemplatesTab.tsx';
import AuditTab from './admin/AuditTab.tsx';

interface AdminDashboardProps {
  onViewPublic?: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onViewPublic }) => {
  const { state, logout } = useApp();
  const [activeTab, setActiveTab] = useState<'reporting' | 'config' | 'templates' | 'audit'>('reporting');

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Status Manager</h1>
          <p className="text-sm text-gray-400 font-medium">Workspace Operator: <span className="text-indigo-600">{state.currentUser}</span></p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <nav className="flex bg-gray-100 p-1 rounded-xl">
            {(['reporting', 'config', 'templates', 'audit'] as const).map(t => (
              <button 
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-5 py-2 text-xs font-bold rounded-lg capitalize transition-all ${activeTab === t ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {t === 'config' ? 'Infrastructure' : t}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2 border-l pl-4 border-gray-200">
            <button onClick={onViewPublic} className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-colors">Preview Public</button>
            <button onClick={logout} className="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors">Sign Out</button>
          </div>
        </div>
      </header>

      <main className="animate-in fade-in duration-700">
        {activeTab === 'reporting' && <ReportingTab />}
        {activeTab === 'config' && <ConfigurationTab />}
        {activeTab === 'templates' && <TemplatesTab />}
        {activeTab === 'audit' && <AuditTab />}
      </main>
    </div>
  );
};

export default AdminDashboard;
