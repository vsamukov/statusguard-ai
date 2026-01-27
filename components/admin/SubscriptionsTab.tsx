
import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../store.tsx';
import { NotificationSettings, Subscription } from '../../types.ts';
import { api } from '../../services/api.ts';

const SubscriptionsTab: React.FC = () => {
  const { state, addSubscriber, removeSubscriber, updateSubscriber, saveNotificationSettings } = useApp();
  
  // Local states for paginated subscriber view
  const [subscribers, setSubscribers] = useState<Subscription[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isListLoading, setIsListLoading] = useState(false);
  
  // Form states
  const [newEmail, setNewEmail] = useState('');
  const [editingSub, setEditingSub] = useState<{ id: string, email: string } | null>(null);
  const [settingsForm, setSettingsForm] = useState<NotificationSettings>(state.notificationSettings);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchList = useCallback(async () => {
    setIsListLoading(true);
    try {
      // Fetch 10 subscribers per page as requested
      const data = await api.getSubscribers(page, 10, search);
      setSubscribers(data.items);
      setTotal(data.total);
    } catch (err) {
      console.error("Failed to load subscribers list", err);
    } finally {
      setIsListLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleAddSubscriber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    setIsProcessing(true);
    try {
      await addSubscriber(newEmail);
      setNewEmail('');
      setPage(1); // Reset to first page
      fetchList();
    } catch (err) {
      alert("Failed to add subscriber");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateSubscriber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSub) return;
    setIsProcessing(true);
    try {
      await updateSubscriber(editingSub.id, editingSub.email);
      setEditingSub(null);
      fetchList();
    } catch (err) {
      alert("Failed to update subscriber");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveSubscriber = async (id: string, email: string) => {
    if (!confirm(`Permanently remove ${email} from subscribers?`)) return;
    setIsProcessing(true);
    try {
      await removeSubscriber(id);
      fetchList();
    } catch (err) {
      alert("Failed to remove subscriber");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      await saveNotificationSettings(settingsForm);
      alert("Notification settings saved successfully.");
    } catch (err) {
      alert("Failed to save notification settings.");
    } finally {
      setIsProcessing(false);
    }
  };

  const totalPages = Math.ceil(total / 10);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Subscribers List and Management */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden min-h-[600px] flex flex-col">
          {isListLoading && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
          )}
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Audience Database</h2>
              <p className="text-sm text-gray-400 mt-1">Total Active Subscribers: <span className="text-indigo-600 font-bold">{total}</span></p>
            </div>
            
            <div className="relative w-full md:w-64">
              <input 
                type="text"
                placeholder="Search emails (e.g. *gmail*)"
                className="w-full bg-gray-50 border border-gray-200 pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
              <svg className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          <form onSubmit={handleAddSubscriber} className="flex gap-2 mb-8 p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <input 
              required
              type="email"
              placeholder="Add new subscriber (e.g. dev-ops@company.com)"
              className="flex-1 bg-white border border-gray-200 p-3 rounded-xl text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
            />
            <button 
              type="submit"
              disabled={isProcessing}
              className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all disabled:bg-gray-400"
            >
              Enroll
            </button>
          </form>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">
                  <th className="px-4 py-4">Subscriber Email</th>
                  <th className="px-4 py-4">Join Date</th>
                  <th className="px-4 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {subscribers.map(sub => (
                  <tr key={sub.id} className="group hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-4">
                      {editingSub?.id === sub.id ? (
                        <form onSubmit={handleUpdateSubscriber} className="flex gap-2">
                          <input 
                            autoFocus
                            className="bg-white border border-indigo-200 rounded-lg px-2 py-1 text-sm outline-none w-full"
                            value={editingSub.email}
                            onChange={e => setEditingSub({ ...editingSub, email: e.target.value })}
                          />
                          <button type="submit" className="text-emerald-600 font-bold text-xs uppercase hover:underline">Save</button>
                          <button type="button" onClick={() => setEditingSub(null)} className="text-gray-400 font-bold text-xs uppercase hover:underline">Cancel</button>
                        </form>
                      ) : (
                        <span className="text-sm font-bold text-gray-800">{sub.email}</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-xs text-gray-400 font-medium">
                      {new Date(sub.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4 text-right space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setEditingSub({ id: sub.id, email: sub.email })}
                        className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 uppercase"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleRemoveSubscriber(sub.id, sub.email)}
                        className="text-[10px] font-bold text-red-400 hover:text-red-600 uppercase"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {subscribers.length === 0 && !isListLoading && (
                  <tr>
                    <td colSpan={3} className="py-20 text-center text-gray-400 italic text-sm">
                      No subscribers found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-6 border-t border-gray-100 mt-auto">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button 
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 disabled:opacity-30 hover:bg-gray-100 transition-colors"
                >
                  Previous
                </button>
                <button 
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-xs font-bold text-indigo-600 disabled:opacity-30 hover:bg-indigo-100 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Global Templates Settings */}
      <div className="space-y-6">
        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm sticky top-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Communication</h2>
          </div>
          
          <p className="text-xs text-gray-500 mb-6 leading-relaxed bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50">
            Define global patterns for automated notifications. Use placeholders like <code className="bg-white px-1 font-bold text-indigo-600">{'{title}'}</code> to inject incident details.
          </p>

          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">New Outage Alert</label>
              <textarea 
                required
                className="w-full bg-gray-50 border border-gray-100 p-4 rounded-xl text-sm leading-relaxed outline-none focus:bg-white min-h-[140px] focus:ring-4 focus:ring-indigo-500/5 transition-all"
                value={settingsForm.incidentNewTemplate}
                onChange={e => setSettingsForm({...settingsForm, incidentNewTemplate: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Resolution Update</label>
              <textarea 
                required
                className="w-full bg-gray-50 border border-gray-100 p-4 rounded-xl text-sm leading-relaxed outline-none focus:bg-white min-h-[140px] focus:ring-4 focus:ring-indigo-500/5 transition-all"
                value={settingsForm.incidentResolvedTemplate}
                onChange={e => setSettingsForm({...settingsForm, incidentResolvedTemplate: e.target.value})}
              />
            </div>

            <button 
              type="submit"
              disabled={isProcessing}
              className="w-full bg-gray-900 text-white font-bold py-4 rounded-2xl hover:bg-black shadow-xl shadow-black/10 transition-all disabled:bg-gray-400 flex items-center justify-center gap-2"
            >
              {isProcessing && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
              Save Configuration
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionsTab;
