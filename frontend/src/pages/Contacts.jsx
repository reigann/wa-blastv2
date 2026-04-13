import { useEffect, useState, useRef } from 'react';
import { contactsAPI } from '../services/api';
import toast from 'react-hot-toast';
import Papa from 'papaparse';
import { Upload, Plus, Trash2, Users } from 'lucide-react';

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', group_name: 'default' });
  const fileRef = useRef();

  useEffect(() => { loadContacts(); loadGroups(); }, [selectedGroup]);

  async function loadContacts() {
    const r = await contactsAPI.getAll(selectedGroup || undefined);
    setContacts(r.data);
  }

  async function loadGroups() {
    const r = await contactsAPI.getGroups();
    setGroups(r.data);
  }

  async function addContact(e) {
    e.preventDefault();
    await contactsAPI.add(form);
    toast.success('Contact added!');
    setShowAddForm(false);
    setForm({ name: '', phone: '', group_name: 'default' });
    loadContacts(); loadGroups();
  }

  async function deleteContact(id) {
    await contactsAPI.delete(id);
    toast.success('Deleted');
    loadContacts(); loadGroups();
  }

  function handleCSVUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const group = prompt('Group name for these contacts:', 'default') || 'default';
    const formData = new FormData();
    formData.append('file', file);
    formData.append('group_name', group);
    toast.promise(
      contactsAPI.uploadCSV(formData).then(r => {
        loadContacts(); loadGroups();
        return r.data;
      }),
      {
        loading: 'Uploading CSV...',
        success: d => `Imported ${d.imported} contacts (${d.skipped} skipped)`,
        error: 'Upload failed'
      }
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Contacts</h1>
        <div className="flex gap-2">
          <button onClick={() => fileRef.current.click()}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
            <Upload size={16} /> Import CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
          <button onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600">
            <Plus size={16} /> Add Contact
          </button>
        </div>
      </div>

      {/* Group filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setSelectedGroup('')}
          className={`px-3 py-1 rounded-full text-sm ${!selectedGroup ? 'bg-green-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
          All ({contacts.length})
        </button>
        {groups.map(g => (
          <button key={g.group_name} onClick={() => setSelectedGroup(g.group_name)}
            className={`px-3 py-1 rounded-full text-sm ${selectedGroup === g.group_name ? 'bg-green-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
            {g.group_name} ({g.count})
          </button>
        ))}
      </div>

      {/* Add form */}
      {showAddForm && (
        <form onSubmit={addContact} className="bg-white rounded-xl p-4 border mb-4 flex gap-3 flex-wrap">
          <input className="border rounded-lg px-3 py-2 text-sm flex-1" placeholder="Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          <input className="border rounded-lg px-3 py-2 text-sm flex-1" placeholder="Phone (e.g. 081234567890)" required value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
          <input className="border rounded-lg px-3 py-2 text-sm flex-1" placeholder="Group" value={form.group_name} onChange={e => setForm({...form, group_name: e.target.value})} />
          <button type="submit" className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm">Save</button>
          <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
        </form>
      )}

      {/* CSV format hint */}
      <p className="text-xs text-gray-400 mb-3">
        💡 CSV format: columns <code>name</code> and <code>phone</code> (header required)
      </p>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Phone</th>
              <th className="text-left p-3">Group</th>
              <th className="text-left p-3">Added</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {contacts.map(c => (
              <tr key={c.id} className="border-t hover:bg-gray-50">
                <td className="p-3">{c.name || '-'}</td>
                <td className="p-3 font-mono">{c.phone}</td>
                <td className="p-3"><span className="bg-gray-100 px-2 py-0.5 rounded text-xs">{c.group_name}</span></td>
                <td className="p-3 text-gray-400">{new Date(c.created_at).toLocaleDateString('id-ID')}</td>
                <td className="p-3">
                  <button onClick={() => deleteContact(c.id)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-gray-400">No contacts yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
