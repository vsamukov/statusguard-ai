
import React, { useState } from 'react';
import { useApp } from '../../store.tsx';

const ConfigurationTab: React.FC = () => {
  const { state, addRegion, removeRegion, addService, removeService, addComponent, removeComponent } = useApp();
  const [activeForm, setActiveForm] = useState<'region' | 'service' | 'component' | null>(null);
  const [formState, setFormState] = useState({ name: '', parentId: '' });

  const handleAddRegion = async (e: React.FormEvent) => {
    e.preventDefault();
    await addRegion(formState.name);
    setActiveForm(null);
    setFormState({ name: '', parentId: '' });
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Infrastructure Map</h2>
        <button 
          onClick={() => setActiveForm('region')}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold"
        >
          + Add Region
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {state.regions.map(region => (
          <div key={region.id} className="bg-white border rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
              <h3 className="font-bold text-gray-700">{region.name}</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => { setActiveForm('service'); setFormState({ ...formState, parentId: region.id }); }}
                  className="text-xs font-bold text-indigo-600 uppercase"
                >
                  Add Service
                </button>
                <button 
                  onClick={() => confirm(`Delete ${region.name}?`) && removeRegion(region.id)}
                  className="text-xs font-bold text-red-400 uppercase"
                >
                  Delete
                </button>
              </div>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {state.services.filter(s => s.regionId === region.id).map(service => (
                <div key={service.id} className="border rounded-xl p-4 bg-gray-50/50">
                  <div className="flex justify-between mb-4">
                    <span className="font-bold text-sm text-gray-800">{service.name}</span>
                    <button 
                      onClick={() => confirm(`Delete ${service.name}?`) && removeService(service.id)}
                      className="text-[10px] text-red-500 font-bold uppercase"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="space-y-2">
                    {state.components.filter(c => c.serviceId === service.id).map(comp => (
                      <div key={comp.id} className="flex justify-between items-center bg-white p-2 rounded border text-xs">
                        <span>{comp.name}</span>
                        <button onClick={() => removeComponent(comp.id)} className="text-red-400">×</button>
                      </div>
                    ))}
                    <button 
                      onClick={() => { setActiveForm('component'); setFormState({ ...formState, parentId: service.id }); }}
                      className="text-[10px] font-bold text-indigo-600 uppercase"
                    >
                      + Component
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {activeForm && (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-[100]">
          <form onSubmit={handleAddRegion} className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
            <h3 className="font-bold text-lg mb-4 capitalize">Add {activeForm}</h3>
            <input 
              autoFocus
              className="w-full border p-3 rounded-lg outline-none mb-4"
              placeholder={`${activeForm} Name`}
              value={formState.name}
              onChange={e => setFormState({ ...formState, name: e.target.value })}
            />
            <div className="flex gap-2">
              <button 
                type="submit"
                className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold"
              >
                Create
              </button>
              <button 
                type="button"
                onClick={() => setActiveForm(null)}
                className="px-6 py-3 text-gray-400 font-bold"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ConfigurationTab;
