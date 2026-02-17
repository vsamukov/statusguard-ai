
import React, { useState } from 'react';
import { useApp } from '../../store.tsx';

const ConfigurationTab: React.FC = () => {
  const { state, addRegion, removeRegion, addComponent, removeComponent } = useApp();
  const [activeForm, setActiveForm] = useState<'region' | 'component' | null>(null);
  const [formState, setFormState] = useState({ name: '', description: '', parentId: '' });

  const handleAddInfrastructure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name) return;

    try {
      if (activeForm === 'region') {
        await addRegion(formState.name);
      } else if (activeForm === 'component') {
        await addComponent(formState.parentId, formState.name, formState.description);
      }
      setActiveForm(null);
      setFormState({ name: '', description: '', parentId: '' });
    } catch (err) { alert("Creation failed."); }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Infrastructure Mapping</h2>
          <p className="text-sm text-gray-400 mt-1">Define geographical regions and the technical components within them.</p>
        </div>
        <button 
          onClick={() => { setFormState({ name: '', description: '', parentId: '' }); setActiveForm('region'); }}
          className="bg-indigo-600 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all"
        >
          + Add Region
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {state.regions.map(region => (
          <div key={region.id} className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="px-8 py-5 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white rounded-lg border border-gray-100 flex items-center justify-center text-gray-400 font-bold text-xs">
                  {region.name.charAt(0)}
                </div>
                <h3 className="font-black text-gray-800 uppercase tracking-tight">{region.name}</h3>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => { setActiveForm('component'); setFormState({ name: '', description: '', parentId: region.id }); }}
                  className="text-xs font-bold text-indigo-600 hover:underline uppercase tracking-tighter"
                >
                  Add Component
                </button>
                <button 
                  onClick={() => confirm(`Permanently remove ${region.name}?`) && removeRegion(region.id)}
                  className="text-xs font-bold text-red-400 hover:text-red-600 uppercase tracking-tighter"
                >
                  Delete
                </button>
              </div>
            </div>
            
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {state.components.filter(c => c.regionId === region.id).map(comp => (
                <div key={comp.id} className="border border-gray-100 rounded-2xl p-6 bg-gray-50/30 flex flex-col group relative">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-sm text-gray-800">{comp.name}</span>
                    <button 
                      onClick={() => confirm(`Delete component ${comp.name}?`) && removeComponent(comp.id)}
                      className="text-[10px] text-red-400 font-bold uppercase opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Delete
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 font-medium italic line-clamp-2">{comp.description || 'No description.'}</p>
                </div>
              ))}
              
              {state.components.filter(c => c.regionId === region.id).length === 0 && (
                <div className="col-span-full py-12 text-center border-2 border-dashed border-gray-100 rounded-2xl">
                  <p className="text-xs text-gray-300 font-bold uppercase tracking-widest">No components defined</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {activeForm && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <form onSubmit={handleAddInfrastructure} className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md animate-in zoom-in-95">
            <h3 className="font-black text-xl mb-6 text-gray-900">
              Create {activeForm.charAt(0).toUpperCase() + activeForm.slice(1)}
            </h3>
            
            <div className="space-y-4 mb-8">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Name</label>
                <input 
                  autoFocus required
                  className="w-full bg-gray-50 border border-gray-100 p-3.5 rounded-xl outline-none text-sm font-bold"
                  placeholder={`e.g. ${activeForm === 'region' ? 'Europe (West)' : 'Database Cluster'}`}
                  value={formState.name}
                  onChange={e => setFormState({ ...formState, name: e.target.value })}
                />
              </div>
              {activeForm === 'component' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Description</label>
                  <textarea 
                    rows={3}
                    className="w-full bg-gray-50 border border-gray-100 p-3.5 rounded-xl outline-none text-sm"
                    placeholder="Brief purpose..."
                    value={formState.description}
                    onChange={e => setFormState({ ...formState, description: e.target.value })}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button type="submit" className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-bold">Confirm</button>
              <button type="button" onClick={() => setActiveForm(null)} className="px-6 py-4 text-gray-400 font-bold text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ConfigurationTab;
