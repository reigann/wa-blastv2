import { useEffect, useState } from 'react';
import { blastAPI, contactsAPI, templatesAPI } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import toast from 'react-hot-toast';
import axios from 'axios';
import { Send, StopCircle, X } from 'lucide-react';

export default function Blast() {
  const { waStatus, blastProgress, blastStatus, setBlastStatus } = useSocket();
  const [groups, setGroups] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [isActive, setIsActive] = useState(false);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);

  const [form, setForm] = useState({
    name: '',
    message: '',
    group_name: '',
    delay_min: 1200,
    delay_max: 2200
  });

  useEffect(() => {
    contactsAPI.getGroups().then(r => setGroups(r.data));
    templatesAPI.getAll().then(r => setTemplates(r.data));
    blastAPI.isActive().then(r => setIsActive(r.data.active));
  }, []);

  useEffect(() => {
    if (blastStatus === 'completed' || blastStatus === 'cancelled') {
      setIsActive(false);
    }
    if (blastStatus === 'started') {
      setIsActive(true);
    }
  }, [blastStatus]);

  function handleMediaChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size (max 16MB)
    if (file.size > 16 * 1024 * 1024) {
      toast.error('File size too large (max 16 MB)');
      return;
    }

    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  }

  function clearMedia() {
    setMediaFile(null);
    setMediaPreview(null);
  }

  async function handleStart(e) {
    e.preventDefault();
    
    // Check active status from API (not just local state)
    try {
      const statusCheck = await blastAPI.isActive();
      if (statusCheck.data.active) {
        toast.error('A blast is already running. Please stop it first from Sessions page.');
        setIsActive(true);
        return;
      }
    } catch (err) {
      console.error('Failed to check blast status');
    }
    
    if (waStatus !== 'connected') {
      toast.error('WhatsApp is not connected!');
      return;
    }
    if (!form.message || !form.group_name) {
      toast.error('Message and group are required');
      return;
    }

    try {
      // Use FormData for multipart/form-data dengan file
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('message', form.message);
      formData.append('group_name', form.group_name);
      formData.append('delay_min', form.delay_min);
      formData.append('delay_max', form.delay_max);
      
      if (mediaFile) {
        formData.append('media', mediaFile);
      }

      const r = await axios.post('http://localhost:3001/api/blast/start', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const mediaText = r.data.hasMedia ? ' dengan media' : '';
      toast.success(`Blast started${mediaText}! Sending to ${r.data.total} contacts`);
      setIsActive(true);
      setBlastStatus('started');
      clearMedia(); // Bersihkan file setelah submit
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to start blast';
      toast.error(errorMsg);
      console.error('Blast error:', err);
    }
  }

  async function handleCancel() {
    await blastAPI.cancel();
    toast.success('Cancelling blast...');
  }

  const progress = blastProgress ? Math.round((blastProgress.current / blastProgress.total) * 100) : 0;

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Send Blast</h1>

      {/* Active blast progress */}
      {isActive && blastProgress && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold text-blue-800">Sending messages...</span>
            <button onClick={handleCancel} className="flex items-center gap-1 text-red-500 text-sm hover:text-red-700">
              <StopCircle size={16} /> Cancel
            </button>
          </div>
          <div className="w-full bg-blue-100 rounded-full h-3 mb-2">
            <div className="bg-blue-500 h-3 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-sm text-blue-700">
            {blastProgress.current}/{blastProgress.total} ({progress}%) — 
            ✅ {blastProgress.sent} sent &nbsp; ❌ {blastProgress.failed} failed
          </p>
          {blastProgress.phone && (
            <div className="text-xs text-blue-500 mt-1 space-y-1">
              <p>
                Last: {blastProgress.name || blastProgress.phone} — 
                <span className={blastProgress.status === 'sent' ? 'text-green-600' : 'text-red-600'}>
                  {blastProgress.status}
                </span>
              </p>
              {blastProgress.error && (
                <p className="text-red-500">Error: {blastProgress.error}</p>
              )}
              {blastProgress.retry > 0 && (
                <p className="text-yellow-600">Retry attempt: {blastProgress.retry}</p>
              )}
            </div>
          )}
        </div>
      )}

      {blastStatus === 'completed' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
          <p className="text-green-700 font-semibold">✅ Blast completed!</p>
          <p className="text-green-600 text-sm">{blastProgress?.sent} sent, {blastProgress?.failed} failed</p>
        </div>
      )}

      {/* Form */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <form onSubmit={handleStart} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Session Name</label>
            <input className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. Promo Ramadan"
              value={form.name}
              onChange={e => setForm({...form, name: e.target.value})} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Target Group <span className="text-red-500">*</span></label>
            <select className="w-full border rounded-lg px-3 py-2 text-sm" required
              value={form.group_name} onChange={e => setForm({...form, group_name: e.target.value})}>
              <option value="">-- Select group --</option>
              {groups.map(g => (
                <option key={g.group_name} value={g.group_name}>{g.group_name} ({g.count} contacts)</option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium">Message <span className="text-red-500">*</span></label>
              {templates.length > 0 && (
                <select className="text-xs text-blue-500 border rounded px-2 py-1"
                  onChange={e => e.target.value && setForm({...form, message: e.target.value})}>
                  <option value="">Use template...</option>
                  {templates.map(t => <option key={t.id} value={t.content}>{t.name}</option>)}
                </select>
              )}
            </div>
            <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows={5} required
              placeholder={"Hello {{name}},\n\nYour message here...\n\nUse {{name}} for contact name, {{phone}} for phone number"}
              value={form.message}
              onChange={e => setForm({...form, message: e.target.value})} />
            <p className="text-xs text-gray-400 mt-1">Variables: <code>{'{{name}}'}</code> <code>{'{{phone}}'}</code></p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Attach Photo/Video/Document (Optional)</label>
            <input 
              type="file" 
              accept="image/*,video/*,application/pdf,.docx,.xlsx,audio/*"
              onChange={handleMediaChange}
              disabled={isActive}
              className="w-full border rounded-lg px-3 py-2 text-sm disabled:opacity-50" />
            <p className="text-xs text-gray-400 mt-1">JPG, PNG, MP4, PDF, DOCX, XLSX, MP3 — Max 16 MB</p>
            
            {/* Media Preview */}
            {mediaPreview && (
              <div className="mt-3 relative inline-block">
                {mediaFile.type.startsWith('image/') ? (
                  <img src={mediaPreview} alt="preview" className="h-32 rounded-lg object-cover border border-gray-200" />
                ) : (
                  <div className="h-32 w-32 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-700">{mediaFile.name.split('.').pop().toUpperCase()}</p>
                      <p className="text-xs text-gray-500">{(mediaFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                )}
                <button 
                  type="button"
                  onClick={clearMedia}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 shadow">
                  <X size={16} />
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Min Delay (ms)</label>
              <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.delay_min} min={1000}
                onChange={e => setForm({...form, delay_min: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max Delay (ms)</label>
              <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.delay_max} min={1000}
                onChange={e => setForm({...form, delay_max: Number(e.target.value)})} />
            </div>
          </div>
          <p className="text-xs text-yellow-600">⚠️ For safer sending, keep delay 3000ms+ (quick mode: 1200-2200ms)</p>

          <button type="submit" disabled={isActive || waStatus !== 'connected'}
            className="w-full flex items-center justify-center gap-2 py-3 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed">
            <Send size={18} />
            {isActive ? 'Blast Running...' : 'Start Blast'}
          </button>
        </form>
      </div>
    </div>
  );
}
