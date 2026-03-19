
import React, { useState, useMemo } from 'react';
import { useApp } from '../../store';
import { Severity, Incident } from '../../types';
import { geminiService } from '../../services/geminiService';

const ReportingTab: React.FC = () => {
  const { state, reportIncident, updateIncident, resolveIncident, addTemplate } = useApp();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);

  const initialForm = {
    regionId: '',
    componentIds: [] as string[],
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
    if (form.componentIds.length === 0) return [];
    const comp = state.components.find(c => c.id === form.componentIds[0]);
    if (!comp) return [];
    return state.templates.filter(t => t.componentName === comp.name);
  }, [state.templates, form.componentIds, state.components]);

  const handleEdit = (inc: Incident) => {
    const firstComp = state.components.find(c => inc.componentIds.includes(c.id));
    setEditingIncident(inc);
    setForm({
      ...initialForm,
      regionId: firstComp?.regionId || '',
      componentIds: inc.componentIds,
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
    if (form.componentIds.length === 0) return alert('Select at least one component.');
    setIsProcessing(true);
    try {
      const payload = {
        componentIds: form.componentIds,
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
          const comp = state.components.find(c => c.id === form.componentIds[0]);
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

  const toggleComponent = (id: string) => {
    setForm(prev => ({
      ...prev,
      componentIds: prev.componentIds.includes(id) 
        ? prev.componentIds.filter(cid => cid !== id)
        : [...prev.componentIds, id]
    }));
  };

  const handleAiSuggest = async () => {
    if (!form.title || !form.description) return;
    setIsAiSuggesting(true);
    try {
      const summary = await geminiService.generateIncidentSummary(form.title, form.description);
      setForm({ ...form, description: summary || form.description });
    } catch (err) {} finally { setIsAiSuggesting(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-8">
        <div className={`bg-white p-8 rounded-2xl border transition-all duration-300 shadow-sm ${editingIncident ? 'border-indigo-500 ring-4 ring-indigo-500/5' : 'border-gray-200'}`}>
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-bold text-gray-900">{editingIncident ? 'Edit Incident' : 'Post Update'}</h2>
            <div className="flex gap-2">
              {editingIncident && <button type="button" onClick={handleCancelEdit} className="text-xs font-bold text-gray-400 hover:text-gray-600 px-2 py-2">Cancel</button>}
              <button type="button" onClick={handleAiSuggest} disabled={isAiSuggesting} className="text-xs font-bold px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors">
                {isAiSuggesting ? 'AI...' : 'Gemini AI'}
              </button>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="space-y-4">
              <select required className="w-full bg-gray-50 border p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20" value={form.regionId} onChange={e => setForm({...form, regionId: e.target.value, componentIds: []})}>
                <option value="">Select Region...</option>
                {state.regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              
              {form.regionId && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Affected Components</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {filteredComponents.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleComponent(c.id)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                          form.componentIds.includes(c.id)
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-gray-50 border-gray-100 text-gray-600 hover:border-indigo-200'
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {availableTemplates.length > 0 && (
              <select className="w-full text-xs border rounded-lg px-3 py-2 bg-indigo-50 border-indigo-100 outline-none" onChange={e => applyTemplate(e.target.value)} defaultValue="">
                <option value="">Templates for {state.components.find(c => c.id === form.componentIds[0])?.name}...</option>
                {availableTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select className="w-full bg-gray-50 border p-3 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" value={form.severity} onChange={e => setForm({...form, severity: e.target.value as Severity})}>
                <option value={Severity.DEGRADED}>🟡 Degradation</option>
                <option value={Severity.OUTAGE}>🔴 Outage</option>
              </select>
              <input required placeholder="Headline" className="w-full bg-gray-50 border p-3 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
            </div>

            <textarea required placeholder="Message" rows={4} className="w-full bg-gray-50 border p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Start Time</label>
                <input type="datetime-local" required className="w-full bg-gray-50 border p-3 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/20" value={form.startTime} onChange={e => setForm({...form, startTime: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">End Time (optional)</label>
                <input type="datetime-local" placeholder="End (opt)" className="w-full bg-gray-50 border p-3 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/20" value={form.endTime} onChange={e => setForm({...form, endTime: e.target.value})} />
              </div>
            </div>

            <button type="submit" disabled={isProcessing} className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/10">
              {editingIncident ? 'Update Incident' : 'Publish Incident'}
            </button>
          </form>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Recent Past</h3>
          {pastIncidents.map(inc => (
            <div key={inc.id} className={`bg-white p-4 rounded-xl border flex items-center justify-between transition-all ${editingIncident?.id === inc.id ? 'border-indigo-500 bg-indigo-50/30' : 'border-gray-100'}`}>
              <div className="flex flex-col">
                 <span className="text-sm font-bold text-gray-800">{inc.title}</span>
                 <div className="flex flex-wrap gap-1 mt-1">
                   {inc.componentIds.map(cid => {
                     const comp = state.components.find(c => c.id === cid);
                     return comp ? (
                       <span key={cid} className="text-[8px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded uppercase font-bold">
                         {comp.name}
                       </span>
                     ) : null;
                   })}
                 </div>
                 <span className="text-[10px] text-gray-400 mt-1">{new Date(inc.startTime).toLocaleDateString()}</span>
              </div>
              <button onClick={() => handleEdit(inc)} className="text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">EDIT</button>
            </div>
          ))}
          {pastIncidents.length === 0 && (
            <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200 text-xs text-gray-400">No recent incidents.</div>
          )}
        </div>
      </div>
      
      <div className="space-y-6">
        <div className="bg-indigo-900 rounded-2xl p-6 text-white shadow-xl shadow-indigo-900/20">
          <h3 className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-50">Operational Summary</h3>
          <div className="flex justify-between items-center text-xs">
            <span className="font-medium">Active Outages</span>
            <span className={`font-black text-lg ${activeIncidents.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{activeIncidents.length}</span>
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Active Now</h3>
          {activeIncidents.map(inc => (
            <div key={inc.id} className={`p-5 bg-white border rounded-2xl transition-all ${editingIncident?.id === inc.id ? 'border-indigo-500 ring-2 ring-indigo-500/10' : 'border-red-100 shadow-sm'}`}>
              <div className="flex justify-between items-start mb-3">
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${inc.severity === Severity.OUTAGE ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-600'}`}>{inc.severity}</span>
                <div className="flex gap-2">
                   <button onClick={() => handleEdit(inc)} className="text-[10px] font-bold text-indigo-600 hover:underline">EDIT</button>
                   <button onClick={() => resolveIncident(inc.id)} className="text-[10px] font-bold text-emerald-600 hover:underline">RESOLVE</button>
                </div>
              </div>
              <h4 className="text-sm font-bold text-gray-800 leading-snug">{inc.title}</h4>
              <div className="flex flex-wrap gap-1 mt-2">
                {inc.componentIds.map(cid => {
                  const comp = state.components.find(c => c.id === cid);
                  return comp ? (
                    <span key={cid} className="text-[8px] px-1.5 py-0.5 bg-indigo-50 text-indigo-500 rounded uppercase font-black">
                      {comp.name}
                    </span>
                  ) : null;
                })}
              </div>
              <p className="text-[10px] text-gray-400 mt-2 font-medium">Started: {new Date(inc.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          ))}
          {activeIncidents.length === 0 && (
            <div className="p-8 text-center bg-emerald-50 rounded-2xl border border-emerald-100">
               <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mx-auto mb-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
               </div>
               <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Systems Nominal</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportingTab;
