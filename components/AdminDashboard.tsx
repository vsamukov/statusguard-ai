
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../store.tsx';
import { Severity, Incident, Template, Subscription, NotificationSettings } from '../types.ts';
import { geminiService } from '../services/geminiService.ts';
import { api } from '../services/api.ts';

interface AdminDashboardProps {
  onViewPublic?: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onViewPublic }) => {
  const { 
    state, 
    addRegion, removeRegion,
    addService, removeService,
    addComponent, removeComponent,
    addTemplate, updateTemplate, removeTemplate,
    addSubscriber, updateSubscriber, removeSubscriber, saveNotificationSettings,
    reportIncident, updateIncident, resolveIncident, createAdmin, deleteAdmin, logout, fetchAdminData
  } = useApp();

  const [activeTab, setActiveTab] = useState<'reporting' | 'configuration' | 'templates' | 'subscriptions' | 'team' | 'audit'>('reporting');
  const [activeForm, setActiveForm] = useState<'region' | 'service' | 'component' | 'template' | 'user' | 'subscriber' | null>(null);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editingSubscriber, setEditingSubscriber] = useState<Subscription | null>(null);
  
  // Subscribers Paginated State
  const [subscribers, setSubscribers] = useState<Subscription[]>([]);
  const [subsTotal, setSubsTotal] = useState(0);
  const [subsPage, setSubsPage] = useState(1);
  const [subsLimit] = useState(20);
  const [subsSearch, setSubsSearch] = useState('');
  const [isSubsLoading, setIsSubsLoading] = useState(false);

  const [selRegionId, setSelRegionId] = useState('');
  const [selServiceId, setSelServiceId] = useState('');
  const [incidentForm, setIncidentForm] = useState({ 
    id: '', 
    componentId: '', 
    title: '', 
    severity: Severity.DEGRADED, 
    internalDesc: '',
    startTime: '',
    endTime: ''
  });

  const [notifySettings, setNotifySettings] = useState<NotificationSettings>({
    incidentNewTemplate: '',
    incidentResolvedTemplate: ''
  });

  useEffect(() => {
    if (state.notificationSettings) {
      setNotifySettings(state.notificationSettings);
    }
  }, [state.notificationSettings]);

  const filteredServices = useMemo(() => state.services.filter(s => s.regionId === selRegionId), [state.services, selRegionId]);
  const filteredComponents = useMemo(() => state.components.filter(c => c.serviceId === selServiceId), [state.components, selServiceId]);
  
  const componentTemplates = useMemo(() => {
    const selectedComp = state.components.find(c => c.id === incidentForm.componentId);
    if (!selectedComp) return [];
    return state.templates.filter(t => t.componentName === selectedComp.name);
  }, [state.templates, incidentForm.componentId, state.components]);

  const uniqueComponentNames = useMemo(() => {
    const names = new Set(state.components.map(c => c.name));
    return Array.from(names).sort();
  }, [state.components]);

  const recentlyResolvedIncidents = useMemo(() => {
    return state.incidents
      .filter(i => !!i.endTime)
      .sort((a, b) => new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime())
      .slice(0, 5);
  }, [state.incidents]);

  const [regionForm, setRegionForm] = useState({ name: '' });
  const [serviceForm, setServiceForm] = useState({ regionId: '', name: '', description: '' });
  const [compForm, setCompForm] = useState({ serviceId: '', name: '', description: '' });
  const [templateForm, setTemplateForm] = useState({ componentName: '', name: '', title: '', description: '' });
  const [userForm, setUserForm] = useState({ username: '', password: '' });
  const [subscriberEmail, setSubscriberEmail] = useState('');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);

  const formatInTz = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
      const adjustedDate = new Date(utc + (state.timezoneOffset * 60000));
      return adjustedDate.toLocaleString(undefined, { 
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
      });
    } catch (e) {
      return dateStr;
    }
  };

  const toInputFormat = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const adjusted = new Date(utc + (state.timezoneOffset * 60000));
    const year = adjusted.getFullYear();
    const month = String(adjusted.getMonth() + 1).padStart(2, '0');
    const day = String(adjusted.getDate()).padStart(2, '0');
    const hours = String(adjusted.getHours()).padStart(2, '0');
    const mins = String(adjusted.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${mins}`;
  };

  const fromInputToUTC = (inputVal: string) => {
    if (!inputVal) return null;
    const local = new Date(inputVal);
    const year = local.getFullYear();
    const month = local.getMonth();
    const day = local.getDate();
    const hours = local.getHours();
    const mins = local.getMinutes();
    const dateInSelectedTz = Date.UTC(year, month, day, hours, mins);
    const utcTime = dateInSelectedTz - (state.timezoneOffset * 60000);
    return new Date(utcTime).toISOString();
  };

  const loadSubscribers = useCallback(async () => {
    setIsSubsLoading(true);
    try {
      const res = await api.getSubscribers(subsPage, subsLimit, subsSearch);
      setSubscribers(res.data);
      setSubsTotal(res.total);
    } catch (err) {
      console.error("Failed to load subscribers", err);
    } finally {
      setIsSubsLoading(false);
    }
  }, [subsPage, subsLimit, subsSearch]);

  useEffect(() => {
    if (activeTab === 'team' || activeTab === 'audit') fetchAdminData();
    if (activeTab === 'subscriptions') {
      fetchAdminData();
      loadSubscribers();
    }
    setActiveForm(null);
    resetFormsState();
  }, [activeTab, subsPage, subsSearch, loadSubscribers]);

  const resetFormsState = () => {
    setRegionForm({ name: '' });
    setServiceForm({ regionId: '', name: '', description: '' });
    setCompForm({ serviceId: '', name: '', description: '' });
    setTemplateForm({ componentName: '', name: '', title: '', description: '' });
    setUserForm({ username: '', password: '' });
    setSubscriberEmail('');
    setSelRegionId('');
    setSelServiceId('');
    setEditingIncident(null);
    setEditingTemplate(null);
    setEditingSubscriber(null);
    setIncidentForm({ 
      id: '', 
      componentId: '', 
      title: '', 
      severity: Severity.DEGRADED, 
      internalDesc: '', 
      startTime: toInputFormat(new Date().toISOString()), 
      endTime: '' 
    });
  };

  const applyTemplate = (templateId: string) => {
    const template = state.templates.find(t => t.id === templateId);
    if (template) {
      setIncidentForm(prev => ({
        ...prev,
        title: template.title,
        internalDesc: template.description
      }));
    }
  };

  const handleEditIncident = (incident: Incident) => {
    setEditingIncident(incident);
    const component = state.components.find(c => c.id === incident.componentId);
    const service = state.services.find(s => s.id === component?.serviceId);
    const region = state.regions.find(r => r.id === service?.regionId);

    setSelRegionId(region?.id || '');
    setSelServiceId(service?.id || '');
    setIncidentForm({
      id: incident.id,
      componentId: incident.componentId,
      title: incident.title,
      severity: incident.severity,
      internalDesc: incident.description,
      startTime: toInputFormat(incident.startTime),
      endTime: incident.endTime ? toInputFormat(incident.endTime) : ''
    });
    setActiveTab('reporting');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentForm.componentId) return alert("Select component");
    setIsProcessing(true);
    try {
      const payload = {
        componentId: incidentForm.componentId,
        title: incidentForm.title,
        severity: incidentForm.severity,
        description: incidentForm.internalDesc,
        startTime: fromInputToUTC(incidentForm.startTime),
        endTime: incidentForm.endTime ? fromInputToUTC(incidentForm.endTime) : null
      };

      if (editingIncident) {
        await updateIncident(editingIncident.id, payload);
      } else {
        await reportIncident(payload);
      }
      resetFormsState();
    } catch (error: any) {
      alert("Failed to save incident: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveSubscriber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subscriberEmail) return;
    setIsProcessing(true);
    try {
      if (editingSubscriber) {
        await updateSubscriber(editingSubscriber.id, subscriberEmail);
      } else {
        await addSubscriber(subscriberEmail);
      }
      setActiveForm(null);
      resetFormsState();
      await loadSubscribers();
    } catch (err: any) {
      alert("Failed to save subscriber: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveNotifySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      await saveNotificationSettings(notifySettings);
      alert("Notification templates updated.");
    } catch (err: any) {
      alert("Failed to update settings: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateForm.componentName) return alert("Select component name");
    setIsProcessing(true);
    try {
      if (editingTemplate) {
        await updateTemplate(editingTemplate.id, templateForm);
      } else {
        await addTemplate(templateForm);
      }
      setActiveForm(null);
      resetFormsState();
    } catch (error: any) {
      alert("Failed to save template: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResolve = async (id: string) => {
    if (!confirm("Resolve this incident?")) return;
    setIsProcessing(true);
    try {
      await resolveIncident(id);
    } catch (error: any) {
      alert("Failed to resolve incident: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAiSuggest = async () => {
    if (!incidentForm.title || !incidentForm.internalDesc) return alert("Input title/notes");
    setIsAiSuggesting(true);
    try {
      const summary = await geminiService.generateIncidentSummary(incidentForm.title, incidentForm.internalDesc);
      setIncidentForm(prev => ({ ...prev, internalDesc: summary }));
    } catch (err: any) { 
      alert("AI Suggestion failed: " + err.message);
    } finally { 
      setIsAiSuggesting(false); 
    }
  };

  const handleDeleteSub = async (id: string) => {
    if (!confirm('Remove subscriber?')) return;
    try {
      await removeSubscriber(id);
      await loadSubscribers();
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  const getActionColor = (type: string | undefined | null) => {
    if (!type) return 'text-gray-600 bg-gray-50';
    const t = String(type).toUpperCase();
    if (t.startsWith('DELETE')) return 'text-red-600 bg-red-50';
    if (t.startsWith('CREATE')) return 'text-indigo-600 bg-indigo-50';
    if (t.includes('UPDATE')) return 'text-blue-600 bg-blue-50';
    if (t.includes('RESOLVE')) return 'text-emerald-600 bg-emerald-50';
    if (t.includes('TEMPLATE')) return 'text-purple-600 bg-purple-50';
    return 'text-gray-600 bg-gray-50';
  };

  const totalPages = Math.ceil(subsTotal / subsLimit);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Voximplant Manager</h1>
          <p className="text-sm text-gray-500">Workspace: {state.currentUser || 'Administrator'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <nav className="flex bg-gray-100 p-1 rounded-lg">
            {['reporting', 'configuration', 'templates', 'subscriptions', 'team', 'audit'].map(tab => (
              <button 
                key={tab} 
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === tab ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
          <div className="flex gap-2">
            <button onClick={onViewPublic} className="px-3 py-1.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg">View Live</button>
            <button onClick={logout} className="px-3 py-1.5 text-sm font-bold text-red-500 hover:bg-red-50 rounded-lg">Logout</button>
          </div>
        </div>
      </div>

      {activeTab === 'reporting' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-gray-800">{editingIncident ? 'Edit Incident' : 'Report Incident'}</h2>
                <div className="flex gap-2">
                   {editingIncident && <button onClick={resetFormsState} className="text-xs font-bold text-gray-400 hover:text-gray-600 uppercase">Cancel Edit</button>}
                   <button onClick={handleAiSuggest} disabled={isAiSuggesting} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded hover:bg-indigo-100 border border-indigo-100">AI Refine</button>
                </div>
              </div>

              <form onSubmit={handleSaveIncident} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Region</label>
                    <select className="w-full border p-2 rounded-lg text-sm bg-white outline-none" value={selRegionId} onChange={e => { setSelRegionId(e.target.value); setSelServiceId(''); }}>
                      <option value="">Select Region...</option>
                      {state.regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Service</label>
                    <select disabled={!selRegionId} className="w-full border p-2 rounded-lg text-sm bg-white disabled:bg-gray-100 outline-none" value={selServiceId} onChange={e => setSelServiceId(e.target.value)}>
                      <option value="">Select Service...</option>
                      {filteredServices.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Component</label>
                    <select disabled={!selServiceId} required className="w-full border p-2 rounded-lg text-sm bg-white disabled:bg-gray-100 outline-none" value={incidentForm.componentId} onChange={e => setIncidentForm({...incidentForm, componentId: e.target.value})}>
                      <option value="">Select Component...</option>
                      {filteredComponents.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                {componentTemplates.length > 0 && (
                   <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 flex items-center justify-between animate-in slide-in-from-top-1">
                     <div className="flex flex-col">
                       <span className="text-xs font-bold text-indigo-600 uppercase tracking-tighter">Common Templates</span>
                       <span className="text-[10px] text-indigo-400">Available globally for this component name</span>
                     </div>
                     <select 
                      className="text-xs border rounded bg-white px-2 py-1 outline-none font-medium" 
                      onChange={(e) => applyTemplate(e.target.value)}
                      defaultValue=""
                     >
                       <option value="" disabled>Apply a template...</option>
                       {componentTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                     </select>
                   </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Severity</label>
                      <select className="w-full border p-3 rounded-xl text-sm bg-white outline-none" value={incidentForm.severity} onChange={e => setIncidentForm({...incidentForm, severity: e.target.value as Severity})}>
                        <option value={Severity.DEGRADED}>🟡 Degraded</option>
                        <option value={Severity.OUTAGE}>🔴 Outage</option>
                      </select>
                   </div>
                   <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Start Time (UTC{state.timezoneOffset >= 0 ? '+' : ''}{state.timezoneOffset/60})</label>
                      <input type="datetime-local" required className="w-full border p-3 rounded-xl text-sm outline-none" value={incidentForm.startTime} onChange={e => setIncidentForm({...incidentForm, startTime: e.target.value})} />
                   </div>
                </div>

                <div className="animate-in slide-in-from-top-1">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">End Time (UTC{state.timezoneOffset >= 0 ? '+' : ''}{state.timezoneOffset/60})</label>
                  <input type="datetime-local" className="w-full border p-3 rounded-xl text-sm outline-none" value={incidentForm.endTime} onChange={e => setIncidentForm({...incidentForm, endTime: e.target.value})} />
                  <p className="text-[10px] text-gray-400 mt-1 italic">Leave empty to keep the incident active.</p>
                </div>

                <input required placeholder="Incident Title" className="w-full border p-3 rounded-xl text-sm font-medium outline-none focus:border-indigo-500" value={incidentForm.title} onChange={e => setIncidentForm({...incidentForm, title: e.target.value})} />
                <textarea required placeholder="Public description..." rows={4} className="w-full border p-3 rounded-xl text-sm outline-none focus:border-indigo-500" value={incidentForm.internalDesc} onChange={e => setIncidentForm({...incidentForm, internalDesc: e.target.value})} />
                
                <button disabled={isProcessing} className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg disabled:bg-gray-400 transition-all flex items-center justify-center gap-2">
                  {isProcessing && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                  {editingIncident ? 'Update Incident' : 'Broadcast Update'}
                </button>
              </form>
            </section>
          </div>

          <aside className="space-y-6">
             <div className="bg-white p-6 rounded-xl border border-gray-200 sticky top-8 shadow-sm">
               <h3 className="font-bold text-sm mb-4 border-b pb-2 flex items-center justify-between">
                 <span>Active Now</span>
                 <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
               </h3>
               <div className="space-y-3 mb-8">
                 {state.incidents.filter(i => !i.endTime).map(inc => (
                   <div key={inc.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100 group relative">
                     <p className="text-xs font-bold text-gray-800 line-clamp-1 mb-2">{inc.title}</p>
                     <div className="flex justify-between items-center">
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${inc.severity === Severity.OUTAGE ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'}`}>
                          {inc.severity}
                        </span>
                        <div className="flex gap-2">
                           <button onClick={() => handleEditIncident(inc)} className="text-[10px] font-bold text-indigo-600 hover:underline">Edit</button>
                           <button onClick={() => handleResolve(inc.id)} disabled={isProcessing} className="text-[10px] font-bold text-emerald-600 hover:underline disabled:opacity-50">
                             Resolve
                           </button>
                        </div>
                     </div>
                   </div>
                 ))}
                 {state.incidents.filter(i => !i.endTime).length === 0 && <p className="text-xs text-gray-400 italic text-center py-4">No active incidents</p>}
               </div>

               <h3 className="font-bold text-sm mb-4 border-b pb-2 flex items-center justify-between">
                 <span>Recently Resolved</span>
                 <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
               </h3>
               <div className="space-y-3">
                 {recentlyResolvedIncidents.map(inc => (
                   <div key={inc.id} className="p-4 bg-white border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors group relative">
                     <div className="flex flex-col gap-1 mb-2">
                        <p className="text-xs font-bold text-gray-700 line-clamp-1">{inc.title}</p>
                        <span className="text-[9px] text-gray-400 font-medium">Resolved: {formatInTz(inc.endTime)}</span>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${inc.severity === Severity.OUTAGE ? 'bg-gray-100 text-red-400' : 'bg-gray-100 text-yellow-500'}`}>
                          {inc.severity}
                        </span>
                        <button onClick={() => handleEditIncident(inc)} className="text-[10px] font-bold text-indigo-600 hover:underline opacity-0 group-hover:opacity-100 transition-opacity">Edit Record</button>
                     </div>
                   </div>
                 ))}
                 {recentlyResolvedIncidents.length === 0 && <p className="text-xs text-gray-400 italic text-center py-4">No recent history</p>}
               </div>
             </div>
          </aside>
        </div>
      )}

      {activeTab === 'subscriptions' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
          <div className="lg:col-span-2 space-y-6">
            {/* 1. NOTIFICATION TEMPLATES (Above) */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-6 border-b pb-2 uppercase text-xs tracking-widest">Notification Templates</h3>
              <form onSubmit={handleSaveNotifySettings} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">New Incident Notification</label>
                  <textarea 
                    className="w-full border p-4 rounded-xl text-sm font-mono bg-gray-50 outline-none focus:border-indigo-500 focus:bg-white transition-all" 
                    rows={4}
                    value={notifySettings.incidentNewTemplate}
                    onChange={e => setNotifySettings({...notifySettings, incidentNewTemplate: e.target.value})}
                  />
                  <p className="text-[10px] text-gray-400 mt-2">
                    Available: <code className="bg-gray-100 px-1 rounded">{"{region}"}</code>, <code className="bg-gray-100 px-1 rounded">{"{service}"}</code>, <code className="bg-gray-100 px-1 rounded">{"{component}"}</code>, <code className="bg-gray-100 px-1 rounded">{"{title}"}</code>, <code className="bg-gray-100 px-1 rounded">{"{severity}"}</code>
                  </p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Resolution Notification</label>
                  <textarea 
                    className="w-full border p-4 rounded-xl text-sm font-mono bg-gray-50 outline-none focus:border-indigo-500 focus:bg-white transition-all" 
                    rows={4}
                    value={notifySettings.incidentResolvedTemplate}
                    onChange={e => setNotifySettings({...notifySettings, incidentResolvedTemplate: e.target.value})}
                  />
                </div>
                <button type="submit" disabled={isProcessing} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                   Save Notification Settings
                </button>
              </form>
            </div>

            {/* 2. SUBSCRIBERS LIST (Below, Paginated + Searchable) */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-6 py-4 bg-gray-50 border-b flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex flex-col">
                  <h3 className="font-bold text-sm text-gray-700 uppercase tracking-tighter">Subscribers ({subsTotal})</h3>
                  <p className="text-[10px] text-gray-400">Manage your notification audience</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative w-full">
                    <input 
                      type="text" 
                      placeholder="Search email (* for wildcard)..." 
                      className="pl-8 pr-3 py-1.5 border rounded-lg text-xs w-full outline-none focus:border-indigo-500"
                      value={subsSearch}
                      onChange={(e) => { setSubsSearch(e.target.value); setSubsPage(1); }}
                    />
                    <svg className="w-3.5 h-3.5 absolute left-2.5 top-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                  </div>
                  <button 
                    onClick={() => { setActiveForm('subscriber'); setEditingSubscriber(null); setSubscriberEmail(''); }}
                    className="bg-indigo-600 text-white text-[10px] font-bold px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm whitespace-nowrap"
                  >
                    Add Manually
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto min-h-[300px] relative">
                {isSubsLoading && (
                  <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  </div>
                )}
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/50 text-gray-400 uppercase font-black text-[9px] tracking-widest border-b">
                    <tr>
                      <th className="px-6 py-3">Email Address</th>
                      <th className="px-6 py-3">Subscribed On</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {subscribers.map(sub => (
                      <tr key={sub.id} className="hover:bg-gray-50/50 group">
                        <td className="px-6 py-4 font-bold text-gray-800">{sub.email}</td>
                        <td className="px-6 py-4 text-gray-400">{formatInTz(sub.createdAt)}</td>
                        <td className="px-6 py-4 text-right space-x-3">
                          <button onClick={() => { setEditingSubscriber(sub); setSubscriberEmail(sub.email); setActiveForm('subscriber'); }} className="text-indigo-600 font-bold uppercase hover:underline">Edit</button>
                          <button onClick={() => handleDeleteSub(sub.id)} className="text-red-500 font-bold uppercase hover:underline">Delete</button>
                        </td>
                      </tr>
                    ))}
                    {!isSubsLoading && subscribers.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-6 py-12 text-center text-gray-400 italic">No subscribers found matching your criteria.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="px-6 py-4 bg-gray-50 border-t flex justify-between items-center">
                  <span className="text-[10px] text-gray-400 font-bold">Page {subsPage} of {totalPages}</span>
                  <div className="flex gap-1">
                    <button 
                      disabled={subsPage === 1}
                      onClick={() => setSubsPage(p => Math.max(1, p - 1))}
                      className="px-3 py-1 border rounded bg-white text-[10px] font-bold disabled:opacity-50 hover:bg-gray-50 transition-colors"
                    >
                      Previous
                    </button>
                    <button 
                      disabled={subsPage === totalPages}
                      onClick={() => setSubsPage(p => Math.min(totalPages, p + 1))}
                      className="px-3 py-1 border rounded bg-white text-[10px] font-bold disabled:opacity-50 hover:bg-gray-50 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="sticky top-8 space-y-4">
            {activeForm === 'subscriber' && (
              <div className="bg-white p-6 rounded-2xl border-2 border-indigo-500 shadow-xl animate-in zoom-in-95">
                <h3 className="font-bold mb-4 flex justify-between items-center">
                  <span>{editingSubscriber ? 'Edit Subscriber' : 'Add Subscriber'}</span>
                  <button onClick={() => setActiveForm(null)} className="text-gray-300">×</button>
                </h3>
                <form onSubmit={handleSaveSubscriber} className="space-y-4">
                  <input 
                    required 
                    type="email" 
                    className="w-full border p-3 rounded-xl text-sm outline-none focus:border-indigo-500" 
                    placeholder="email@example.com" 
                    value={subscriberEmail}
                    onChange={e => setSubscriberEmail(e.target.value)}
                  />
                  <button type="submit" disabled={isProcessing} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-md hover:bg-indigo-700">
                    {editingSubscriber ? 'Update' : 'Add Subscriber'}
                  </button>
                </form>
              </div>
            )}
            {!activeForm && (
              <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100">
                <h4 className="font-bold text-indigo-700 text-xs mb-2">About Subscriptions</h4>
                <p className="text-[11px] text-indigo-600 leading-relaxed">
                  Search supports partial matches. Use <code className="bg-indigo-100 px-1">*</code> as a wildcard (e.g., <code className="bg-indigo-100 px-1">joe*</code> or <code className="bg-indigo-100 px-1">*@gmail.com</code>).
                </p>
                <div className="mt-4 pt-4 border-t border-indigo-100/50">
                  <p className="text-[11px] text-indigo-600 italic">
                    Note: Email broadcasting uses Mailchimp. Ensure your API settings in <code className="bg-indigo-100 px-1">.env</code> are correct.
                  </p>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* Existing Tabs (templates, audit, configuration, team) */}
      {activeTab === 'templates' && (
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
           <div className="lg:col-span-2 space-y-6">
             <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
               <table className="w-full text-left text-sm">
                 <thead className="bg-gray-50 border-b border-gray-200">
                   <tr>
                     <th className="px-6 py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Template Name</th>
                     <th className="px-6 py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Target Component Name</th>
                     <th className="px-6 py-4"></th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                    {state.templates.map(t => (
                      <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-bold text-gray-800">{t.name}</td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                            {t.componentName}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right pr-6 space-x-3">
                          <button onClick={() => { setEditingTemplate(t); setTemplateForm({ ...t }); setActiveForm('template'); }} className="text-indigo-600 hover:underline text-xs font-bold uppercase">Edit</button>
                          <button onClick={() => { if(confirm('Delete template?')) removeTemplate(t.id); }} className="text-red-500 hover:underline text-xs font-bold uppercase">Delete</button>
                        </td>
                      </tr>
                    ))}
                    {state.templates.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-6 py-12 text-center text-gray-400 italic">No templates defined. Templates are now associated globally by component name.</td>
                      </tr>
                    )}
                 </tbody>
               </table>
             </div>
             <button onClick={() => { setActiveForm('template'); setEditingTemplate(null); setTemplateForm({ componentName: '', name: '', title: '', description: '' }); }} className="w-full py-6 border-2 border-dashed border-indigo-100 rounded-2xl text-sm font-bold text-indigo-400 hover:bg-indigo-50 transition-all">+ New Global Template</button>
           </div>
           <aside className="sticky top-8">
             {activeForm === 'template' && (
                <div className="bg-white p-6 rounded-2xl border-2 border-indigo-500 shadow-xl animate-in zoom-in-95">
                  <h3 className="font-bold mb-4 flex items-center justify-between">
                    <span>{editingTemplate ? 'Modify Template' : 'Add Template'}</span>
                    <button onClick={() => setActiveForm(null)} className="text-gray-300 hover:text-gray-500">×</button>
                  </h3>
                  <form onSubmit={handleSaveTemplate} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Target Component Name</label>
                      <select required className="w-full border p-2 rounded-lg text-sm bg-white outline-none focus:border-indigo-500" value={templateForm.componentName} onChange={e => setTemplateForm({...templateForm, componentName: e.target.value})}>
                        <option value="">Select component name...</option>
                        {uniqueComponentNames.map(name => <option key={name} value={name}>{name}</option>)}
                      </select>
                      <p className="text-[9px] text-gray-400 mt-1 italic">Templates will appear for ALL components with this exact name.</p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Internal Name</label>
                      <input required className="w-full border p-2 rounded-lg text-sm outline-none focus:border-indigo-500" placeholder="e.g., DNS Resolution Timeout" value={templateForm.name} onChange={e => setTemplateForm({...templateForm, name: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Public Title</label>
                      <input required className="w-full border p-2 rounded-lg text-sm outline-none font-bold focus:border-indigo-500" placeholder="e.g., Service Connectivity Issue" value={templateForm.title} onChange={e => setTemplateForm({...templateForm, title: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Default Description</label>
                      <textarea required className="w-full border p-2 rounded-lg text-sm outline-none focus:border-indigo-500" rows={5} placeholder="Describe the typical impact and resolution steps..." value={templateForm.description} onChange={e => setTemplateForm({...templateForm, description: e.target.value})} />
                    </div>
                    <div className="flex gap-2 pt-2">
                       <button type="submit" disabled={isProcessing} className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-md">
                         {isProcessing ? 'Saving...' : editingTemplate ? 'Update' : 'Create'}
                       </button>
                    </div>
                  </form>
                </div>
             )}
             {!activeForm && (
               <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
                 <p className="text-xs text-indigo-700 leading-relaxed font-medium">Templates are now name-based. This means a single template can cover "Load Balancer" components across all your clusters and regions automatically.</p>
               </div>
             )}
           </aside>
         </div>
      )}

      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm animate-in fade-in duration-500">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
             <h3 className="font-bold text-gray-800">System Activity Audit</h3>
             <button onClick={fetchAdminData} className="text-xs font-bold text-indigo-600 hover:underline">Refresh Logs</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[700px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 font-bold text-gray-400 uppercase text-[9px] tracking-[0.2em]">Timestamp</th>
                  <th className="px-6 py-3 font-bold text-gray-400 uppercase text-[9px] tracking-[0.2em]">Operator</th>
                  <th className="px-6 py-3 font-bold text-gray-400 uppercase text-[9px] tracking-[0.2em]">Action</th>
                  <th className="px-6 py-3 font-bold text-gray-400 uppercase text-[9px] tracking-[0.2em]">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {state.auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-gray-400 text-[11px] font-medium">{formatInTz(log.createdAt)}</td>
                    <td className="px-6 py-4"><span className="font-bold text-gray-800">{log.username}</span></td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${getActionColor(log.actionType)}`}>
                        {log.actionType ? log.actionType.replace('_', ' ') : 'UNKNOWN'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-700 text-xs">{log.targetName || '-'}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {activeTab === 'configuration' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
          <div className="lg:col-span-2 space-y-6">
            {state.regions.map(region => (
              <div key={region.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                  <h3 className="font-bold text-gray-800">{region.name}</h3>
                  <button onClick={() => { if(confirm(`Delete ${region.name}?`)) removeRegion(region.id); }} className="text-[10px] font-bold text-red-400 hover:text-red-600 uppercase tracking-widest transition-colors">Delete Region</button>
                </div>
                <div className="p-6 space-y-4">
                  {state.services.filter(s => s.regionId === region.id).map(service => (
                    <div key={service.id} className="border border-gray-50 rounded-xl p-4 bg-gray-50/30">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-bold text-gray-900 text-sm">{service.name}</h4>
                        <button onClick={() => { if(confirm(`Delete ${service.name}?`)) removeService(service.id); }} className="text-[10px] text-red-500 hover:underline font-bold uppercase">Remove Service</button>
                      </div>
                      <div className="pl-4 border-l-2 border-indigo-100 space-y-2">
                        {state.components.filter(c => c.serviceId === service.id).map(comp => (
                          <div key={comp.id} className="flex justify-between items-center text-xs bg-white p-3 rounded-lg shadow-sm border border-gray-100 group">
                            <span className="font-medium text-gray-700">{comp.name}</span>
                            <button onClick={() => { if(confirm(`Delete ${comp.name}?`)) removeComponent(comp.id); }} className="text-red-500 hover:underline font-bold opacity-0 group-hover:opacity-100 transition-opacity">Delete</button>
                          </div>
                        ))}
                        <button onClick={() => { setActiveForm('component'); setCompForm(p => ({...p, serviceId: service.id, name: ''})); }} className="text-[10px] text-indigo-600 font-bold uppercase mt-2 hover:text-indigo-800 transition-colors">+ Add Component</button>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => { setActiveForm('service'); setServiceForm(p => ({...p, regionId: region.id, name: ''})); }} className="w-full py-3 border-2 border-dashed border-gray-100 rounded-xl text-xs font-bold text-gray-400 hover:text-indigo-600 transition-all">+ Add Service</button>
                </div>
              </div>
            ))}
            <button onClick={() => { setActiveForm('region'); setRegionForm({ name: '' }); }} className="w-full py-6 border-2 border-dashed border-indigo-100 rounded-2xl text-sm font-bold text-indigo-400 hover:bg-indigo-50 transition-all">+ New Region</button>
          </div>
          <aside className="sticky top-8 space-y-4">
             {activeForm === 'region' && (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  setIsProcessing(true);
                  try {
                    await addRegion(regionForm.name);
                    setActiveForm(null);
                    resetFormsState();
                  } catch(err) { alert("Failed to add region"); }
                  finally { setIsProcessing(false); }
                }} className="bg-white p-6 rounded-2xl border-2 border-indigo-500 shadow-xl animate-in zoom-in-95">
                  <h3 className="font-bold mb-4">New Region</h3>
                  <input required className="w-full border p-3 rounded-xl text-sm mb-4 outline-none focus:border-indigo-500" value={regionForm.name} onChange={e => setRegionForm({...regionForm, name: e.target.value})} placeholder="Region Name" />
                  <div className="flex gap-2">
                    <button type="submit" disabled={isProcessing} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold flex justify-center items-center">
                      {isProcessing ? 'Saving...' : 'Save Region'}
                    </button>
                    <button type="button" onClick={() => setActiveForm(null)} className="px-3 text-xs font-bold text-gray-400">Cancel</button>
                  </div>
                </form>
             )}
             {activeForm === 'service' && (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  setIsProcessing(true);
                  try {
                    await addService(serviceForm.regionId, serviceForm.name, '');
                    setActiveForm(null);
                    resetFormsState();
                  } catch(err) { alert("Failed to add service"); }
                  finally { setIsProcessing(false); }
                }} className="bg-white p-6 rounded-2xl border-2 border-indigo-500 shadow-xl animate-in zoom-in-95">
                  <h3 className="font-bold mb-4">New Service</h3>
                  <input required className="w-full border p-3 rounded-xl text-sm mb-4 outline-none focus:border-indigo-500" value={serviceForm.name} onChange={e => setServiceForm({...serviceForm, name: e.target.value})} placeholder="Service Name" />
                  <div className="flex gap-2">
                    <button type="submit" disabled={isProcessing} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold flex justify-center items-center">
                      {isProcessing ? 'Saving...' : 'Save Service'}
                    </button>
                    <button type="button" onClick={() => setActiveForm(null)} className="px-3 text-xs font-bold text-gray-400">Cancel</button>
                  </div>
                </form>
             )}
             {activeForm === 'component' && (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  setIsProcessing(true);
                  try {
                    await addComponent(compForm.serviceId, compForm.name, '');
                    setActiveForm(null);
                    resetFormsState();
                  } catch(err) { alert("Failed to add component"); }
                  finally { setIsProcessing(false); }
                }} className="bg-white p-6 rounded-2xl border-2 border-indigo-500 shadow-xl animate-in zoom-in-95">
                  <h3 className="font-bold mb-4">New Component</h3>
                  <input required className="w-full border p-3 rounded-xl text-sm mb-4 outline-none focus:border-indigo-500" value={compForm.name} onChange={e => setCompForm({...compForm, name: e.target.value})} placeholder="Component Name" />
                  <div className="flex gap-2">
                    <button type="submit" disabled={isProcessing} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold flex justify-center items-center">
                      {isProcessing ? 'Saving...' : 'Save Component'}
                    </button>
                    <button type="button" onClick={() => setActiveForm(null)} className="px-3 text-xs font-bold text-gray-400">Cancel</button>
                  </div>
                </form>
             )}
          </aside>
        </div>
      )}

      {activeTab === 'team' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Username</th>
                    <th className="px-6 py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Role</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {state.users.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-800">{user.username}</td>
                      <td className="px-6 py-4"><span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-full">ADMIN</span></td>
                      <td className="px-6 py-4 text-right pr-6">
                        {user.username !== state.currentUser && (
                          <button onClick={() => { if(confirm(`Remove ${user.username}?`)) deleteAdmin(user.id); }} className="text-red-500 hover:text-red-700 font-bold text-xs uppercase tracking-tighter">Remove</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <aside>
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
              <h3 className="font-bold text-lg mb-4">Provision Admin</h3>
              <form onSubmit={async (e) => {
                e.preventDefault();
                setIsProcessing(true);
                try {
                  await createAdmin(userForm);
                  setUserForm({ username: '', password: '' });
                } catch(err) { alert("Failed to create admin"); }
                finally { setIsProcessing(false); }
              }} className="space-y-4">
                <input required className="w-full border p-3 rounded-xl text-sm outline-none" value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} placeholder="Username" />
                <input required type="password" className="w-full border p-3 rounded-xl text-sm outline-none" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} placeholder="Password" />
                <button type="submit" disabled={isProcessing} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold">
                  {isProcessing ? 'Creating...' : 'Create Account'}
                </button>
              </form>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
