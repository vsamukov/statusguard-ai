
import React, { useState, useMemo } from 'react';
import { useApp } from '../../store.tsx';
import { Severity, Incident } from '../../types.ts';
import { geminiService } from '../../services/geminiService.ts';

const ReportingTab: React.FC = () => {
  const { state, reportIncident, updateIncident, resolveIncident, addTemplate } = useApp();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);

  const initialForm = {
    regionId: '',
    componentId: '',
    title: '',
    severity: Severity.DEGRADED,
    description: '',
    startTime: new Date().toISOString().slice(0, 16),
    endTime: '',
    saveAsTemplate: false,
    templateName: ''
  };

  const [form, setForm] = useState(initialForm);

  const activeIncidents = useMemo(() => state.incidents.filter(i => !i.endTime), [state.incidents]);
  const pastIncidents = useMemo(() => 
    state.incidents.filter(i => !!i.endTime).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()).slice(0, 10), 
    [state.incidents]
  );

  const filteredComponents = useMemo(() => 
    state.components.filter(c => c.regionId === form.regionId), 
  [state.components, form.regionId]);

  const availableTemplates = useMemo(() => {
    const comp = state.components.find(c => c.id === form.componentId);
    if (!comp) return [];
    return state.templates.filter(t => t.componentName === comp.name);
  }, [state.templates, form.componentId, state.components]);

  const handleEdit = (inc: Incident) => {
    const comp = state.components.find(c => c.id === inc.componentId);
    setEditingIncident(inc);
    setForm({
      ...initialForm,
      regionId: comp?.regionId || '',
      componentId: inc.componentId,
      title: inc.title,
      severity: inc.severity,
      description: inc.description,
      startTime: inc.startTime.slice(0, 16),
      endTime: inc.endTime ? inc.endTime.slice(0, 16) : ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const applyTemplate = (templateId: string) => {
    const t = state.templates.find(x => x.id === templateId);
    if (t) setForm(prev => ({ ...prev, title: t.title, description: t.description }));
  };

  const handleCancelEdit = () => {
    setEditingIncident(null);
    setForm(initialForm);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.componentId) return alert('Select component.');
    setIsProcessing(true);
    try {
      const payload = {
        componentId: form.componentId,
        title: form.title,
        severity: form.severity,
        description: form.description,
        startTime: new Date(form.startTime).toISOString(),
        endTime: form.endTime ? new Date(form.endTime).toISOString() : null
      };
      if (editingIncident) await updateIncident(editingIncident.id, payload);
      else {
        await reportIncident(payload);
        if (form.saveAsTemplate && form.templateName) {
          const comp = state.components.find(c => c.id === form.componentId);
          if (comp) {
            await addTemplate({
              componentName: comp.name, name: form.templateName, title: form.title, description: form.description
            });
          }
        }
      }
      handleCancelEdit();
    } catch (err: any) { alert(`Failed: ${err.message}`); }
    finally { setIsProcessing(false); }
  };

  const handleAiSuggest = async () => {
    if (!form.title || !form.description) return;
    setIsAiSuggesting(true);
    try {
      const summary = await geminiService.generateIncidentSummary(form.title, form.description);
      setForm({ ...form, description: summary });
    } catch (err) {} finally { setIsAiSuggesting(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-8">
        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-bold text-gray-900">{editingIncident ? 'Edit Incident' : 'Post Update'}</h2>
            <div className="flex gap-2">
              {editingIncident && <button onClick={handleCancelEdit} className="text-xs font-bold text-gray-400">Cancel</button>}
              <button onClick={handleAiSuggest} disabled={isAiSuggesting} className="text-xs font-bold px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl">
                {isAiSuggesting ? 'AI...' : 'Gemini AI'}
              </button>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select required className="w-full bg-gray-50 border p-3 rounded-xl text-sm" value={form.regionId} onChange={e => setForm({...form, regionId: e.target.value, componentId: ''})}>
                <option value="">Region...</option>
                {state.regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <select required disabled={!form.regionId} className="w-full bg-gray-50 border p-3 rounded-xl text-sm" value={form.componentId} onChange={e => setForm({...form, componentId: e.target.value})}>
                <option value="">Component...</option>
                {filteredComponents.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {availableTemplates.length > 0 && (
              <select className="w-full text-xs border rounded-lg px-3 py-2 bg-indigo-50 border-indigo-100" onChange={e => applyTemplate(e.target.value)} defaultValue="">
                <option value="">Templates for {state.components.find(c => c.id === form.componentId)?.name}...</option>
                {availableTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select className="w-full bg-gray-50 border p-3 rounded-xl text-sm font-bold" value={form.severity} onChange={e => setForm({...form, severity: e.target.value as Severity})}>
                <option value={Severity.DEGRADED}>🟡 Degradation</option>
                <option value={Severity.OUTAGE}>🔴 Outage</option>
              </select>
              <input required placeholder="Headline" className="w-full bg-gray-50 border p-3 rounded-xl text-sm font-bold" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
            </div>

            <textarea required placeholder="Message" rows={4} className="w-full bg-gray-50 border p-3 rounded-xl text-sm" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="datetime-local" required className="w-full bg-gray-50 border p-3 rounded-xl text-xs" value={form.startTime} onChange={e => setForm({...form, startTime: e.target.value})} />
              <input type="datetime-local" placeholder="End (opt)" className="w-full bg-gray-50 border p-3 rounded-xl text-xs" value={form.endTime} onChange={e => setForm({...form, endTime: e.target.value})} />
            </div>

            <button type="submit" disabled={isProcessing} className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl">
              {editingIncident ? 'Update' : 'Publish'}
            </button>
          </form>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Recent Past</h3>
          {pastIncidents.map(inc => (
            <div key={inc.id} className="bg-white p-4 rounded-xl border flex items-center justify-between">
              <span className="text-sm font-bold text-gray-800">{inc.title}</span>
              <button onClick={() => handleEdit(inc)} className="text-[10px] font-bold text-indigo-600">EDIT</button>
            </div>
          ))}
        </div>
      </div>
      
      <div className="space-y-6">
        <div className="bg-indigo-900 rounded-2xl p-6 text-white">
          <h3 className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-50">Operational Summary</h3>
          <div className="flex justify-between items-center text-xs">
            <span>Active Outages</span>
            <span className={`font-black ${activeIncidents.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{activeIncidents.length}</span>
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Active Now</h3>
          {activeIncidents.map(inc => (
            <div key={inc.id} className="p-4 bg-white border border-red-100 rounded-xl">
              <div className="flex justify-between mb-2">
                <span className="text-[9px] font-black uppercase text-red-600">{inc.severity}</span>
                <button onClick={() => resolveIncident(inc.id)} className="text-[10px] font-bold text-emerald-600">RESOLVE</button>
              </div>
              <h4 className="text-sm font-bold text-gray-800">{inc.title}</h4>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReportingTab;
