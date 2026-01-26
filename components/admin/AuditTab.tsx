
import React from 'react';
import { useApp } from '../../store.tsx';

const AuditTab: React.FC = () => {
  const { state, fetchAdminData } = useApp();

  return (
    <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
      <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
        <h2 className="font-bold text-gray-800">Security Audit Logs</h2>
        <button onClick={fetchAdminData} className="text-xs font-bold text-indigo-600 uppercase">Refresh</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 border-b font-bold text-gray-400 uppercase">
            <tr>
              <th className="px-6 py-4">Time</th>
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">Action</th>
              <th className="px-6 py-4">Summary</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {state.auditLogs.map(log => (
              <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4 font-mono text-gray-400 whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString(undefined, {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
                  })}
                </td>
                <td className="px-6 py-4">
                  <span className="font-bold text-gray-800">{log.username}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                    log.actionType.startsWith('DELETE') ? 'bg-red-50 text-red-600' :
                    log.actionType.startsWith('CREATE') ? 'bg-indigo-50 text-indigo-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {log.actionType.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-600 truncate max-w-xs">
                  {log.targetName}
                </td>
              </tr>
            ))}
            {state.auditLogs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic">No activity recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditTab;
