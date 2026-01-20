import React, { useState, useEffect } from 'react';
import { useApp } from '../store.tsx';
import { Severity } from '../types.ts';
import { geminiService } from '../services/geminiService.ts';

const AdminDashboard: React.FC = () => {
  const { 
    state, 
    addRegion, updateRegion, removeRegion,
    addService, updateService, removeService,
    addComponent, updateComponent, removeComponent,
    reportIncident, resolveIncident, logout 
  } = useApp();

  const [activeTab, setActiveTab] = useState<'reporting' | 'configuration'>('reporting');
  const [activeForm, setActiveForm] = useState<'region' | 'service' | 'component' | null>(null);
  
  // Forms State
  const [regionForm, setRegionForm] = useState({ id: '', name: '' });
  const [serviceForm, setServiceForm] = useState({ id: '', regionId: '', name: '', description: '' });
  const [compForm, setCompForm] = useState({ id: '', serviceId: '', name: '', description: '' });
  const [incidentForm, setIncidentForm] = useState({ componentId: '', title: '', severity: Severity.DEGRADED, internalDesc: '' });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);

  // Clear sub-forms when switching primary tabs
  useEffect(() => {
    setActiveForm(null);
    resetFormsState();
  }, [activeTab]);

  const resetFormsState = () => {
    setRegionForm({ id: '', name: '' });
    setServiceForm({ id: '', regionId: '', name: '', description: '' });
    setCompForm({ id: '', serviceId: '', name: '', description: '' });
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
      alert("Error reporting incident. Check console for details.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Infrastructure Manager</h1>
          <p className="text-sm text-gray-500">Control center for service status and regional health.</p>
        </div>
        <div className="flex gap-4">
          <nav className="flex bg-gray-100 p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab('reporting')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'reporting' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Reporting
            </button>
            <button 
              onClick={() => setActiveTab('configuration')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'configuration' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Configuration
            </button>
          </nav>
          <button onClick={logout} className="px-4 py-1.5 text-sm font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors">Logout</button>
        </div>
      </div>

      {activeTab === 'reporting' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800">
                  <span className="p-2 bg-red-50 rounded-lg">
                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                  </span>
                  Post New Update
                </h2>
                <button 
                  type="button" 
                  onClick={handleAiSuggest}
                  disabled={isAiSuggesting || !incidentForm.internalDesc}
                  className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-all border border-indigo-100"
                >
                  {isAiSuggesting ? (
                    <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L14.85 8.65L22 9.82L17 14.85L18.18 22L12 18.65L5.82 22L7 14.85L2 9.82L9.15 8.65L12 2Z"/></svg>
                  )}
                  AI Refine Summary
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
                      {state.services.map(service => {
                        const region = state.regions.find(r => r.id === service.regionId);
                        const components = state.components.filter(c => c.serviceId === service.id);
                        if (components.length === 0) return null;
                        return (
                          <optgroup key={`opt-${service.id}`} label={`${region?.name || 'Global'} > ${service.name}`}>
                            {components.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-widest">Severity Level</label>
                    <select 
                      className="w-full border-gray-200 border p-3 rounded-xl text-sm bg-gray-50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none" 
                      value={incidentForm.severity} 
                      onChange={e => setIncidentForm({...incidentForm, severity: e.target.value as Severity})}
                    >
                      <option value={Severity.DEGRADED}>🟡 Degradation (Partial Loss)</option>
                      <option value={Severity.OUTAGE}>🔴 Outage (Total Loss)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-widest">Headline</label>
                  <input 
                    required 
                    placeholder="e.g. Connectivity issues in North America API Gateway" 
                    className="w-full border-gray-200 border p-3 rounded-xl text-sm font-medium bg-gray-50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none" 
                    value={incidentForm.title} 
                    onChange={e => setIncidentForm({...incidentForm, title: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-widest">Incident Notes</label>
                  <textarea 
                    required 
                    placeholder="Provide details about the issue and current status. Click 'AI Refine' to polish." 
                    rows={4} 
                    className="w-full border-gray-200 border p-3 rounded-xl text-sm bg-gray-50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none" 
                    value={incidentForm.internalDesc} 
                    onChange={e => setIncidentForm({...incidentForm, internalDesc: e.target.value})} 
                  />
                </div>
                <button 
                  disabled={isProcessing} 
                  className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 disabled:bg-gray-400 transition-all flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"></path></svg>
                      Broadcast Status Update
                    </>
                  )}
                </button>
              </form>
            </section>
            
            <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Active Incidents
              </h2>
              <div className="space-y-3">
                {state.incidents.filter(i => !i.endTime).map(inc => (
                  <div key={inc.id} className="group flex justify-between items-center p-4 bg-gray-50 hover:bg-white border border-transparent hover:border-indigo-100 rounded-xl transition-all">
                    <div>
                      <p className="font-bold text-sm text-gray-800">{inc.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${inc.severity === Severity.OUTAGE ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'}`}>
                          {inc.severity}
                        </span>
                        <span className="text-[10px] text-gray-400">Since {new Date(inc.startTime).toLocaleString()}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => resolveIncident(inc.id)} 
                      className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 shadow-sm transition-all"
                    >
                      Resolve
                    </button>
                  </div>
                ))}
                {state.incidents.filter(i => !i.endTime).length === 0 && (
                  <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-xl">
                    <p className="text-sm text-gray-400 italic">No active incidents detected. Platform is healthy.</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
             <div className="bg-indigo-600 p-6 rounded-2xl text-white shadow-xl shadow-indigo-600/20">
               <h3 className="font-bold text-lg mb-4">Platform Summary</h3>
               <div className="space-y-4">
                 <div className="flex justify-between items-center text-sm">
                   <span className="opacity-80">Operational Regions</span>
                   <span className="font-bold text-xl">{state.regions.length}</span>
                 </div>
                 <div className="flex justify-between items-center text-sm">
                   <span className="opacity-80">Tracked Services</span>
                   <span className="font-bold text-xl">{state.services.length}</span>
                 </div>
                 <div className="flex justify-between items-center text-sm">
                   <span className="opacity-80">Monitored Nodes</span>
                   <span className="font-bold text-xl">{state.components.length}</span>
                 </div>
               </div>
             </div>
          </aside>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
          <div className="lg:col-span-2 space-y-6">
            {state.regions.map(region => (
              <div key={region.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 002 2h1.5a3.5 3.5 0 013.5 3.5V15a2 2 0 002-2 2 2 0 012-2h1.065"></path></svg>
                    {region.name}
                  </h3>
                  <div className="flex gap-4">
                    <button onClick={() => { setRegionForm(region); setActiveForm('region'); window.scrollTo({top: 0, behavior: 'smooth'}); }} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-widest">Edit</button>
                    <button onClick={() => removeRegion(region.id)} className="text-[10px] font-bold text-red-500 hover:text-red-700 uppercase tracking-widest">Delete</button>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  {state.services.filter(s => s.regionId === region.id).map(service => (
                    <div key={service.id} className="border border-gray-50 rounded-xl p-4 bg-gray-50/30">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-bold text-gray-900 text-sm">{service.name}</h4>
                          <p className="text-[10px] text-gray-400 mt-0.5">{service.description || 'No description provided'}</p>
                        </div>
                        <div className="flex gap-3">
                          <button onClick={() => { setServiceForm(service); setActiveForm('service'); window.scrollTo({top: 0, behavior: 'smooth'}); }} className="text-[10px] text-indigo-600 hover:underline font-bold uppercase">Edit</button>
                          <button onClick={() => removeService(service.id)} className="text-[10px] text-red-500 hover:underline font-bold uppercase">Delete</button>
                        </div>
                      </div>
                      <div className="pl-4 border-l-2 border-indigo-100 space-y-2">
                        {state.components.filter(c => c.serviceId === service.id).map(comp => (
                          <div key={comp.id} className="flex justify-between items-center text-xs bg-white p-3 rounded-lg shadow-sm border border-gray-100 group">
                            <span className="font-medium text-gray-700">{comp.name}</span>
                            <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setCompForm(comp); setActiveForm('component'); window.scrollTo({top: 0, behavior: 'smooth'}); }} className="text-indigo-600 hover:underline font-bold">Edit</button>
                              <button onClick={() => removeComponent(comp.id)} className="text-red-500 hover:underline font-bold">Delete</button>
                            </div>
                          </div>
                        ))}
                        <button 
                          onClick={() => { resetFormsState(); setCompForm(prev => ({...prev, serviceId: service.id})); setActiveForm('component'); window.scrollTo({top: 0, behavior: 'smooth'}); }} 
                          className="flex items-center gap-1.5 text-[10px] text-indigo-600 font-bold uppercase mt-3 hover:text-indigo-800 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                          Add Component
                        </button>
                      </div>
                    </div>
                  ))}
                  <button 
                    onClick={() => { resetFormsState(); setServiceForm(prev => ({...prev, regionId: region.id})); setActiveForm('service'); window.scrollTo({top: 0, behavior: 'smooth'}); }} 
                    className="w-full py-3 border-2 border-dashed border-gray-100 rounded-xl text-xs font-bold text-gray-400 hover:border-indigo-200 hover:bg-indigo-50/30 hover:text-indigo-600 transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                    New Service in {region.name}
                  </button>
                </div>
              </div>
            ))}
            <button 
              onClick={() => { resetFormsState(); setActiveForm('region'); window.scrollTo({top: 0, behavior: 'smooth'}); }} 
              className="w-full py-6 border-2 border-dashed border-indigo-100 rounded-2xl text-sm font-bold text-indigo-400 hover:bg-indigo-50/50 hover:border-indigo-300 transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Establish New Infrastructure Region
            </button>
          </div>

          <aside className="space-y-6">
            <div className="sticky top-24">
              {activeForm === 'region' && (
                <div className="bg-white p-6 rounded-2xl border-2 border-indigo-500 shadow-2xl animate-in zoom-in-95 duration-200">
                  <h3 className="font-bold text-lg mb-4">{regionForm.id ? 'Edit Region' : 'New Region'}</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Region Name</label>
                      <input 
                        placeholder="e.g. EU-West-1" 
                        className="w-full border-gray-200 border p-3 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all" 
                        value={regionForm.name} 
                        onChange={e => setRegionForm({...regionForm, name: e.target.value})} 
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-6">
                    <button 
                      onClick={async () => { 
                        if (!regionForm.name) return;
                        regionForm.id ? await updateRegion(regionForm.id, regionForm.name) : await addRegion(regionForm.name); 
                        setActiveForm(null); resetFormsState();
                      }} 
                      className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-600/20"
                    >
                      Save
                    </button>
                    <button onClick={() => setActiveForm(null)} className="flex-1 border-gray-200 border py-3 rounded-xl text-gray-500 font-bold">Cancel</button>
                  </div>
                </div>
              )}

              {activeForm === 'service' && (
                <div className="bg-white p-6 rounded-2xl border-2 border-indigo-500 shadow-2xl animate-in zoom-in-95 duration-200">
                  <h3 className="font-bold text-lg mb-4">{serviceForm.id ? 'Edit Service' : 'New Service'}</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Service Name</label>
                      <input 
                        placeholder="e.g. Microservice A" 
                        className="w-full border-gray-200 border p-3 rounded-xl text-sm outline-none focus:border-indigo-500" 
                        value={serviceForm.name} 
                        onChange={e => setServiceForm({...serviceForm, name: e.target.value})} 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Description</label>
                      <textarea 
                        placeholder="Purpose of this service" 
                        className="w-full border-gray-200 border p-3 rounded-xl text-sm outline-none focus:border-indigo-500" 
                        rows={3}
                        value={serviceForm.description} 
                        onChange={e => setServiceForm(prev => ({...prev, description: e.target.value}))} 
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-6">
                    <button 
                      onClick={async () => { 
                        if (!serviceForm.name) return;
                        serviceForm.id ? await updateService(serviceForm.id, serviceForm.name, serviceForm.description) : await addService(serviceForm.regionId, serviceForm.name, serviceForm.description); 
                        setActiveForm(null); resetFormsState();
                      }} 
                      className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold"
                    >
                      Save
                    </button>
                    <button onClick={() => setActiveForm(null)} className="flex-1 border-gray-200 border py-3 rounded-xl text-gray-500 font-bold">Cancel</button>
                  </div>
                </div>
              )}

              {activeForm === 'component' && (
                <div className="bg-white p-6 rounded-2xl border-2 border-indigo-500 shadow-2xl animate-in zoom-in-95 duration-200">
                  <h3 className="font-bold text-lg mb-4">{compForm.id ? 'Edit Component' : 'New Component'}</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Component Name</label>
                      <input 
                        placeholder="e.g. Database Master" 
                        className="w-full border-gray-200 border p-3 rounded-xl text-sm outline-none focus:border-indigo-500" 
                        value={compForm.name} 
                        onChange={e => setCompForm({...compForm, name: e.target.value})} 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Description</label>
                      <textarea 
                        placeholder="Specific role of this component" 
                        className="w-full border-gray-200 border p-3 rounded-xl text-sm outline-none focus:border-indigo-500" 
                        rows={3}
                        value={compForm.description} 
                        onChange={e => setCompForm({...compForm, description: e.target.value})} 
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-6">
                    <button 
                      onClick={async () => { 
                        if (!compForm.name) return;
                        compForm.id ? await updateComponent(compForm.id, compForm.name, compForm.description) : await addComponent(compForm.serviceId, compForm.name, compForm.description); 
                        setActiveForm(null); resetFormsState();
                      }} 
                      className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold"
                    >
                      Save
                    </button>
                    <button onClick={() => setActiveForm(null)} className="flex-1 border-gray-200 border py-3 rounded-xl text-gray-500 font-bold">Cancel</button>
                  </div>
                </div>
              )}
              
              {!activeForm && (
                <div className="p-8 bg-gray-50 border border-gray-100 rounded-2xl text-center shadow-inner">
                  <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center mx-auto mb-4 text-indigo-300">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                  </div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-widest leading-relaxed">
                    Select an infrastructure element<br/>to begin modification.
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;