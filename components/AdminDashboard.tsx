
import React, { useState } from 'react';
import { useApp } from '../store.tsx';
import ReportingTab from './admin/ReportingTab.tsx';

const AdminDashboard: React.FC = () => {
  const { state, logout } = useApp();
  const [activeTab, setActiveTab] = useState<'reporting' | 'config' | 'templates' | 'audit'>('reporting');

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <header className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Status Manager</h1>
          <p className="text-sm text-gray-400">Authenticated as {state.currentUser}</p>
        </div>
        <div className="flex items-center gap-6">
          <nav className="flex bg-gray-100 p-1 rounded-lg">
            {['reporting', 'config', 'templates', 'audit'].map(t => (
              <button 
                key={t}
                onClick={() => setActiveTab(t as any)}
                className={`px-4 py-1.5 text-xs font-bold rounded-md capitalize transition-all ${activeTab === t ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
              >
                {t}
              </button>
            ))}
          </nav>
          <button onClick={logout} className="text-sm font-bold text-red-500">Sign Out</button>
        </div>
      </header>

      <main className="animate-in fade-in duration-500">
        {activeTab === 'reporting' && <ReportingTab />}
        {activeTab === 'config' && <div className="p-20 text-center text-gray-400">Configuration component refactor pending...</div>}
        {activeTab === 'templates' && <div className="p-20 text-center text-gray-400">Templates component refactor pending...</div>}
        {activeTab === 'audit' && (
          <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b font-bold text-gray-400 uppercase">
                <tr>
                  <th className="px-6 py-4">Time</th>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">Target</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {state.auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-mono text-gray-400">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="px-6 py-4 font-bold">{log.username}</td>
                    <td className="px-6 py-4 uppercase tracking-tighter font-black">{log.actionType}</td>
                    <td className="px-6 py-4">{log.targetName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
