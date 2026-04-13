import { useEffect, useState } from 'react';
import { templatesAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, Pencil } from 'lucide-react';

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState({ name: '', content: '' });
  const [editing, setEditing] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const r = await templatesAPI.getAll();
    setTemplates(r.data);
  }

  async function save(e) {
    e.preventDefault();
    if (editing) {
      await templatesAPI.update(editing, form);
      toast.success('Template updated!');
      setEditing(null);
    } else {
      await templatesAPI.create(form);
      toast.success('Template saved!');
    }
    setForm({ name: '', content: '' });
    load();
  }

  async function del(id) {
    await templatesAPI.delete(id);
    toast.success('Deleted');
    load();
  }

  function edit(t) {
    setEditing(t.id);
    setForm({ name: t.name, content: t.content });
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Message Templates</h1>

      <div className="bg-white rounded-xl border shadow-sm p-6 mb-6">
        <h2 className="font-semibold mb-4">{editing ? 'Edit Template' : 'New Template'}</h2>
        <form onSubmit={save} className="space-y-3">
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Template name" required
            value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows={5}
            placeholder={"Hi {{name}},\n\nMessage content here..."}
            required value={form.content} onChange={e => setForm({...form, content: e.target.value})} />
          <p className="text-xs text-gray-400">Variables: <code>{'{{name}}'}</code> <code>{'{{phone}}'}</code></p>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm">{editing ? 'Update' : 'Save'}</button>
            {editing && <button type="button" onClick={() => { setEditing(null); setForm({ name: '', content: '' }); }} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>}
          </div>
        </form>
      </div>

      <div className="space-y-3">
        {templates.map(t => (
          <div key={t.id} className="bg-white rounded-xl border p-4 flex gap-3">
            <div className="flex-1">
              <p className="font-medium text-sm">{t.name}</p>
              <p className="text-gray-500 text-xs mt-1 whitespace-pre-wrap line-clamp-3">{t.content}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => edit(t)} className="text-blue-400 hover:text-blue-600"><Pencil size={16} /></button>
              <button onClick={() => del(t.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
        {templates.length === 0 && <p className="text-center text-gray-400 py-8">No templates yet</p>}
      </div>
    </div>
  );
}
