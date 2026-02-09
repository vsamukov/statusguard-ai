
import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../store.tsx';
import { NotificationSettings, Subscription } from '../../types.ts';

const SubscriptionsTab: React.FC = () => {
  const { state, addSubscriber, removeSubscriber, updateSubscriber, saveNotificationSettings, getSubscribers } = useApp();
  
  const [subscribers, setSubscribers] = useState<Subscription[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isListLoading, setIsListLoading] = useState(false);
  
  const [newEmail, setNewEmail] = useState('');
  const [editingSub, setEditingSub] = useState<{ id: string, email: string } | null>(null);
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
    if (!newEmail) return;
    setIsProcessing(true);
    try {
      await addSubscriber(newEmail);
      setNewEmail('');
      setPage(1);
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

          <form onSubmit={handleAddSubscriber} className="flex gap-2 mb-6 p-4 bg-gray-50 rounded-xl">
            <input 
              required
              type="email"
              placeholder="email@example.com"
              className="flex-1 bg-white border border-gray-200 p-2.5 rounded-lg text-sm outline-none"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
            />
            <button 
              type="submit"
              disabled={isProcessing}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold text-sm disabled:opacity-50"
            >
              Add
            </button>
          </form>

          <div className="flex-1">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-gray-50">
                {subscribers.map(sub => (
                  <tr key={sub.id} className="group hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-1">
                      {editingSub?.id === sub.id ? (
                        <form onSubmit={handleUpdateSubscriber} className="flex gap-2">
                          <input 
                            className="border rounded px-2 py-0.5 w-full"
                            value={editingSub.email}
                            onChange={e => setEditingSub({ ...editingSub, email: e.target.value })}
                          />
                          <button type="submit" className="text-indigo-600 font-bold">Save</button>
                        </form>
                      ) : (
                        <span className="font-medium text-gray-800">{sub.email}</span>
                      )}
                    </td>
                    <td className="py-3 text-right space-x-3">
                      <button onClick={() => setEditingSub({ id: sub.id, email: sub.email })} className="text-xs text-gray-400 hover:text-indigo-600">Edit</button>
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
