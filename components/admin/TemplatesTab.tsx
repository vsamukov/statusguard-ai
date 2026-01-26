
import React, { useState } from 'react';
import { useApp } from '../../store.tsx';

const TemplatesTab: React.FC = () => {
  const { state, addTemplate, updateTemplate, removeTemplate } = useApp();
  const [editing, setEditing] = useState<any>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing.id) {
      await updateTemplate(editing.id, editing);
    } else {
      await addTemplate(editing);
    }
    setEditing(null);
  };

  const componentNames = Array.from(new Set(state.components.map(c => c.name))).sort();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Response Templates</h2>
        <button 
          onClick={() => setEditing({ componentName: '', name: '', title: '', description: '' })}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold"
        >
          + Create Template
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {state.templates.map(t => (
          <div key={t.id} className="bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{t.componentName}</span>
              <div className="flex gap-2">
                <button onClick={() => setEditing(t)} className="text-xs text-gray-400 hover:text-indigo-600">Edit</button>
                <button onClick={() => confirm('Delete?') && removeTemplate(t.id)} className="text-xs text-gray-400 hover:text-red-500">Delete</button>
              </div>
            </div>
            <h3 className="font-bold text-gray-800 mb-1">{t.name}</h3>
            <p className="text-xs text-gray-500 line-clamp-3">{t.description}</p>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-[100] p-4">
          <form onSubmit={handleSave} className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-lg animate-in zoom-in-95">
            <h3 className="font-bold text-lg mb-6">{editing.id ? 'Edit Template' : 'New Template'}</h3>
            <div className="space-y-4">
              <select 
                required
                className="w-full border p-3 rounded-lg"
                value={editing.componentName}
                onChange={e => setEditing({ ...editing, componentName: e.target.value })}
              >
                <option value="">Target Component Name...</option>
                {componentNames.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
              <input 
                required
                placeholder="Internal Template Name"
                className="w-full border p-3 rounded-lg"
                value={editing.name}
                onChange={e => setEditing({ ...editing, name: e.target.value })}
              />
              <input 
                required
                placeholder="Public Headline"
                className="w-full border p-3 rounded-lg font-bold"
                value={editing.title}
                onChange={e => setEditing({ ...editing, title: e.target.value })}
              />
              <textarea 
                required
                placeholder="Template Content"
                rows={6}
                className="w-full border p-3 rounded-lg text-sm"
                value={editing.description}
                onChange={e => setEditing({ ...editing, description: e.target.value })}
              />
            </div>
            <div className="flex gap-2 mt-6">
              <button type="submit" className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold">Save Template</button>
              <button type="button" onClick={() => setEditing(null)} className="px-6 py-3 text-gray-400 font-bold">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default TemplatesTab;
