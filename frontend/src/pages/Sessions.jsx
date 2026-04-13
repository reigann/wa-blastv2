import { useEffect, useState } from 'react';
import { blastAPI, contactsAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { Calendar, ChevronRight, Trash2, BarChart3, Send, StopCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Sessions() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [groups, setGroups] = useState([]);
  const [showRunModal, setShowRunModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [runLoading, setRunLoading] = useState(false);

  useEffect(() => {
    loadSessions();
    loadGroups();
  }, []);

  async function loadSessions() {
    setLoading(true);
    try {
      const r = await blastAPI.getSessions();
      setSessions(r.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch (err) {
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }

  async function loadGroups() {
    try {
      const r = await contactsAPI.getGroups();
      setGroups(r.data);
    } catch (err) {
      console.error('Failed to load groups');
    }
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    if (!confirm('Delete this session? This action cannot be undone.')) return;
    
    try {
      await blastAPI.deleteSession(id);
      toast.success('Session deleted');
      loadSessions();
    } catch (err) {
      toast.error('Failed to delete session');
    }
  }

  async function handleRunBlast() {
    if (!selectedGroup) {
      toast.error('Please select a target group');
      return;
    }

    setRunLoading(true);
    try {
      await blastAPI.start({
        name: `${selectedSession.name} (Repeat)`,
        message: selectedSession.message,
        group_name: selectedGroup,
        delay_min: 3000,
        delay_max: 7000
      });
      toast.success('Blast started from this session!');
      setShowDetail(false);
      setShowRunModal(false);
      setSelectedGroup('');
      loadSessions();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start blast');
    } finally {
      setRunLoading(false);
    }
  }

  async function handleCancel(e) {
    e.stopPropagation();
    try {
      const r = await blastAPI.cancel();
      toast.success('Blast stopped successfully');
      
      // Refresh sessions immediately
      await loadSessions();
      
      // Update selected session if it's still open
      if (selectedSession) {
        const updated = await blastAPI.getSessions();
        const refreshedSession = updated.data.find(s => s.id === selectedSession.id);
        if (refreshedSession) {
          setSelectedSession(refreshedSession);
        }
      }
    } catch (err) {
      toast.error('Failed to cancel blast');
      console.error(err);
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'running':
        return 'bg-blue-100 text-blue-700';
      case 'cancelled':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-yellow-100 text-yellow-700';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'running':
        return '⟳';
      case 'cancelled':
        return '◯';
      default:
        return '⏱️';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Campaign Sessions</h1>
          <p className="text-gray-400">Manage and analyze all your blast campaigns</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-gray-400">Loading sessions...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12 bg-white/5 border border-gray-700/50 rounded-2xl">
            <Send size={48} className="text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 font-medium">No campaigns yet</p>
            <p className="text-gray-500 text-sm mt-1">Create your first campaign from the Blast page</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {sessions.map((session) => {
              const successRate = session.total > 0 ? Math.round((session.sent / session.total) * 100) : 0;
              const isRecent = new Date() - new Date(session.created_at) < 60000; // Less than 1 min

              return (
                <div
                  key={session.id}
                  onClick={() => {
                    setSelectedSession(session);
                    setShowDetail(true);
                  }}
                  className="bg-white/5 border border-gray-700/50 rounded-2xl p-6 hover:bg-white/10 hover:border-gray-600 transition-all cursor-pointer backdrop-blur-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-xl font-semibold text-white">{session.name}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(session.status)}`}>
                          {getStatusIcon(session.status)} {session.status}
                        </span>
                        {isRecent && (
                          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs font-semibold animate-pulse">
                            NEW
                          </span>
                        )}
                      </div>

                      <p className="text-gray-400 text-sm mb-4 line-clamp-2">{session.message}</p>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div className="bg-gray-800/50 rounded-lg p-3">
                          <p className="text-gray-400 text-xs mb-1">Total</p>
                          <p className="text-white font-bold text-lg">{session.total}</p>
                        </div>
                        <div className="bg-green-500/20 rounded-lg p-3">
                          <p className="text-green-400 text-xs mb-1">Sent</p>
                          <p className="text-white font-bold text-lg">{session.sent}</p>
                        </div>
                        <div className="bg-red-500/20 rounded-lg p-3">
                          <p className="text-red-400 text-xs mb-1">Failed</p>
                          <p className="text-white font-bold text-lg">{session.failed}</p>
                        </div>
                        <div className={`rounded-lg p-3 ${successRate >= 90 ? 'bg-green-500/20' : successRate >= 80 ? 'bg-yellow-500/20' : 'bg-red-500/20'}`}>
                          <p className={`text-xs mb-1 ${successRate >= 90 ? 'text-green-400' : successRate >= 80 ? 'text-yellow-400' : 'text-red-400'}`}>Rate</p>
                          <p className="text-white font-bold text-lg">{successRate}%</p>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            successRate >= 90 ? 'bg-green-500' :
                            successRate >= 80 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${successRate}%` }}
                        />
                      </div>

                      {/* Date */}
                      <p className="text-gray-500 text-xs mt-3 flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(session.created_at).toLocaleString('id-ID')}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={(e) => handleDelete(session.id, e)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                      >
                        <Trash2 size={18} />
                      </button>
                      <ChevronRight className="text-gray-500" size={20} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetail && selectedSession && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-gray-800/50 to-gray-700/30 p-6 border-b border-gray-700/50 flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">{selectedSession.name}</h2>
                <p className="text-gray-400 text-sm mt-1 flex items-center gap-2">
                  <BarChart3 size={14} />
                  Campaign Analytics
                </p>
              </div>
              <button
                onClick={() => setShowDetail(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Status Badge */}
              <div>
                <p className="text-gray-400 text-sm mb-2">Status</p>
                <span className={`inline-block px-4 py-2 rounded-full text-sm font-bold ${getStatusColor(selectedSession.status)}`}>
                  {getStatusIcon(selectedSession.status)} {selectedSession.status}
                </span>
              </div>

              {/* Message Preview */}
              <div>
                <p className="text-gray-400 text-sm mb-2">Message</p>
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/30">
                  <p className="text-gray-300 text-sm whitespace-pre-wrap">{selectedSession.message}</p>
                </div>
              </div>

              {/* Analytics */}
              <div>
                <p className="text-gray-400 text-sm mb-3">Performance Metrics</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/30">
                    <p className="text-gray-400 text-xs mb-2">Total Messages</p>
                    <p className="text-3xl font-bold text-white">{selectedSession.total}</p>
                  </div>
                  <div className="bg-green-500/20 rounded-lg p-4 border border-green-500/30">
                    <p className="text-green-400 text-xs mb-2">Successfully Sent</p>
                    <p className="text-3xl font-bold text-green-400">{selectedSession.sent}</p>
                  </div>
                  <div className="bg-red-500/20 rounded-lg p-4 border border-red-500/30">
                    <p className="text-red-400 text-xs mb-2">Failed</p>
                    <p className="text-3xl font-bold text-red-400">{selectedSession.failed}</p>
                  </div>
                  <div className="bg-blue-500/20 rounded-lg p-4 border border-blue-500/30">
                    <p className="text-blue-400 text-xs mb-2">Success Rate</p>
                    <p className="text-3xl font-bold text-blue-400">
                      {selectedSession.total > 0 ? Math.round((selectedSession.sent / selectedSession.total) * 100) : 0}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Success Rate Bar */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-gray-400 text-sm">Success Rate Progress</p>
                  <p className="text-gray-300 font-semibold">
                    {selectedSession.sent}/{selectedSession.total}
                  </p>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3">
                  <div
                    className="h-3 rounded-full bg-gradient-to-r from-green-400 to-green-600 transition-all"
                    style={{
                      width: `${selectedSession.total > 0 ? (selectedSession.sent / selectedSession.total) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>

              {/* Timestamp */}
              <div className="pt-4 border-t border-gray-700/30">
                <p className="text-gray-400 text-sm mb-2">Campaign Time</p>
                <p className="text-gray-300">
                  {new Date(selectedSession.created_at).toLocaleString('id-ID')}
                </p>
                {selectedSession.completed_at && (
                  <p className="text-gray-400 text-sm mt-2">
                    Duration: {Math.round((new Date(selectedSession.completed_at) - new Date(selectedSession.created_at)) / 1000 / 60)} minutes
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-700/30">
                <button
                  onClick={() => setShowRunModal(true)}
                  disabled={selectedSession.status === 'running'}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <Send size={18} />
                  Run Blast Again
                </button>
                {selectedSession.status === 'running' && (
                  <button
                    onClick={handleCancel}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition"
                  >
                    <StopCircle size={18} />
                    Stop Blast
                  </button>
                )}
                <button
                  onClick={() => setShowDetail(false)}
                  className="px-6 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Run Blast Modal */}
      {showRunModal && selectedSession && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-700/50">
              <h3 className="text-xl font-bold text-white">Select Target Group</h3>
              <p className="text-gray-400 text-sm mt-1">Choose which group to send this blast to</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Target Group *</label>
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-green-500"
                >
                  <option value="">-- Select group --</option>
                  {groups.map(g => (
                    <option key={g.group_name} value={g.group_name}>
                      {g.group_name} ({g.count} contacts)
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-3">
                <p className="text-blue-400 text-sm">
                  <strong>Message:</strong> {selectedSession.message.substring(0, 100)}
                  {selectedSession.message.length > 100 && '...'}
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleRunBlast}
                  disabled={!selectedGroup || runLoading}
                  className="flex-1 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {runLoading ? 'Starting...' : 'Start Blast'}
                </button>
                <button
                  onClick={() => {
                    setShowRunModal(false);
                    setSelectedGroup('');
                  }}
                  className="flex-1 py-2 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
