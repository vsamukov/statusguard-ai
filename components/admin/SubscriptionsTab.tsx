
import React, { useState } from 'react';
import { useApp } from '../../store.tsx';
import { NotificationSettings } from '../../types.ts';

const SubscriptionsTab: React.FC = () => {
  const { state, addSubscriber, removeSubscriber, saveNotificationSettings } = useApp();
  const [newEmail, setNewEmail] = useState('');
  const [settingsForm, setSettingsForm] = useState<NotificationSettings>(state.notificationSettings);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAddSubscriber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    setIsProcessing(true);
    try {
      await addSubscriber(newEmail);
      setNewEmail('');
    } catch (err) {
      alert("Failed to add subscriber");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      await saveNotificationSettings(settingsForm);
      alert("Notification settings saved");
    } catch (err) {
      alert("Failed to save settings");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Subscribers List */}
      <div className="space-y-6">
        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Audience Management</h2>
          <form onSubmit={handleAddSubscriber} className="flex gap-2 mb-8">
            <input 
              required
              type="email"
              placeholder="operator@company.com"
              className="flex-1 bg-gray-50 border border-gray-100 p-3 rounded-xl text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
            />
            <button 
              type="submit"
              disabled={isProcessing}
              className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/20 disabled:bg-gray-400"
            >
              Add
            </button>
          </form>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {state.subscriptions.map(sub => (
              <div key={sub.id} className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-100 group">
                <div>
                  <p className="text-sm font-bold text-gray-800">{sub.email}</p>
                  <p className="text-[10px] text-gray-400 font-medium">Joined {new Date(sub.createdAt).toLocaleDateString()}</p>
                </div>
                <button 
                  onClick={() => confirm(`Unsubscribe ${sub.email}?`) && removeSubscriber(sub.id)}
                  className="text-xs font-bold text-red-400 hover:text-red-600 uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Remove
                </button>
              </div>
            ))}
            {state.subscriptions.length === 0 && (
              <p className="text-center py-12 text-gray-400 text-sm italic">No subscribers yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Notification Templates */}
      <div className="space-y-6">
        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Global Templates</h2>
          <p className="text-xs text-gray-500 mb-6 leading-relaxed">
            These templates define the email notifications sent to subscribers. <br/>
            Available placeholders: <code className="bg-indigo-50 text-indigo-600 px-1 rounded font-bold">{'{title}'}</code>, <code className="bg-indigo-50 text-indigo-600 px-1 rounded font-bold">{'{component}'}</code>, <code className="bg-indigo-50 text-indigo-600 px-1 rounded font-bold">{'{service}'}</code>, <code className="bg-indigo-50 text-indigo-600 px-1 rounded font-bold">{'{region}'}</code>, <code className="bg-indigo-50 text-indigo-600 px-1 rounded font-bold">{'{severity}'}</code>
          </p>

          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">New Incident Notification</label>
              <textarea 
                required
                className="w-full bg-gray-50 border border-gray-100 p-4 rounded-xl text-sm leading-relaxed outline-none focus:bg-white min-h-[120px]"
                value={settingsForm.incidentNewTemplate}
                onChange={e => setSettingsForm({...settingsForm, incidentNewTemplate: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Resolution Notification</label>
              <textarea 
                required
                className="w-full bg-gray-50 border border-gray-100 p-4 rounded-xl text-sm leading-relaxed outline-none focus:bg-white min-h-[120px]"
                value={settingsForm.incidentResolvedTemplate}
                onChange={e => setSettingsForm({...settingsForm, incidentResolvedTemplate: e.target.value})}
              />
            </div>

            <button 
              type="submit"
              disabled={isProcessing}
              className="w-full bg-gray-900 text-white font-bold py-4 rounded-2xl hover:bg-black shadow-xl transition-all disabled:bg-gray-400"
            >
              Update Global Defaults
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionsTab;
