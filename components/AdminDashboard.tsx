
import React, { useState, useEffect } from 'react';
import { useApp } from '../store.tsx';
import { Severity } from '../types.ts';
import { geminiService } from '../services/geminiService.ts';

interface AdminDashboardProps {
  onViewPublic?: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onViewPublic }) => {
  const { 
    state, 
    addRegion, updateRegion, removeRegion,
    addService, updateService, removeService,
    addComponent, updateComponent, removeComponent,
    reportIncident, resolveIncident, createAdmin, deleteAdmin, logout, fetchAdminData
  } = useApp();

  const [activeTab, setActiveTab] = useState<'reporting' | 'configuration' | 'team' | 'audit'>('reporting');
  const [activeForm, setActiveForm] = useState<'region' | 'service' | 'component' | 'user' | null>(null);
  
  // Forms State
  const [regionForm, setRegionForm] = useState({ id: '', name: '' });
  const [serviceForm, setServiceForm] = useState({ id: '', regionId: '', name: '', description: '' });
  const [compForm, setCompForm] = useState({ id: '', serviceId: '', name: '', description: '' });
  const [incidentForm, setIncidentForm] = useState({ componentId: '', title: '', severity: Severity.DEGRADED, internalDesc: '' });
  const [userForm, setUserForm] = useState({ username: '', password: '' });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);

  // Auto-refresh admin data when switching to team or audit tabs
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

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentForm.componentId) {
      alert("Please select an impacted component.");
      return;
    }
    setIsProcessing(true);
    try {
      await reportIncident({ 
        componentId: incidentForm.componentId,
        title: incidentForm.title,
        severity: incidentForm.severity,
        internalDesc: incidentForm.internalDesc
      });
      setIncidentForm({ componentId: '', title: '', severity: Severity.DEGRADED, internalDesc: '' });
    } catch (error) {
      console.error("Failed to report incident:", error);
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
    if (type.includes('RESOLVE')) return 'text-emerald-600 bg-emerald-50';
    return 'text-gray-600 bg-gray-50';
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Infrastructure Manager</h1>
          <p className="text-sm text-gray-500">Workspace: {state.currentUser || 'Administrator'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <nav className="flex bg-gray-100 p-1 rounded-lg overflow-x-auto">
            {[
              { id: 'reporting', label: 'Incidents' },
              { id: 'configuration', label: 'Infra' },
              { id: 'team', label: 'Team' },
              { id: 'audit', label: 'Audit' }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          
          <div className="h-6 w-px bg-gray-200 hidden md:block"></div>

          <div className="flex gap-2">
            <button 
              onClick={onViewPublic}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
              View Live
            </button>
            <button onClick={logout} className="px-3 py-1.5 text-sm font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors">Logout</button>
          </div>
        </div>
      </div>

      {activeTab === 'reporting' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800">
                  Post Status Update
                </h2>
                <button 
                  type="button" 
                  onClick={handleAiSuggest}
                  disabled={isAiSuggesting || !incidentForm.internalDesc}
                  className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-all border border-indigo-100"
                >
                  {isAiSuggesting ? (
                    <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                  ) : 'AI Refine'}
                </button>
              </div>

              <form onSubmit={handleReport} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-widest">Impacted Component</label>
                    <select 
                      required 
                      className="w-full border-gray-200 border p-3 rounded-xl text-sm bg-gray-50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none" 
                      value={incidentForm.componentId} 
                      onChange={e => setIncidentForm(prev => ({...prev, componentId: e.target.value}))}
                    >
                      <option value="">Select component...</option>
                      {state.regions.map(region => {
                        const regionServices = state.services.filter(s => s.regionId === region.id);
                        if (regionServices.length === 0) return null;
                        
                        return regionServices.map(service => {
                          const components = state.components.filter(c => c.serviceId === service.id);
                          if (components.length === 0) return null;
                          
                          return (
                            <optgroup 
                              key={`opt-${region.id}-${service.id}`} 
                              label={`${region.name} › ${service.name}`}
                            >
                              {components.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </optgroup>
                          );
                        });
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-widest">Severity</label>
                    <select 
                      className="w-full border-gray-200 border p-3 rounded-xl text-sm bg-gray-50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none" 
                      value={incidentForm.severity} 
                      onChange={e => setIncidentForm({...incidentForm, severity: e.target.value as Severity})}
                    >
                      <option value={Severity.DEGRADED}>🟡 Degradation</option>
                      <option value={Severity.OUTAGE}>🔴 Outage</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-widest">Headline</label>
                  <input required placeholder="Incident Title" className="w-full border-gray-200 border p-3 rounded-xl text-sm font-medium bg-gray-50 focus:border-indigo-500 outline-none" value={incidentForm.title} onChange={e => setIncidentForm({...incidentForm, title: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-widest">Description</label>
                  <textarea required placeholder="Details..." rows={4} className="w-full border-gray-200 border p-3 rounded-xl text-sm bg-gray-50 focus:border-indigo-500 outline-none" value={incidentForm.internalDesc} onChange={e => setIncidentForm({...incidentForm, internalDesc: e.target.value})} />
                </div>
                <button disabled={isProcessing} className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg disabled:bg-gray-400 transition-all">
                  {isProcessing ? 'Updating...' : 'Broadcast Update'}
                </button>
              </form>
            </section>
          </div>
          <aside>
             <div className="bg-white p-6 rounded-xl border border-gray-200">
               <h3 className="font-bold text-sm mb-4">Active Incidents</h3>
               <div className="space-y-2">
                 {state.incidents.filter(i => !i.endTime).map(inc => (
                   <div key={inc.id} className="p-3 bg-gray-50 rounded-lg border border-transparent flex justify-between items-center">
                     <span className="text-xs font-bold truncate pr-2">{inc.title}</span>
                     <button onClick={() => resolveIncident(inc.id)} className="text-[10px] font-bold text-emerald-600 hover:underline">Resolve</button>
                   </div>
                 ))}
                 {state.incidents.filter(i => !i.endTime).length === 0 && <p className="text-xs text-gray-400 italic">No active incidents</p>}
               </div>
             </div>
          </aside>
        </div>
      )}

      {activeTab === 'configuration' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
          <div className="lg:col-span-2 space-y-6">
            {state.regions.map(region => (
              <div key={region.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                  <h3 className="font-bold text-gray-800">{region.name}</h3>
                  <button onClick={() => removeRegion(region.id)} className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Delete Region</button>
                </div>
                <div className="p-6 space-y-4">
                  {state.services.filter(s => s.regionId === region.id).map(service => (
                    <div key={service.id} className="border border-gray-50 rounded-xl p-4 bg-gray-50/30">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-bold text-gray-900 text-sm">{service.name}</h4>
                        </div>
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
                  <button onClick={() => { setActiveForm('service'); setServiceForm(p => ({...p, regionId: region.id})); }} className="w-full py-3 border-2 border-dashed border-gray-100 rounded-xl text-xs font-bold text-gray-400 hover:text-indigo-600 transition-all">+ New Service</button>
                </div>
              </div>
            ))}
            <button onClick={() => setActiveForm('region')} className="w-full py-6 border-2 border-dashed border-indigo-100 rounded-2xl text-sm font-bold text-indigo-400 hover:bg-indigo-50/50">+ New Infrastructure Region</button>
          </div>
          <aside>
             {activeForm === 'region' && (
                <div className="bg-white p-6 rounded-2xl border-2 border-indigo-500 shadow-xl">
                  <h3 className="font-bold mb-4">New Region</h3>
                  <input className="w-full border p-3 rounded-xl text-sm mb-4 outline-none focus:border-indigo-500" value={regionForm.name} onChange={e => setRegionForm({...regionForm, name: e.target.value})} placeholder="Region Name" />
                  <button onClick={() => { addRegion(regionForm.name); setActiveForm(null); resetFormsState(); }} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold">Save</button>
                </div>
             )}
             {activeForm === 'service' && (
                <div className="bg-white p-6 rounded-2xl border-2 border-indigo-500 shadow-xl">
                  <h3 className="font-bold mb-4">New Service</h3>
                  <input className="w-full border p-3 rounded-xl text-sm mb-4 outline-none focus:border-indigo-500" value={serviceForm.name} onChange={e => setServiceForm({...serviceForm, name: e.target.value})} placeholder="Service Name" />
                  <button onClick={() => { addService(serviceForm.regionId, serviceForm.name, ''); setActiveForm(null); resetFormsState(); }} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold">Save</button>
                </div>
             )}
             {activeForm === 'component' && (
                <div className="bg-white p-6 rounded-2xl border-2 border-indigo-500 shadow-xl">
                  <h3 className="font-bold mb-4">New Component</h3>
                  <input className="w-full border p-3 rounded-xl text-sm mb-4 outline-none focus:border-indigo-500" value={compForm.name} onChange={e => setCompForm({...compForm, name: e.target.value})} placeholder="Component Name" />
                  <button onClick={() => { addComponent(compForm.serviceId, compForm.name, ''); setActiveForm(null); resetFormsState(); }} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold">Save</button>
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
                    <th className="px-6 py-4 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Joined</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {state.users.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-800">{user.username}</td>
                      <td className="px-6 py-4"><span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-full">ADMIN</span></td>
                      <td className="px-6 py-4 text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-right">
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
              <p className="text-xs text-gray-500 mb-6">Create a new administrative account for infrastructure management.</p>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Username</label>
                  <input required className="w-full border p-3 rounded-xl text-sm focus:border-indigo-500 outline-none" value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} placeholder="e.g. ssmith" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Password</label>
                  <input required type="password" className="w-full border p-3 rounded-xl text-sm focus:border-indigo-500 outline-none" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} placeholder="••••••••" />
                </div>
                <button disabled={isProcessing} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-600/20">
                  {isProcessing ? 'Creating...' : 'Create Account'}
                </button>
              </form>
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
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 font-bold text-gray-400 uppercase text-[9px] tracking-[0.2em]">Timestamp</th>
                <th className="px-6 py-3 font-bold text-gray-400 uppercase text-[9px] tracking-[0.2em]">Operator</th>
                <th className="px-6 py-3 font-bold text-gray-400 uppercase text-[9px] tracking-[0.2em]">Action</th>
                <th className="px-6 py-3 font-bold text-gray-400 uppercase text-[9px] tracking-[0.2em]">Target</th>
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
                      <span className="text-[9px] text-gray-400 uppercase tracking-widest">{log.targetType}</span>
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
      )}
    </div>
  );
};

export default AdminDashboard;
