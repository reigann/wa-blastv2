import { useEffect, useState } from 'react';
import { blastAPI } from '../services/api';
import { Trash2, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Logs() {
  const [sessions, setSessions] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [logs, setLogs] = useState({});

  useEffect(() => { load(); }, []);

  async function load() {
    const r = await blastAPI.getSessions();
    setSessions(r.data);
  }

  async function loadLogs(id) {
    if (expanded === id) { setExpanded(null); return; }
    const r = await blastAPI.getSessionLogs(id);
    setLogs(prev => ({ ...prev, [id]: r.data }));
    setExpanded(id);
  }

  async function deleteSession(id) {
    await blastAPI.deleteSession(id);
    toast.success('Session deleted');
    load();
    if (expanded === id) setExpanded(null);
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Blast Logs</h1>
      <div className="space-y-3">
        {sessions.map(s => (
          <div key={s.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50" onClick={() => loadLogs(s.id)}>
              <ChevronDown size={16} className={`transition-transform ${expanded === s.id ? 'rotate-180' : ''}`} />
              <div className="flex-1">
                <p className="font-medium text-sm">{s.name}</p>
                <p className="text-xs text-gray-400">{new Date(s.created_at).toLocaleString('id-ID')}</p>
              </div>
              <div className="flex gap-4 text-sm">
                <span className="text-green-600">✅ {s.sent}</span>
                <span className="text-red-500">❌ {s.failed}</span>
                <span className="text-gray-400">/{s.total}</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                ${s.status === 'completed' ? 'bg-green-100 text-green-700' :
                  s.status === 'running' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-600'}`}>
                {s.status}
              </span>
              <button onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }} className="text-red-400 hover:text-red-600">
                <Trash2 size={16} />
              </button>
            </div>

            {expanded === s.id && logs[s.id] && (
              <div className="border-t max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Phone</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Error</th>
                      <th className="text-left p-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs[s.id].map(l => (
                      <tr key={l.id} className="border-t">
                        <td className="p-2">{l.name || '-'}</td>
                        <td className="p-2 font-mono">{l.phone}</td>
                        <td className={`p-2 font-semibold ${l.status === 'sent' ? 'text-green-600' : 'text-red-500'}`}>{l.status}</td>
                        <td className="p-2 text-gray-400 max-w-xs truncate">{l.error_message || '-'}</td>
                        <td className="p-2 text-gray-400">{new Date(l.sent_at).toLocaleTimeString('id-ID')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
        {sessions.length === 0 && <p className="text-center text-gray-400 py-12">No blast sessions yet</p>}
      </div>
    </div>
  );
}
