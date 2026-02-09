
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
  const pastIncidents = useMemo(() => 
    state.incidents
      .filter(i => !!i.endTime)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, 10), 
    [state.incidents]
  );

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
        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm relative">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{editingIncident ? 'Modify Incident' : 'Post Status Update'}</h2>
              <p className="text-sm text-gray-400 mt-1">Updates are published to the public dashboard instantly.</p>
            </div>
            <div className="flex gap-2">
              {editingIncident && (
                <button onClick={handleCancelEdit} className="text-xs font-bold text-gray-400 hover:text-gray-600 uppercase px-3 py-1.5">
                  Cancel
                </button>
              )}
              <button 
                type="button"
                onClick={handleAiSuggest} 
                disabled={isAiSuggesting} 
                className="text-xs font-bold px-4 py-2 rounded-xl transition-all border bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100 disabled:opacity-50"
              >
                {isAiSuggesting ? 'AI Thinking...' : 'Gemini AI Summary'}
              </button>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Location</label>
                <select 
                  required
                  className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none text-sm"
                  value={form.regionId}
                  onChange={e => setForm({...form, regionId: e.target.value, serviceId: '', componentId: ''})}
                >
                  <option value="">Region...</option>
                  {state.regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Service</label>
                <select 
                  required
                  disabled={!form.regionId}
                  className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl text-sm disabled:opacity-50"
                  value={form.serviceId}
                  onChange={e => setForm({...form, serviceId: e.target.value, componentId: ''})}
                >
                  <option value="">Service...</option>
                  {filteredServices.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Component</label>
                <select 
                  required
                  disabled={!form.serviceId}
                  className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl text-sm disabled:opacity-50"
                  value={form.componentId}
                  onChange={e => setForm({...form, componentId: e.target.value})}
                >
                  <option value="">Component...</option>
                  {filteredComponents.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            {availableTemplates.length > 0 && (
              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-center justify-between gap-3">
                <span className="text-[10px] font-black text-indigo-600 uppercase">Apply Template:</span>
                <select 
                  className="text-xs border border-indigo-200 rounded-lg px-3 py-1 bg-white outline-none"
                  onChange={e => applyTemplate(e.target.value)}
                  defaultValue=""
                >
                  <option value="">Select template...</option>
                  {availableTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Urgency</label>
                  <select 
                    className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl text-sm font-bold"
                    value={form.severity}
                    onChange={e => setForm({...form, severity: e.target.value as Severity})}
                  >
                    <option value={Severity.DEGRADED}>🟡 Service Degradation</option>
                    <option value={Severity.OUTAGE}>🔴 Major Outage</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Headline</label>
                  <input 
                    required
                    placeholder="Public headline"
                    className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl text-sm font-bold"
                    value={form.title}
                    onChange={e => setForm({...form, title: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Update Message</label>
                <textarea 
                  required
                  placeholder="Describe the issue..."
                  rows={4}
                  className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl text-sm leading-relaxed"
                  value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Start Time</label>
                  <input 
                    type="datetime-local" 
                    required
                    className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl text-xs"
                    value={form.startTime}
                    onChange={e => setForm({...form, startTime: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">End Time (optional)</label>
                  <input 
                    type="datetime-local" 
                    className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl text-xs"
                    value={form.endTime}
                    onChange={e => setForm({...form, endTime: e.target.value})}
                  />
                </div>
              </div>
            </div>

            {!editingIncident && (
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox"
                    id="saveAsTemplate"
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    checked={form.saveAsTemplate}
                    onChange={e => setForm({...form, saveAsTemplate: e.target.checked})}
                  />
                  <label htmlFor="saveAsTemplate" className="text-sm font-semibold text-gray-700 cursor-pointer">
                    Save this as a response template
                  </label>
                </div>
                
                {form.saveAsTemplate && (
                  <div className="space-y-2 animate-in slide-in-from-top-1 duration-200">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Template Name</label>
                    <input 
                      required
                      placeholder="e.g. Core API Load Balancing Issue"
                      className="w-full bg-indigo-50 border border-indigo-100 p-3 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                      value={form.templateName}
                      onChange={e => setForm({...form, templateName: e.target.value})}
                    />
                  </div>
                )}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isProcessing}
              className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 shadow-lg disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
            >
              {isProcessing && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
              {editingIncident ? 'Save Changes' : 'Publish Update'}
            </button>
          </form>
        </div>

        <div className="space-y-3">
          <h3 className="font-bold text-xs uppercase text-gray-400 tracking-widest px-1">Past Records</h3>
          <div className="grid grid-cols-1 gap-3">
            {pastIncidents.map(inc => (
              <div key={inc.id} className="bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-between hover:border-indigo-200 transition-all">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[9px] font-bold text-gray-400 uppercase">{new Date(inc.startTime).toLocaleDateString()}</span>
                    <h4 className="text-sm font-bold text-gray-800">{inc.title}</h4>
                  </div>
                </div>
                <button 
                  onClick={() => handleEdit(inc)} 
                  className="text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-50"
                >
                  EDIT
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="space-y-6">
        <div className="bg-indigo-900 rounded-2xl p-6 text-white">
          <h3 className="text-xs font-black uppercase tracking-widest mb-4 opacity-50">Operational Summary</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center text-xs">
              <span className="text-indigo-200">Active Outages</span>
              <span className={`font-black ${activeIncidents.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{activeIncidents.length}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-indigo-200">90-Day Records</span>
              <span className="font-black text-white">{state.incidents.length}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-bold text-xs uppercase text-gray-400 tracking-widest px-1">Current Incidents</h3>
          {activeIncidents.length > 0 ? (
            activeIncidents.map(inc => (
              <div key={inc.id} className="p-5 bg-white border border-red-100 rounded-2xl shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                    {inc.severity}
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => resolveIncident(inc.id)} className="text-[10px] font-bold text-emerald-600">RESOLVE</button>
                  </div>
                </div>
                <h4 className="text-sm font-bold text-gray-800 mb-2">{inc.title}</h4>
                <button onClick={() => handleEdit(inc)} className="text-[10px] font-bold text-indigo-600">Edit Details</button>
              </div>
            ))
          ) : (
            <div className="p-8 text-center bg-emerald-50 rounded-2xl border border-dashed border-emerald-100">
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Normal Operations</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportingTab;
