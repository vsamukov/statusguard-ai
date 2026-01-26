
import React, { useState, useMemo } from 'react';
import { useApp } from '../../store.tsx';
import { Severity, Incident } from '../../types.ts';
import { geminiService } from '../../services/geminiService.ts';

const ReportingTab: React.FC = () => {
  const { state, reportIncident, updateIncident, resolveIncident, state: { timezoneOffset } } = useApp();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);

  const initialForm = {
    componentId: '',
    title: '',
    severity: Severity.DEGRADED,
    description: '',
    startTime: new Date().toISOString().slice(0, 16),
    endTime: ''
  };

  const [form, setForm] = useState(initialForm);

  const activeIncidents = useMemo(() => state.incidents.filter(i => !i.endTime), [state.incidents]);

  const handleEdit = (inc: Incident) => {
    setEditingIncident(inc);
    setForm({
      componentId: inc.componentId,
      title: inc.title,
      severity: inc.severity,
      description: inc.description,
      startTime: inc.startTime.slice(0, 16),
      endTime: inc.endTime ? inc.endTime.slice(0, 16) : ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingIncident(null);
    setForm(initialForm);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.componentId) return alert('Please select a component.');
    setIsProcessing(true);
    try {
      if (editingIncident) {
        await updateIncident(editingIncident.id, {
          ...form,
          endTime: form.endTime ? new Date(form.endTime).toISOString() : null
        });
      } else {
        await reportIncident({
          ...form,
          endTime: form.endTime ? new Date(form.endTime).toISOString() : null
        });
      }
      handleCancelEdit();
    } catch (err: any) {
      alert(`Operation failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAiSuggest = async () => {
    if (!form.title || !form.description) return alert('Enter a title and description for AI to refine.');
    setIsAiSuggesting(true);
    try {
      const summary = await geminiService.generateIncidentSummary(form.title, form.description);
      setForm({ ...form, description: summary });
    } catch (err) {
      console.error('AI Suggestion error:', err);
    } finally {
      setIsAiSuggesting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
          {isProcessing && <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center font-bold text-indigo-600">Publishing Update...</div>}
          
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{editingIncident ? 'Modify Record' : 'Dispatch Status Update'}</h2>
              <p className="text-sm text-gray-400 mt-1">Updates are broadcast to all active subscribers.</p>
            </div>
            <div className="flex gap-2">
              {editingIncident && (
                <button onClick={handleCancelEdit} className="text-xs font-bold text-gray-400 hover:text-gray-600 uppercase px-3 py-1.5">
                  Cancel Edit
                </button>
              )}
              <button 
                onClick={handleAiSuggest} 
                disabled={isAiSuggesting} 
                className={`text-xs font-bold px-4 py-2 rounded-xl transition-all border ${
                  isAiSuggesting ? 'bg-gray-50 text-gray-400 border-gray-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100'
                }`}
              >
                {isAiSuggesting ? 'Thinking...' : 'AI Refine with Gemini'}
              </button>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Infrastructure Target</label>
                <select 
                  required
                  className="w-full bg-gray-50 border border-gray-100 p-3.5 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all text-sm font-medium"
                  value={form.componentId}
                  onChange={e => setForm({...form, componentId: e.target.value})}
                >
                  <option value="">Select component...</option>
                  {state.components.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Urgency / Severity</label>
                <select 
                  className="w-full bg-gray-50 border border-gray-100 p-3.5 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all text-sm font-bold"
                  value={form.severity}
                  onChange={e => setForm({...form, severity: e.target.value as Severity})}
                >
                  <option value={Severity.DEGRADED}>🟡 Service Degradation</option>
                  <option value={Severity.OUTAGE}>🔴 Partial/Major Outage</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Public Title</label>
              <input 
                required
                placeholder="e.g. Investigation of API Gateway Latency"
                className="w-full bg-gray-50 border border-gray-100 p-3.5 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all text-sm font-bold placeholder:font-normal"
                value={form.title}
                onChange={e => setForm({...form, title: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Public Communication</label>
              <textarea 
                required
                placeholder="Explain the impact and what steps are being taken..."
                rows={6}
                className="w-full bg-gray-50 border border-gray-100 p-4 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all text-sm leading-relaxed"
                value={form.description}
                onChange={e => setForm({...form, description: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Start Time (Local)</label>
                <input 
                  type="datetime-local" 
                  required
                  className="w-full bg-gray-50 border border-gray-100 p-3 rounded-xl text-xs font-semibold outline-none focus:bg-white"
                  value={form.startTime}
                  onChange={e => setForm({...form, startTime: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">End Time (Resolution)</label>
                <input 
                  type="datetime-local" 
                  className="w-full bg-gray-50 border border-gray-100 p-3 rounded-xl text-xs font-semibold outline-none focus:bg-white"
                  value={form.endTime}
                  onChange={e => setForm({...form, endTime: e.target.value})}
                />
              </div>
            </div>

            <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 transition-all flex items-center justify-center gap-3 mt-4">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
              {editingIncident ? 'Update Historical Record' : 'Broadcast Status Update'}
            </button>
          </form>
        </div>
      </div>
      
      <div className="space-y-6">
        <div className="bg-indigo-900 rounded-2xl p-6 text-white shadow-xl shadow-indigo-900/10">
          <h3 className="text-sm font-black uppercase tracking-widest mb-4 opacity-60">Status Overview</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold">Active Issues</span>
              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${activeIncidents.length > 0 ? 'bg-red-500' : 'bg-white/10'}`}>
                {activeIncidents.length}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold">Subscribers</span>
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-white/10">
                {state.subscriptions.length}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-bold text-xs uppercase text-gray-400 tracking-widest px-1">Active Now</h3>
          {activeIncidents.length > 0 ? (
            activeIncidents.map(inc => (
              <div key={inc.id} className="p-5 bg-white border border-gray-100 rounded-2xl shadow-sm group hover:border-indigo-200 transition-all">
                <div className="flex justify-between items-start mb-3">
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                    inc.severity === Severity.OUTAGE ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'
                  }`}>
                    {inc.severity}
                  </span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => resolveIncident(inc.id)} 
                      className="text-[10px] font-bold text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded-lg transition-colors"
                    >
                      RESOLVE
                    </button>
                    <button 
                      onClick={() => handleEdit(inc)} 
                      className="text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors"
                    >
                      EDIT
                    </button>
                  </div>
                </div>
                <h4 className="text-sm font-bold text-gray-800 line-clamp-2 leading-tight mb-2">{inc.title}</h4>
                <p className="text-[10px] text-gray-400 font-medium italic">Detected {new Date(inc.startTime).toLocaleTimeString()}</p>
              </div>
            ))
          ) : (
            <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mx-auto mb-2 text-emerald-400 shadow-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
              </div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">All Clear</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportingTab;
