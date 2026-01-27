
import React from 'react';
import { useApp } from '../../store.tsx';

const AuditTab: React.FC = () => {
  const { state, fetchAdminData } = useApp();

  const getBadgeStyles = (actionType: string) => {
    // Red for incident reporting and deletions
    if (actionType === 'CREATE_INCIDENT' || actionType.startsWith('DELETE')) {
      return 'bg-red-50 text-red-600 border-red-100';
    }
    // Green for resolutions
    if (actionType === 'RESOLVE_INCIDENT') {
      return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    }
    // Blue/Indigo for infrastructure creation
    if (actionType.startsWith('CREATE')) {
      return 'bg-indigo-50 text-indigo-600 border-indigo-100';
    }
    // Subtle indigo for updates
    if (actionType.startsWith('UPDATE')) {
      return 'bg-blue-50 text-blue-600 border-blue-100';
    }
    return 'bg-gray-100 text-gray-600 border-gray-200';
  };

  return (
    <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
      <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
        <div>
          <h2 className="font-bold text-gray-800">Security Audit Logs</h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Traceability and Compliance History</p>
        </div>
        <button onClick={fetchAdminData} className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors border border-indigo-100">
          Sync Logs
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 border-b font-bold text-gray-400 uppercase">
            <tr>
              <th className="px-6 py-4">Timestamp</th>
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">Operation</th>
              <th className="px-6 py-4">Resource Target</th>
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
                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter border ${getBadgeStyles(log.actionType)}`}>
                    {log.actionType.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-700 truncate max-w-xs">{log.targetName}</span>
                    <span className="text-[9px] text-gray-400 font-bold uppercase">{log.targetType}</span>
                  </div>
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
