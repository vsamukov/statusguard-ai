
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
    serviceId: '',
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
  const pastIncidents = useMemo(() => state.incidents.filter(i => !!i.endTime).sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()), [state.incidents]);

  const filteredServices = useMemo(() => 
    state.services.filter(s => s.regionId === form.regionId), 
  [state.services, form.regionId]);

  const filteredComponents = useMemo(() => 
    state.components.filter(c => c.serviceId === form.serviceId), 
  [state.components, form.serviceId]);

  const availableTemplates = useMemo(() => {
    const comp = state.components.find(c => c.id === form.componentId);
    if (!comp) return [];
    return state.templates.filter(t => t.componentName === comp.name);
  }, [state.templates, form.componentId, state.components]);

  const handleEdit = (inc: Incident) => {
    const comp = state.components.find(c => c.id === inc.componentId);
    const svc = state.services.find(s => s.id === comp?.serviceId);
    
    setEditingIncident(inc);
    setForm({
      ...initialForm,
      regionId: svc?.regionId || '',
      serviceId: comp?.serviceId || '',
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
    if (t) {
      setForm(prev => ({ ...prev, title: t.title, description: t.description }));
    }
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
      const incidentPayload = {
        componentId: form.componentId,
        title: form.title,
        severity: form.severity,
        description: form.description,
        startTime: new Date(form.startTime).toISOString(),
        endTime: form.endTime ? new Date(form.endTime).toISOString() : null
      };

      if (editingIncident) {
        await updateIncident(editingIncident.id, incidentPayload);
      } else {
        await reportIncident(incidentPayload);
        
        // Save as template if requested
        if (form.saveAsTemplate && form.templateName) {
          const comp = state.components.find(c => c.id === form.componentId);
          if (comp) {
            await addTemplate({
              componentName: comp.name,
              name: form.templateName,
              title: form.title,
              description: form.description
            });
          }
        }
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
      <div className="lg:col-span-2 space-y-8">
        {/* Creation/Edit Form */}
        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
          {isProcessing && <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center font-bold text-indigo-600">Publishing Update...</div>}
          
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{editingIncident ? 'Modify Incident' : 'Report New Incident'}</h2>
              <p className="text-sm text-gray-400 mt-1">Fill in the details below to update status.</p>
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
            {/* Hierarchical Selection */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Region</label>
                <select 
                  required
                  className="w-full bg-gray-50 border border-gray-100 p-3 rounded-xl outline-none text-sm font-medium"
                  value={form.regionId}
                  onChange={e => setForm({...form, regionId: e.target.value, serviceId: '', componentId: ''})}
                >
                  <option value="">Select Region...</option>
                  {state.regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Service</label>
                <select 
                  required
                  disabled={!form.regionId}
                  className="w-full bg-gray-50 border border-gray-100 p-3 rounded-xl outline-none text-sm font-medium disabled:opacity-50"
                  value={form.serviceId}
                  onChange={e => setForm({...form, serviceId: e.target.value, componentId: ''})}
                >
                  <option value="">Select Service...</option>
                  {filteredServices.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Component</label>
                <select 
                  required
                  disabled={!form.serviceId}
                  className="w-full bg-gray-50 border border-gray-100 p-3 rounded-xl outline-none text-sm font-medium disabled:opacity-50"
                  value={form.componentId}
                  onChange={e => setForm({...form, componentId: e.target.value})}
                >
                  <option value="">Select Component...</option>
                  {filteredComponents.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            {/* Template Selection */}
            {availableTemplates.length > 0 && (
              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-indigo-600 uppercase">Load Template</span>
                  <span className="text-[10px] text-indigo-400">Pre-defined responses for this component</span>
                </div>
                <select 
                  className="text-xs border border-indigo-200 rounded-lg px-3 py-1.5 bg-white outline-none font-bold"
                  onChange={e => applyTemplate(e.target.value)}
                  defaultValue=""
                >
                  <option value="">Choose template...</option>
                  {availableTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Severity</label>
                  <select 
                    className="w-full bg-gray-50 border border-gray-100 p-3.5 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all text-sm font-bold"
                    value={form.severity}
                    onChange={e => setForm({...form, severity: e.target.value as Severity})}
                  >
                    <option value={Severity.DEGRADED}>🟡 Degraded</option>
                    <option value={Severity.OUTAGE}>🔴 Outage</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Public Title</label>
                  <input 
                    required
                    placeholder="Headline for status page"
                    className="w-full bg-gray-50 border border-gray-100 p-3.5 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all text-sm font-bold placeholder:font-normal"
                    value={form.title}
                    onChange={e => setForm({...form, title: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Communication Body</label>
                <textarea 
                  required
                  placeholder="Explain impact and status..."
                  rows={5}
                  className="w-full bg-gray-50 border border-gray-100 p-4 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all text-sm leading-relaxed"
                  value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">End Time (Local)</label>
                  <input 
                    type="datetime-local" 
                    className="w-full bg-gray-50 border border-gray-100 p-3 rounded-xl text-xs font-semibold outline-none focus:bg-white"
                    value={form.endTime}
                    onChange={e => setForm({...form, endTime: e.target.value})}
                  />
                </div>
              </div>

              {/* Save as Template Option (Only for new incidents) */}
              {!editingIncident && (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                      checked={form.saveAsTemplate}
                      onChange={e => setForm({...form, saveAsTemplate: e.target.checked})}
                    />
                    <span className="text-xs font-bold text-gray-600">Save as reusable template for this component type</span>
                  </label>
                  {form.saveAsTemplate && (
                    <input 
                      required
                      placeholder="Template internal name (e.g., DNS Failure)"
                      className="w-full bg-white border border-gray-200 p-2.5 rounded-lg text-xs outline-none focus:border-indigo-500"
                      value={form.templateName}
                      onChange={e => setForm({...form, templateName: e.target.value})}
                    />
                  )}
                </div>
              )}
            </div>

            <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 transition-all flex items-center justify-center gap-3 mt-4">
              {editingIncident ? 'Update Record' : 'Publish to Status Page'}
            </button>
          </form>
        </div>

        {/* Past History List */}
        <div className="space-y-4">
          <h3 className="font-bold text-xs uppercase text-gray-400 tracking-widest px-1">Incident History (Resolved)</h3>
          {pastIncidents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pastIncidents.slice(0, 10).map(inc => {
                const comp = state.components.find(c => c.id === inc.componentId);
                return (
                  <div key={inc.id} className="p-5 bg-white border border-gray-100 rounded-2xl shadow-sm group hover:border-indigo-200 transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[9px] font-bold text-gray-400 uppercase">{new Date(inc.startTime).toLocaleDateString()}</span>
                      <button 
                        onClick={() => handleEdit(inc)} 
                        className="text-[10px] font-bold text-indigo-600 hover:underline"
                      >
                        RE-OPEN / EDIT
                      </button>
                    </div>
                    <h4 className="text-sm font-bold text-gray-800 line-clamp-1 mb-1">{inc.title}</h4>
                    <p className="text-[10px] text-indigo-500 font-bold uppercase">{comp?.name || 'Unknown'}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center py-8 text-gray-300 text-xs italic">No resolved history yet.</p>
          )}
        </div>
      </div>
      
      <div className="space-y-6">
        <div className="bg-indigo-900 rounded-2xl p-6 text-white shadow-xl shadow-indigo-900/10">
          <h3 className="text-sm font-black uppercase tracking-widest mb-4 opacity-60">Operations Center</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold">Active Disruptions</span>
              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${activeIncidents.length > 0 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-white/10'}`}>
                {activeIncidents.length}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold">Audited Events</span>
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-white/10">
                {state.auditLogs.length}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-bold text-xs uppercase text-gray-400 tracking-widest px-1">Monitoring: Current Issues</h3>
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
                <p className="text-[10px] text-gray-400 font-medium italic">Alerted {new Date(inc.startTime).toLocaleTimeString()}</p>
              </div>
            ))
          ) : (
            <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mx-auto mb-2 text-emerald-400 shadow-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
              </div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Systems Clear</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportingTab;
