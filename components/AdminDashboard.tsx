
import React, { useState } from 'react';
import { useApp } from '../store';
import { Severity, Region, Service, Component } from '../types';

const AdminDashboard: React.FC = () => {
  const { 
    state, 
    addRegion, updateRegion, removeRegion,
    addService, updateService, removeService,
    addComponent, updateComponent, removeComponent,
    reportIncident, resolveIncident, logout 
  } = useApp();

  const [activeTab, setActiveTab] = useState<'reporting' | 'configuration'>('reporting');
  
  // Forms State
  const [regionForm, setRegionForm] = useState({ id: '', name: '' });
  const [serviceForm, setServiceForm] = useState({ id: '', regionId: '', name: '', description: '' });
  const [compForm, setCompForm] = useState({ id: '', serviceId: '', name: '', description: '' });
  const [incidentForm, setIncidentForm] = useState({ componentId: '', title: '', severity: Severity.DEGRADED, internalDesc: '' });
  const [isProcessing, setIsProcessing] = useState(false);

  const resetForms = () => {
    setRegionForm({ id: '', name: '' });
    setServiceForm({ id: '', regionId: '', name: '', description: '' });
    setCompForm({ id: '', serviceId: '', name: '', description: '' });
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
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
        <h1 className="text-2xl font-bold text-gray-900">Infrastructure Manager</h1>
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
          <button onClick={logout} className="text-sm font-medium text-red-500 hover:underline">Logout</button>
        </div>
      </div>

      {activeTab === 'reporting' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                Post New Update
              </h2>
              <form onSubmit={handleReport} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Impacted Component</label>
                    <select required className="w-full border p-2 rounded text-sm" value={incidentForm.componentId} onChange={e => setIncidentForm({...incidentForm, componentId: e.target.value})}>
                      <option value="">Select...</option>
                      {state.regions.map(r => (
                        <optgroup key={r.id} label={r.name}>
                          {state.services.filter(s => s.regionId === r.id).map(s => (
                            <optgroup key={s.id} label={`  - ${s.name}`}>
                              {state.components.filter(c => c.serviceId === s.id).map(c => (
                                <option key={c.id} value={c.id}>&nbsp;&nbsp;&nbsp;&nbsp;{c.name}</option>
                              ))}
                            </optgroup>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Severity Level</label>
                    <select className="w-full border p-2 rounded text-sm" value={incidentForm.severity} onChange={e => setIncidentForm({...incidentForm, severity: e.target.value as Severity})}>
                      <option value={Severity.DEGRADED}>Degradation (Slow/Partial)</option>
                      <option value={Severity.OUTAGE}>Outage (Total Loss)</option>
                    </select>
                  </div>
                </div>
                <input required placeholder="Headline (e.g. Connectivity issues in US-East)" className="w-full border p-2 rounded text-sm font-medium" value={incidentForm.title} onChange={e => setIncidentForm({...incidentForm, title: e.target.value})} />
                <textarea required placeholder="Public description of the incident and resolution steps" rows={3} className="w-full border p-2 rounded text-sm" value={incidentForm.internalDesc} onChange={e => setIncidentForm({...incidentForm, internalDesc: e.target.value})} />
                <button disabled={isProcessing} className="w-full py-2 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700 shadow-sm disabled:bg-gray-400 transition-colors">
                  {isProcessing ? 'Processing...' : 'Broadcast Update'}
                </button>
              </form>
            </section>
            
            <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h2 className="text-lg font-bold mb-4">Active Incidents</h2>
              <div className="space-y-3">
                {state.incidents.filter(i => !i.endTime).map(inc => (
                  <div key={inc.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-bold text-sm">{inc.title}</p>
                      <p className="text-[10px] text-gray-500">{new Date(inc.startTime).toLocaleString()}</p>
                    </div>
                    <button onClick={() => resolveIncident(inc.id)} className="px-3 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded">Mark Resolved</button>
                  </div>
                ))}
                {state.incidents.filter(i => !i.endTime).length === 0 && <p className="text-center text-sm text-gray-400 py-8 italic">No active incidents.</p>}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
             <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100">
               <h3 className="font-bold text-indigo-800 text-sm mb-2">Platform Summary</h3>
               <div className="space-y-2">
                 <div className="flex justify-between text-xs text-indigo-600"><span>Regions:</span> <span className="font-bold">{state.regions.length}</span></div>
                 <div className="flex justify-between text-xs text-indigo-600"><span>Services:</span> <span className="font-bold">{state.services.length}</span></div>
                 <div className="flex justify-between text-xs text-indigo-600"><span>Components:</span> <span className="font-bold">{state.components.length}</span></div>
               </div>
             </div>
          </aside>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* List/Hierarchy View */}
          <div className="lg:col-span-2 space-y-6">
            {state.regions.map(region => (
              <div key={region.id} className="bg-white border rounded-xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
                  <h3 className="font-bold text-gray-700">{region.name}</h3>
                  <div className="flex gap-2">
                    <button onClick={() => setRegionForm(region)} className="text-xs text-indigo-600 hover:underline">Edit</button>
                    <button onClick={() => removeRegion(region.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  {state.services.filter(s => s.regionId === region.id).map(service => (
                    <div key={service.id} className="border rounded-lg p-4 bg-gray-50/50">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-bold text-gray-800 text-sm">{service.name}</h4>
                          <p className="text-[10px] text-gray-400">{service.description}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setServiceForm(service)} className="text-[10px] text-indigo-600 hover:underline font-bold uppercase">Edit</button>
                          <button onClick={() => removeService(service.id)} className="text-[10px] text-red-500 hover:underline font-bold uppercase">Delete</button>
                        </div>
                      </div>
                      <div className="pl-4 border-l-2 border-indigo-100 space-y-2">
                        {state.components.filter(c => c.serviceId === service.id).map(comp => (
                          <div key={comp.id} className="flex justify-between items-center text-xs bg-white p-2 rounded shadow-sm border border-gray-100">
                            <span>{comp.name}</span>
                            <div className="flex gap-2">
                              <button onClick={() => setCompForm(comp)} className="text-indigo-600 hover:underline">Edit</button>
                              <button onClick={() => removeComponent(comp.id)} className="text-red-500 hover:underline">Delete</button>
                            </div>
                          </div>
                        ))}
                        <button onClick={() => setCompForm({...compForm, serviceId: service.id})} className="text-[10px] text-indigo-600 font-bold uppercase mt-2">+ New Component</button>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setServiceForm({...serviceForm, regionId: region.id})} className="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-xs font-bold text-gray-400 hover:border-indigo-300 hover:text-indigo-600 transition-all">+ Add New Service to {region.name}</button>
                </div>
              </div>
            ))}
            <button onClick={() => setRegionForm({id: '', name: ''})} className="w-full py-4 border-2 border-dashed border-indigo-200 rounded-xl text-sm font-bold text-indigo-400 hover:bg-indigo-50 transition-all">+ Add New Region</button>
          </div>

          <aside className="space-y-6">
            {(regionForm.id !== '' || regionForm.name !== '') && (
              <div className="bg-white p-6 rounded-xl border-2 border-indigo-500 shadow-xl">
                <h3 className="font-bold mb-4">{regionForm.id ? 'Edit Region' : 'New Region'}</h3>
                <input placeholder="Region Name" className="w-full border p-2 rounded mb-4" value={regionForm.name} onChange={e => setRegionForm({...regionForm, name: e.target.value})} />
                <div className="flex gap-2">
                  <button onClick={() => { regionForm.id ? updateRegion(regionForm.id, regionForm.name) : addRegion(regionForm.name); resetForms(); }} className="flex-1 bg-indigo-600 text-white py-2 rounded font-bold">Save</button>
                  <button onClick={resetForms} className="flex-1 border py-2 rounded text-gray-500">Cancel</button>
                </div>
              </div>
            )}

            {(serviceForm.regionId !== '') && (
              <div className="bg-white p-6 rounded-xl border-2 border-indigo-500 shadow-xl">
                <h3 className="font-bold mb-4">{serviceForm.id ? 'Edit Service' : 'New Service'}</h3>
                <div className="space-y-3">
                  <input placeholder="Service Name" className="w-full border p-2 rounded" value={serviceForm.name} onChange={e => setServiceForm({...serviceForm, name: e.target.value})} />
                  <textarea placeholder="Service Description" className="w-full border p-2 rounded text-sm" value={serviceForm.description} onChange={e => setServiceForm({...serviceForm, description: e.target.value})} />
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => { serviceForm.id ? updateService(serviceForm.id, serviceForm.name, serviceForm.description) : addService(serviceForm.regionId, serviceForm.name, serviceForm.description); resetForms(); }} className="flex-1 bg-indigo-600 text-white py-2 rounded font-bold">Save</button>
                  <button onClick={resetForms} className="flex-1 border py-2 rounded text-gray-500">Cancel</button>
                </div>
              </div>
            )}

            {(compForm.serviceId !== '') && (
              <div className="bg-white p-6 rounded-xl border-2 border-indigo-500 shadow-xl">
                <h3 className="font-bold mb-4">{compForm.id ? 'Edit Component' : 'New Component'}</h3>
                <div className="space-y-3">
                  <input placeholder="Component Name" className="w-full border p-2 rounded" value={compForm.name} onChange={e => setCompForm({...compForm, name: e.target.value})} />
                  <textarea placeholder="Component Description" className="w-full border p-2 rounded text-sm" value={compForm.description} onChange={e => setCompForm({...compForm, description: e.target.value})} />
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => { compForm.id ? updateComponent(compForm.id, compForm.name, compForm.description) : addComponent(compForm.serviceId, compForm.name, compForm.description); resetForms(); }} className="flex-1 bg-indigo-600 text-white py-2 rounded font-bold">Save</button>
                  <button onClick={resetForms} className="flex-1 border py-2 rounded text-gray-500">Cancel</button>
                </div>
              </div>
            )}
            
            {!regionForm.name && !serviceForm.regionId && !compForm.serviceId && (
              <div className="p-6 bg-gray-50 border rounded-xl text-center text-xs text-gray-400">
                Select an item to edit or click a "New" button.
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
