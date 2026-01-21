
import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../store.tsx';
import { Severity, Region, Service, Component, Incident } from '../types.ts';
import { geminiService } from '../services/geminiService.ts';

interface AdminDashboardProps {
  onViewPublic?: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onViewPublic }) => {
  const { 
    state, 
    addRegion, removeRegion,
    addService, removeService,
    addComponent, removeComponent,
    reportIncident, updateIncident, resolveIncident, createAdmin, deleteAdmin, logout, fetchAdminData
  } = useApp();

  const [activeTab, setActiveTab] = useState<'reporting' | 'configuration' | 'team' | 'audit'>('reporting');
  const [activeForm, setActiveForm] = useState<'region' | 'service' | 'component' | 'user' | null>(null);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);
  
  // Incident Reporting Drill-down state
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

  // Filtering for incident form
  const filteredServices = useMemo(() => state.services.filter(s => s.regionId === selRegionId), [state.services, selRegionId]);
  const filteredComponents = useMemo(() => state.components.filter(c => c.serviceId === selServiceId), [state.components, selServiceId]);

  // Forms State
  const [regionForm, setRegionForm] = useState({ id: '', name: '' });
  const [serviceForm, setServiceForm] = useState({ id: '', regionId: '', name: '', description: '' });
  const [compForm, setCompForm] = useState({ id: '', serviceId: '', name: '', description: '' });
  const [userForm, setUserForm] = useState({ username: '', password: '' });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);

  useEffect(() => {
    if (activeTab === 'team' || activeTab === 'audit') {
      fetchAdminData();
    }
    setActiveForm(null);
    resetFormsState();
  }, [activeTab]);

  const resetFormsState = () => {
    setRegionForm({ id: '', name: '' });
    setServiceForm({ id: '', regionId: '', name: '', description: '' });
    setCompForm({ id: '', serviceId: '', name: '', description: '' });
    setUserForm({ username: '', password: '' });
    setSelRegionId('');
    setSelServiceId('');
    setEditingIncident(null);
    setIncidentForm({ id: '', componentId: '', title: '', severity: Severity.DEGRADED, internalDesc: '', startTime: '', endTime: '' });
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
      startTime: new Date(incident.startTime).toISOString().slice(0, 16),
      endTime: incident.endTime ? new Date(incident.endTime).toISOString().slice(0, 16) : ''
    });
    setActiveTab('reporting');
  };

  const handleAiSuggest = async () => {
    if (!incidentForm.title || !incidentForm.internalDesc) {
      alert("Please provide a title and some internal notes first.");
      return;
    }
    setIsAiSuggesting(true);
    try {
      const summary = await geminiService.generateIncidentSummary(incidentForm.title, incidentForm.internalDesc);
      setIncidentForm(prev => ({ ...prev, internalDesc: summary }));
    } catch (err) {
      console.error("Gemini suggestion failed:", err);
    } finally {
      setIsAiSuggesting(false);
    }
  };

  const handleSaveIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentForm.componentId) {
      alert("Please select an impacted component.");
      return;
    }
    setIsProcessing(true);
    try {
      const payload = {
        componentId: incidentForm.componentId,
        title: incidentForm.title,
        severity: incidentForm.severity,
        description: incidentForm.internalDesc,
        startTime: new Date(incidentForm.startTime || Date.now()).toISOString(),
        endTime: incidentForm.endTime ? new Date(incidentForm.endTime).toISOString() : null
      };

      if (editingIncident) {
        await updateIncident(editingIncident.id, payload);
      } else {
        await reportIncident(payload);
      }
      resetFormsState();
    } catch (error) {
      console.error("Failed to save incident:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.username || !userForm.password) return;
    setIsProcessing(true);
    try {
      await createAdmin(userForm);
      setActiveForm(null);
      resetFormsState();
    } catch (err) {
      alert("Failed to create user. It may already exist.");
    } finally {
      setIsProcessing(false);
    }
  };

  const getActionColor = (type: string) => {
    if (type.startsWith('DELETE')) return 'text-red-600 bg-red-50';
    if (type.startsWith('CREATE')) return 'text-indigo-600 bg-indigo-50';
    if (type.includes('UPDATE')) return 'text-blue-600 bg-blue-50';
    if (type.includes('RESOLVE')) return 'text-emerald-600 bg-emerald-50';
    return 'text-gray-600 bg-gray-50';
  };

  const formatAuditDetails = (details: any) => {
    if (!details) return null;
    // Handle the update incident diff
    if (details.updated && details.previous) {
      const changes = [];
      if (details.previous.componentId !== details.updated.componentId) changes.push('Reassigned Component');
      if (details.previous.severity !== details.updated.severity) changes.push(`Severity: ${details.previous.severity} → ${details.updated.severity}`);
      if (details.previous.startTime !== details.updated.startTime) changes.push('Modified Start Date');
      if (details.previous.endTime !== details.updated.endTime) changes.push('Modified End Date');
      return changes.length > 0 ? changes.join(' | ') : 'Internal description updated';
    }
    // Default JSON display for simple objects
    return typeof details === 'object' ? JSON.stringify(details) : details;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Voximplant Manager</h1>
          <p className="text-sm text-gray-500">Workspace: {state.currentUser || 'Administrator'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <nav className="flex bg-gray-100 p-1 rounded-lg">
            {['reporting', 'configuration', 'team', 'audit'].map(tab => (
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
            <button onClick={onViewPublic} className="px-3 py-1.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100">View Live</button>
            <button onClick={logout} className="px-3 py-1.5 text-sm font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors">Logout</button>
          </div>
        </div>
      </div>

      {activeTab === 'reporting' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-gray-800">
                  {editingIncident ? 'Edit Incident Record' : 'Post Status Update'}
                </h2>
                <div className="flex gap-2">
                  {editingIncident && (
                    <button 
                      onClick={resetFormsState}
                      className="px-3 py-1.5 bg-gray-50 text-gray-500 text-xs font-bold rounded-lg hover:bg-gray-100 border border-gray-200"
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button 
                    type="button" 
                    onClick={handleAiSuggest}
                    disabled={isAiSuggesting || !incidentForm.internalDesc}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-all border border-indigo-100"
                  >
                    {isAiSuggesting ? 'Thinking...' : 'AI Refine'}
                  </button>
                </div>
              </div>

              <form onSubmit={handleSaveIncident} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Region</label>
                    <select 
                      className="w-full border-gray-200 border p-2 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500/20" 
                      value={selRegionId} 
                      onChange={e => { setSelRegionId(e.target.value); setSelServiceId(''); }}
                    >
                      <option value="">Select Region...</option>
                      {state.regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Service</label>
                    <select 
                      disabled={!selRegionId}
                      className="w-full border-gray-200 border p-2 rounded-lg text-sm bg-white disabled:bg-gray-100 outline-none focus:ring-2 focus:ring-indigo-500/20" 
                      value={selServiceId} 
                      onChange={e => setSelServiceId(e.target.value)}
                    >
                      <option value="">Select Service...</option>
                      {filteredServices.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Component</label>
                    <select 
                      disabled={!selServiceId}
                      required
                      className="w-full border-gray-200 border p-2 rounded-lg text-sm bg-white disabled:bg-gray-100 outline-none focus:ring-2 focus:ring-indigo-500/20" 
                      value={incidentForm.componentId} 
                      onChange={e => setIncidentForm(prev => ({...prev, componentId: e.target.value}))}
                    >
                      <option value="">Impacted node...</option>
                      {filteredComponents.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Severity</label>
                    <select 
                      className="w-full border-gray-200 border p-3 rounded-xl text-sm bg-white" 
                      value={incidentForm.severity} 
                      onChange={e => setIncidentForm({...incidentForm, severity: e.target.value as Severity})}
                    >
                      <option value={Severity.DEGRADED}>🟡 Degraded Performance</option>
                      <option value={Severity.OUTAGE}>🔴 Major Outage</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Start Time</label>
                    <input 
                      type="datetime-local" 
                      required
                      className="w-full border-gray-200 border p-3 rounded-xl text-sm" 
                      value={incidentForm.startTime} 
                      onChange={e => setIncidentForm({...incidentForm, startTime: e.target.value})} 
                    />
                  </div>
                </div>

                {editingIncident && (
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">End Time (Optional)</label>
                    <input 
                      type="datetime-local" 
                      className="w-full border-gray-200 border p-3 rounded-xl text-sm" 
                      value={incidentForm.endTime} 
                      onChange={e => setIncidentForm({...incidentForm, endTime: e.target.value})} 
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Public Headline</label>
                  <input required placeholder="Headline..." className="w-full border-gray-200 border p-3 rounded-xl text-sm font-medium" value={incidentForm.title} onChange={e => setIncidentForm({...incidentForm, title: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Public Update / Notes</label>
                  <textarea required placeholder="Details..." rows={4} className="w-full border-gray-200 border p-3 rounded-xl text-sm" value={incidentForm.internalDesc} onChange={e => setIncidentForm({...incidentForm, internalDesc: e.target.value})} />
                </div>
                <button disabled={isProcessing} className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg disabled:bg-gray-400 transition-all">
                  {isProcessing ? 'Saving...' : (editingIncident ? 'Update Incident Record' : 'Broadcast Status Update')}
                </button>
              </form>
            </section>
          </div>
          <aside className="space-y-6">
             <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm sticky top-8">
               <h3 className="font-bold text-sm mb-4 border-b pb-2 flex items-center justify-between">
                 <span className="flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                   Active Now
                 </span>
               </h3>
               <div className="space-y-3">
                 {state.incidents.filter(i => !i.endTime).map(inc => (
                   <div key={inc.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100 group relative">
                     <p className="text-xs font-bold text-gray-800 line-clamp-1 mb-2">{inc.title}</p>
                     <div className="flex justify-between items-center">
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${inc.severity === Severity.OUTAGE ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'}`}>
                          {inc.severity}
                        </span>
                        <div className="flex gap-2">
                          <button onClick={() => handleEditIncident(inc)} className="text-[10px] font-bold text-indigo-600 hover:underline">Edit</button>
                          <button onClick={() => resolveIncident(inc.id)} className="text-[10px] font-bold text-emerald-600 hover:underline">Resolve</button>
                        </div>
                     </div>
                   </div>
                 ))}
                 {state.incidents.filter(i => !i.endTime).length === 0 && <p className="text-xs text-gray-400 italic text-center py-4">No active incidents</p>}
               </div>
             </div>

             <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
               <h3 className="font-bold text-sm mb-4 border-b pb-2">Recently Resolved</h3>
               <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                 {state.incidents.filter(i => i.endTime).slice(0, 10).map(inc => (
                    <div key={inc.id} className="p-3 bg-white hover:bg-gray-50 rounded-lg border border-gray-100 flex justify-between items-center group transition-colors">
                      <div className="truncate pr-2">
                        <p className="text-[10px] font-bold text-gray-700 truncate">{inc.title}</p>
                        <p className="text-[9px] text-gray-400">{new Date(inc.startTime).toLocaleDateString()}</p>
                      </div>
                      <button onClick={() => handleEditIncident(inc)} className="text-[9px] font-bold text-gray-400 hover:text-indigo-600">EDIT</button>
                    </div>
                 ))}
               </div>
             </div>
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
                  <th className="px-6 py-3 font-bold text-gray-400 uppercase text-[9px] tracking-[0.2em]">Target & Changes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {state.auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-gray-400 text-[11px] font-medium">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="px-6 py-4"><span className="font-bold text-gray-800">{log.username}</span></td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${getActionColor(log.actionType)}`}>
                        {log.actionType.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-700 text-xs">{log.targetName}</span>
                        <span className="text-[10px] text-gray-400 font-medium italic mt-0.5">
                          {formatAuditDetails(log.details)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {state.auditLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic">No activity recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Configuration, Team tabs remain logically similar to original but with refresh fixes */}
      {activeTab === 'configuration' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
          <div className="lg:col-span-2 space-y-6">
            {state.regions.map(region => (
              <div key={region.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                  <h3 className="font-bold text-gray-800">{region.name}</h3>
                  <button onClick={() => removeRegion(region.id)} className="text-[10px] font-bold text-red-400 hover:text-red-600 uppercase tracking-widest transition-colors">Delete Region</button>
                </div>
                <div className="p-6 space-y-4">
                  {state.services.filter(s => s.regionId === region.id).map(service => (
                    <div key={service.id} className="border border-gray-50 rounded-xl p-4 bg-gray-50/30">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-bold text-gray-900 text-sm">{service.name}</h4>
                        <button onClick={() => removeService(service.id)} className="text-[10px] text-red-500 hover:underline font-bold uppercase">Remove Service</button>
                      </div>
                      <div className="pl-4 border-l-2 border-indigo-100 space-y-2">
                        {state.components.filter(c => c.serviceId === service.id).map(comp => (
                          <div key={comp.id} className="flex justify-between items-center text-xs bg-white p-3 rounded-lg shadow-sm border border-gray-100 group">
                            <span className="font-medium text-gray-700">{comp.name}</span>
                            <button onClick={() => removeComponent(comp.id)} className="text-red-500 hover:underline font-bold opacity-0 group-hover:opacity-100 transition-opacity">Delete</button>
                          </div>
                        ))}
                        <button onClick={() => { setActiveForm('component'); setCompForm(p => ({...p, serviceId: service.id})); }} className="text-[10px] text-indigo-600 font-bold uppercase mt-2">+ Add Component</button>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => { setActiveForm('service'); setServiceForm(p => ({...p, regionId: region.id})); }} className="w-full py-3 border-2 border-dashed border-gray-100 rounded-xl text-xs font-bold text-gray-400 hover:text-indigo-600 transition-all">+ Add Service</button>
                </div>
              </div>
            ))}
            <button onClick={() => setActiveForm('region')} className="w-full py-6 border-2 border-dashed border-indigo-100 rounded-2xl text-sm font-bold text-indigo-400 hover:bg-indigo-50">+ New Region</button>
          </div>
          <aside className="sticky top-8 space-y-4">
               {activeForm === 'region' && (
                  <div className="bg-white p-6 rounded-2xl border-2 border-indigo-500 shadow-xl animate-in zoom-in-95">
                    <h3 className="font-bold mb-4">New Region</h3>
                    <input className="w-full border p-3 rounded-xl text-sm mb-4 outline-none" value={regionForm.name} onChange={e => setRegionForm({...regionForm, name: e.target.value})} placeholder="Region Name" />
                    <button onClick={() => { addRegion(regionForm.name); setActiveForm(null); }} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold">Save</button>
                  </div>
               )}
               {activeForm === 'service' && (
                  <div className="bg-white p-6 rounded-2xl border-2 border-indigo-500 shadow-xl animate-in zoom-in-95">
                    <h3 className="font-bold mb-4">New Service</h3>
                    <input className="w-full border p-3 rounded-xl text-sm mb-4" value={serviceForm.name} onChange={e => setServiceForm({...serviceForm, name: e.target.value})} placeholder="Service Name" />
                    <button onClick={() => { addService(serviceForm.regionId, serviceForm.name, ''); setActiveForm(null); }} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold">Save</button>
                  </div>
               )}
               {activeForm === 'component' && (
                  <div className="bg-white p-6 rounded-2xl border-2 border-indigo-500 shadow-xl animate-in zoom-in-95">
                    <h3 className="font-bold mb-4">New Component</h3>
                    <input className="w-full border p-3 rounded-xl text-sm mb-4" value={compForm.name} onChange={e => setCompForm({...compForm, name: e.target.value})} placeholder="Component Name" />
                    <button onClick={() => { addComponent(compForm.serviceId, compForm.name, ''); setActiveForm(null); }} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold">Save</button>
                  </div>
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
                          <button onClick={() => deleteAdmin(user.id)} className="text-red-500 hover:text-red-700 font-bold text-xs uppercase tracking-tighter">Remove</button>
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
              <form onSubmit={handleCreateUser} className="space-y-4">
                <input required className="w-full border p-3 rounded-xl text-sm outline-none" value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} placeholder="Username" />
                <input required type="password" className="w-full border p-3 rounded-xl text-sm outline-none" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} placeholder="Password" />
                <button disabled={isProcessing} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold">Create Account</button>
              </form>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
