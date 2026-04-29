import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Modal,
  ProgressBar,
  Row,
  Form,
} from 'react-bootstrap';
import toast from 'react-hot-toast';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { blastAPI, contactsAPI } from '../services/api';

function normalizeStatus(session) {
  if (session.status === 'running') return 'active';
  if (session.status === 'failed') return 'error';
  return 'idle';
}

export default function Sessions() {
  const [sessions, setSessions] = useState([]);
  const [groups, setGroups] = useState([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    loadSessions();
    loadGroups();
  }, []);

  const [filterMonth, setFilterMonth] = useState('all');
  const [filterYear, setFilterYear] = useState('all');


  async function loadSessions() {
    try {
      const response = await blastAPI.getSessions();
      setSessions((response.data || []).slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch (error) {
      setSessions([]);
      toast.error('Failed to load sessions');
    }
  }

  async function loadGroups() {
    try {
      const response = await contactsAPI.getGroups();
      setGroups(response.data || []);
    } catch (error) {
      setGroups([]);
    }
  }

  async function openDetail(session) {
    setSelected(session);
    setDetailOpen(true);
    try {
      const response = await blastAPI.getSessionLogs(session.id);
      setLogs(response.data || []);
    } catch (error) {
      setLogs([]);
    }
  }

  async function stopSession() {
    try {
      await blastAPI.cancel();
      toast.success('Session stopped');
      await loadSessions();
    } catch (error) {
      toast.error('Failed to stop session');
    }
  }

  async function rerunSession(session) {
    const targetGroup = session.group_name || groups[0]?.group_name || 'default';
    try {
      await blastAPI.start({
        name: `${session.name} Rerun`,
        message: session.message,
        group_name: targetGroup,
        delay_min: 3000,
        delay_max: 4500,
      });
      toast.success('Blast rerun started');
      await loadSessions();
    } catch (error) {
      toast.error('Rerun failed');
    }
  }

  const logChartData = useMemo(() => {
    return logs.slice(-25).map((entry, index) => ({
      idx: index + 1,
      sent: entry.status === 'sent' ? 1 : 0,
      failed: entry.status !== 'sent' ? 1 : 0,
    }));
  }, [logs]);

  const filteredSessions = sessions.filter(s=>{
    const dt = new Date(s.created_at || s.updated_at);
    const monthMatch = filterMonth === 'all' ? true : (dt.getMonth()+1) === Number(filterMonth);
    const yearMatch = filterYear === 'all' ? true : dt.getFullYear() === Number(filterYear);
    return monthMatch && yearMatch;
  });

  return (
    <div className="page-enter-active">
      <PageHeader
        title="Sessions"
        subtitle="Monitor blast runtime, quality, and quick recovery actions"
        actions={[
          <Button key="new" href="/blast">
            <i className="bi bi-plus-lg me-2" />New Session
          </Button>,
        ]}
      />

      <div className="d-flex justify-content-between align-items-center mb-3">
        <div />
        <div className="d-flex gap-2">
          <Form.Select value={filterMonth} onChange={(e)=>setFilterMonth(e.target.value)} style={{width:160}}>
            <option value="all">All Months</option>
            <option value="1">January</option>
            <option value="2">February</option>
            <option value="3">March</option>
            <option value="4">April</option>
            <option value="5">May</option>
            <option value="6">June</option>
            <option value="7">July</option>
            <option value="8">August</option>
            <option value="9">September</option>
            <option value="10">October</option>
            <option value="11">November</option>
            <option value="12">December</option>
          </Form.Select>
          <Form.Select value={filterYear} onChange={(e)=>setFilterYear(e.target.value)} style={{width:140}}>
            <option value="all">All Years</option>
            {Array.from(new Set(sessions.map(s=>new Date(s.created_at).getFullYear()))).sort((a,b)=>b-a).map(y=> (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </Form.Select>
        </div>
      </div>
      {sessions.length === 0 ? (
        <Card className="surface-card">
          <EmptyState
            icon="bi-broadcast-pin"
            title="No session activity"
            description="Start your first campaign from Blast to monitor it here"
            ctaLabel="Go To Blast"
            onCta={() => {
              window.location.href = '/blast';
            }}
          />
        </Card>
      ) : (
        <Row className="g-3">
          {filteredSessions.map((session) => {
            const sent = session.sent || 0;
            const total = session.total || 0;
            const failed = session.failed || 0;
            const progress = total > 0 ? Math.round((sent / total) * 100) : 0;
            const status = normalizeStatus(session);
            const running = session.status === 'running';

            return (
              <Col key={session.id} xl={4} md={6}>
                <Card className="surface-card hover-lift h-100">
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div>
                        <h3 className="mb-1" style={{ fontSize: 16 }}>{session.name}</h3>
                        <StatusBadge status={status} text={status.charAt(0).toUpperCase() + status.slice(1)} />
                      </div>
                      <Button variant="light" className="btn-outline-soft btn-sm" aria-label="Show QR">
                        <i className="bi bi-qr-code" />
                      </Button>
                    </div>

                    <ProgressBar
                      now={progress}
                      className="mb-3"
                      striped={running}
                      animated={running}
                      variant={running ? 'success' : 'secondary'}
                    />

                    <div className="d-flex justify-content-between mb-3 small">
                      <span>Sent <strong>{sent}</strong></span>
                      <span>Total <strong>{total}</strong></span>
                      <span className="text-danger">Failed <strong>{failed}</strong></span>
                    </div>

                    <div className="small text-secondary mb-3">
                      <i className="bi bi-phone me-1" />+62 8xx-xxxx-{String(session.id).padStart(3, '0')}
                    </div>

                    <div className="d-flex justify-content-between align-items-center small text-secondary mb-2">
                      <span>Last active</span>
                      <span>{new Date(session.updated_at || session.created_at).toLocaleString()}</span>
                    </div>

                    <div className="d-flex gap-2 mt-3">
                      <Button variant="light" className="btn-outline-soft flex-grow-1" onClick={() => openDetail(session)}>
                        View
                      </Button>
                      <Button variant="light" className="btn-outline-soft" onClick={stopSession} disabled={!running}>
                        Stop
                      </Button>
                      <Button variant="primary" onClick={() => rerunSession(session)}>
                        Rerun
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      <Modal show={detailOpen} onHide={() => setDetailOpen(false)} size="xl" centered>
        <Modal.Header closeButton>
          <Modal.Title>{selected?.name || 'Session Detail'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="g-3">
            <Col lg={8}>
              <Card className="surface-card">
                <Card.Body>
                  <h3 className="mb-3" style={{ fontSize: 16 }}>Send Rate Over Time</h3>
                  <div style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={logChartData}>
                        <XAxis dataKey="idx" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="sent" stroke="#25D366" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="failed" stroke="#dc3545" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card.Body>
              </Card>
            </Col>

            <Col lg={4}>
              <Card className="surface-card h-100">
                <Card.Body>
                  <h3 className="mb-3" style={{ fontSize: 16 }}>Blast Log</h3>
                  <div className="virtual-scroll" style={{ height: 260 }}>
                    {logs.map((log) => (
                      <div key={log.id} className="log-row">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="small fw-medium">{log.name || log.phone}</span>
                          <StatusBadge status={log.status === 'sent' ? 'success' : 'failed'} text={log.status} />
                        </div>
                        <div className="small text-secondary">{log.error_message || 'Delivered successfully'}</div>
                      </div>
                    ))}
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Modal.Body>
      </Modal>
    </div>
  );
}
