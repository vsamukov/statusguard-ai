
import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../store';
import { NotificationSettings, Subscription } from '../../types';

const SubscriptionsTab: React.FC = () => {
  const { state, addSubscriber, removeSubscriber, updateSubscriber, saveNotificationSettings, getSubscribers } = useApp();
  
  const [subscribers, setSubscribers] = useState<Subscription[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isListLoading, setIsListLoading] = useState(false);
  
  const [newEmail, setNewEmail] = useState('');
  const [newRegionIds, setNewRegionIds] = useState<string[]>([]);
  const [editingSub, setEditingSub] = useState<{ id: string, email: string, regionIds: string[] } | null>(null);
  const [settingsForm, setSettingsForm] = useState<NotificationSettings>(state.notificationSettings);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchList = useCallback(async () => {
    setIsListLoading(true);
    try {
      const data = await getSubscribers(page, 10, search);
      setSubscribers(data.items);
      setTotal(data.total);
    } catch (err) {
      console.error("Failed to load subscribers list", err);
    } finally {
      setIsListLoading(false);
    }
  }, [page, search, getSubscribers]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleAddSubscriber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || newRegionIds.length === 0) return alert("Email and at least one Region are required");
    setIsProcessing(true);
    try {
      await addSubscriber(newEmail, newRegionIds);
      setNewEmail('');
      setNewRegionIds([]);
      setPage(1);
      fetchList();
    } catch (err) {
      alert("Failed to add subscriber");
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleNewRegion = (id: string) => {
    setNewRegionIds(prev => 
      prev.includes(id) ? prev.filter(rid => rid !== id) : [...prev, id]
    );
  };

  const handleUpdateSubscriber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSub) return;
    if (editingSub.regionIds.length === 0) return alert("At least one region must be selected");
    setIsProcessing(true);
    try {
      await updateSubscriber(editingSub.id, editingSub.email, editingSub.regionIds);
      setEditingSub(null);
      fetchList();
    } catch (err) {
      alert("Failed to update subscriber");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveSubscriber = async (id: string, email: string) => {
    if (!confirm(`Remove ${email}?`)) return;
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
      alert("Settings saved.");
    } catch (err) {
      alert("Save failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const totalPages = Math.ceil(total / 10);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm flex flex-col min-h-[500px]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">Subscribers ({total})</h2>
            <input 
              type="text"
              placeholder="Filter emails..."
              className="bg-gray-50 border border-gray-200 px-4 py-2 rounded-xl text-sm outline-none w-48 focus:bg-white"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          <form onSubmit={handleAddSubscriber} className="flex flex-col gap-4 mb-6 p-6 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Subscriber Email</label>
                <input 
                  required
                  type="email"
                  placeholder="email@example.com"
                  className="w-full bg-white border border-gray-200 p-3 rounded-xl text-sm outline-none focus:border-indigo-300 transition-colors"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                />
              </div>
              <div className="flex-1 space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Select Regions</label>
                <div className="bg-white border border-gray-200 rounded-xl p-3 max-h-32 overflow-y-auto space-y-2">
                  {(state.regions || []).map(r => (
                    <label key={r.id} className="flex items-center gap-3 cursor-pointer group">
                      <input 
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        checked={newRegionIds.includes(r.id)}
                        onChange={() => toggleNewRegion(r.id)}
                      />
                      <span className="text-xs font-medium text-gray-600 group-hover:text-gray-900 transition-colors">{r.name}</span>
                    </label>
                  ))}
                  {(state.regions || []).length === 0 && <p className="text-[10px] text-gray-400 italic">No regions defined</p>}
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button 
                type="submit"
                disabled={isProcessing}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-indigo-700 transition-all shadow-sm"
              >
                {isProcessing ? 'Processing...' : 'Add Subscriber'}
              </button>
            </div>
          </form>

          <div className="flex-1">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100">
                <tr>
                  <th className="py-3 px-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email</th>
                  <th className="py-3 px-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Regions</th>
                  <th className="py-3 px-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(subscribers || []).map(sub => (
                  <tr key={sub.id} className="group hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-1">
                      {editingSub?.id === sub.id ? (
                        <form onSubmit={handleUpdateSubscriber} className="space-y-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Email</label>
                            <input 
                              className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-400"
                              value={editingSub.email}
                              onChange={e => setEditingSub({ ...editingSub, email: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Regions</label>
                            <div className="bg-white border border-indigo-200 rounded-lg p-2 max-h-24 overflow-y-auto space-y-1">
                              {(state.regions || []).map(r => (
                                <label key={r.id} className="flex items-center gap-2 cursor-pointer">
                                  <input 
                                    type="checkbox"
                                    className="w-3 h-3 rounded border-gray-300 text-indigo-600"
                                    checked={editingSub.regionIds.includes(r.id)}
                                    onChange={() => {
                                      const rids = editingSub.regionIds.includes(r.id)
                                        ? editingSub.regionIds.filter(id => id !== r.id)
                                        : [...editingSub.regionIds, r.id];
                                      setEditingSub({ ...editingSub, regionIds: rids });
                                    }}
                                  />
                                  <span className="text-[10px] font-medium text-gray-600">{r.name}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button type="button" onClick={() => setEditingSub(null)} className="text-[10px] font-bold text-gray-400 hover:text-gray-600">Cancel</button>
                            <button type="submit" className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-[10px] font-bold hover:bg-indigo-700">Save Changes</button>
                          </div>
                        </form>
                      ) : (
                        <span className="font-medium text-gray-800">{sub.email}</span>
                      )}
                    </td>
                    <td className="py-3 px-1">
                      <div className="flex flex-wrap gap-1">
                        {(sub.regions || []).map((r: any) => (
                          <span key={r.id} className="text-[9px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 font-bold rounded uppercase">
                            {r.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 text-right space-x-3">
                      <button onClick={() => setEditingSub({ id: sub.id, email: sub.email, regionIds: (sub.regions || []).map((r: any) => r.id) })} className="text-xs text-gray-400 hover:text-indigo-600">Edit</button>
                      <button onClick={() => handleRemoveSubscriber(sub.id, sub.email)} className="text-xs text-red-300 hover:text-red-500">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {isListLoading && <p className="text-center py-4 text-gray-400 text-xs animate-pulse">Loading list...</p>}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 bg-gray-100 rounded text-xs disabled:opacity-30">Prev</button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 bg-gray-100 rounded text-xs disabled:opacity-30">Next</button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Messaging Templates</h2>
          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Outage Notification</label>
              <textarea 
                className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl text-sm min-h-[120px]"
                value={settingsForm.incidentNewTemplate}
                onChange={e => setSettingsForm({...settingsForm, incidentNewTemplate: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Resolution Notification</label>
              <textarea 
                className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl text-sm min-h-[120px]"
                value={settingsForm.incidentResolvedTemplate}
                onChange={e => setSettingsForm({...settingsForm, incidentResolvedTemplate: e.target.value})}
              />
            </div>
            <button 
              type="submit"
              disabled={isProcessing}
              className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-black disabled:opacity-50"
            >
              Save Settings
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionsTab;
