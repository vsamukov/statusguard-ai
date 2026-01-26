
import React, { useState } from 'react';
import { useApp } from '../../store.tsx';
import { Severity, Incident } from '../../types.ts';
import { geminiService } from '../../services/geminiService.ts';

const ReportingTab: React.FC = () => {
  const { state, reportIncident, updateIncident, resolveIncident } = useApp();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);

  const [form, setForm] = useState({
    componentId: '',
    title: '',
    severity: Severity.DEGRADED,
    description: '',
    startTime: new Date().toISOString().slice(0, 16),
    endTime: ''
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      if (editingIncident) {
        await updateIncident(editingIncident.id, form);
      } else {
        await reportIncident(form);
      }
      setEditingIncident(null);
      setForm({ ...form, title: '', description: '', endTime: '' });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(true);
    }
  };

  const handleAiSuggest = async () => {
    if (!form.title || !form.description) return;
    setIsAiSuggesting(true);
    try {
      const summary = await geminiService.generateIncidentSummary(form.title, form.description);
      setForm({ ...form, description: summary });
    } finally {
      setIsAiSuggesting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 bg-white p-6 rounded-xl border shadow-sm">
        <div className="flex justify-between mb-6">
          <h2 className="text-lg font-bold">{editingIncident ? 'Edit Record' : 'Post New Update'}</h2>
          <button onClick={handleAiSuggest} disabled={isAiSuggesting} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded">
            {isAiSuggesting ? 'Thinking...' : 'AI Refine'}
          </button>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <select 
            required
            className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20"
            value={form.componentId}
            onChange={e => setForm({...form, componentId: e.target.value})}
          >
            <option value="">Target Component...</option>
            {state.components.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input 
            required
            placeholder="Incident Title"
            className="w-full border p-3 rounded-lg outline-none"
            value={form.title}
            onChange={e => setForm({...form, title: e.target.value})}
          />
          <textarea 
            required
            placeholder="Public communication..."
            rows={5}
            className="w-full border p-3 rounded-lg outline-none"
            value={form.description}
            onChange={e => setForm({...form, description: e.target.value})}
          />
          <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg">
            {editingIncident ? 'Update History' : 'Publish to Status Page'}
          </button>
        </form>
      </div>
      
      <div className="space-y-4">
        <h3 className="font-bold text-sm uppercase text-gray-400">Active Incidents</h3>
        {state.incidents.filter(i => !i.endTime).map(inc => (
          <div key={inc.id} className="p-4 bg-white border rounded-xl shadow-sm flex flex-col gap-2">
            <span className="text-xs font-bold text-gray-800">{inc.title}</span>
            <div className="flex gap-2">
              <button onClick={() => resolveIncident(inc.id)} className="text-[10px] font-bold text-emerald-600 uppercase">Resolve</button>
              <button onClick={() => setEditingIncident(inc)} className="text-[10px] font-bold text-indigo-600 uppercase">Edit</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReportingTab;
