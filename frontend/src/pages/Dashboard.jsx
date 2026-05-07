import { memo, useEffect, useMemo, useState } from 'react';
import { Card, Col, Row } from 'react-bootstrap';
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import KPICard from '../components/KPICard';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import DataTable from '../components/DataTable';
import SkeletonCard from '../components/SkeletonCard';
import BanditAnalytics from '../components/BanditAnalytics';
import { blastAPI, contactsAPI, banditAPI } from '../services/api';

const StatusDonut = memo(function StatusDonut({ data }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="value" innerRadius={70} outerRadius={96} paddingAngle={2}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
});

const BlastArea = memo(function BlastArea({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ left: -18, right: 6, top: 12, bottom: 0 }}>
        <defs>
          <linearGradient id="blastFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#25D366" stopOpacity={0.33} />
            <stop offset="95%" stopColor="#25D366" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <Tooltip />
        <Area type="monotone" dataKey="sent" stroke="#25D366" fill="url(#blastFill)" strokeWidth={3} />
      </AreaChart>
    </ResponsiveContainer>
  );
});

function getDayLabel(date) {
  return new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isNaN(t) ? 0 : t;
  }
  if (typeof value === 'object') {
    if (typeof value._seconds === 'number') return value._seconds * 1000;
    if (typeof value.seconds === 'number') return value.seconds * 1000;
  }
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export default function Dashboard() {
  const banditEnabled = import.meta.env.VITE_ENABLE_BANDIT === 'true';
  const [loading, setLoading] = useState(true);
  const [contactsTotal, setContactsTotal] = useState(0);
  const [sessions, setSessions] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [selectedPolicy, setSelectedPolicy] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const [contactsRes, sessionRes, policiesRes] = await Promise.allSettled([
          contactsAPI.getAll(),
          blastAPI.getSessions(),
          banditEnabled
            ? banditAPI.getPolicies().catch(() => ({ data: { success: false, policies: [] } }))
            : Promise.resolve({ data: { success: false, policies: [] } })
        ]);
        if (!mounted) return;

        const contactsData = contactsRes.status === 'fulfilled' ? contactsRes.value.data || [] : [];
        const sessionsData = sessionRes.status === 'fulfilled' ? sessionRes.value.data || [] : [];
        const policiesData = policiesRes.status === 'fulfilled' ? policiesRes.value.data : { success: false, policies: [] };

        setContactsTotal(Array.isArray(contactsData) ? contactsData.length : 0);
        setSessions((sessionsData || []).slice().sort((a, b) => toMillis(b.created_at) - toMillis(a.created_at)));

        if (policiesData?.success && policiesData.policies?.length > 0) {
          setPolicies(policiesData.policies);
          setSelectedPolicy(policiesData.policies[0].id);
        } else {
          setPolicies([]);
          setSelectedPolicy(null);
        }
      } catch (error) {
        if (mounted) {
          setContactsTotal(0);
          setSessions([]);
          setPolicies([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const summary = useMemo(() => {
    const sent = sessions.reduce((acc, s) => acc + (s.sent || 0), 0);
    const failed = sessions.reduce((acc, s) => acc + (s.failed || 0), 0);
    const total = sent + failed;
    const successRate = total > 0 ? Math.round((sent / total) * 100) : 0;
    const activeSessions = sessions.filter((s) => s.status === 'running').length;

    return {
      sent,
      failed,
      activeSessions,
      successRate,
    };
  }, [sessions]);

  const areaData = useMemo(() => {
    const map = new Map();
    const now = new Date();

    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      map.set(key, { day: getDayLabel(d), sent: 0 });
    }

    sessions.forEach((session) => {
      const createdAtMillis = toMillis(session.created_at);
      if (!createdAtMillis) return;
      const key = new Date(createdAtMillis).toISOString().slice(0, 10);
      if (map.has(key)) {
        map.get(key).sent += session.sent || 0;
      }
    });

    return [...map.values()];
  }, [sessions]);

  const donutData = useMemo(() => {
    const sent = summary.sent;
    const read = Math.round(sent * 0.62);
    const delivered = Math.max(sent - read, 0);

    return [
      { name: 'Delivered', value: delivered, color: '#25D366' },
      { name: 'Read', value: read, color: '#128C7E' },
      { name: 'Failed', value: summary.failed, color: '#dc3545' },
    ];
  }, [summary]);

  const columns = [
    { key: 'campaign', label: 'Campaign' },
    { key: 'status', label: 'Status' },
    { key: 'contacts', label: 'Contacts' },
    { key: 'sent', label: 'Sent' },
    { key: 'time', label: 'Time' },
  ];

  const activities = sessions.slice(0, 8).map((session) => ({
    id: session.id,
    name: session.name || `Blast #${session.id}`,
    status: session.status,
    contacts: session.total || 0,
    sent: session.sent || 0,
    time: new Date(toMillis(session.created_at) || Date.now()).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  }));

  return (
    <div className="page-enter-active">
      <PageHeader
        title="Dashboard"
        subtitle="Real-time overview of message performance and delivery health"
      />

      <Row className="g-3 mb-4 kpi-mobile-two">
        {loading ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <Col xl={3} md={6} key={idx}>
              <SkeletonCard />
            </Col>
          ))
        ) : (
          <>
            <Col xl={3} md={6}>
              <KPICard icon="bi-people" label="Total Contacts" value={contactsTotal.toLocaleString()} trend="8% this week" />
            </Col>
            <Col xl={3} md={6}>
              <KPICard icon="bi-send-check" label="Messages Sent" value={summary.sent.toLocaleString()} trend="11% this week" />
            </Col>
            <Col xl={3} md={6}>
              <KPICard icon="bi-broadcast" label="Active Sessions" value={summary.activeSessions} trend="2 live" />
            </Col>
            <Col xl={3} md={6}>
              <KPICard
                icon="bi-check-circle"
                label="Success Rate"
                value={`${summary.successRate}%`}
                trend={`${Math.max(summary.successRate - 80, 0)}% this week`}
                trendType={summary.successRate < 70 ? 'down' : 'up'}
              />
            </Col>
          </>
        )}
      </Row>

      <Row className="g-3 mb-4 charts-stack-mobile">
        <Col lg={8}>
          <Card className="surface-card hover-lift h-100">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h3 className="mb-0">7-Day Blast Performance</h3>
                <StatusBadge status="success" text="Live" />
              </div>
              <BlastArea data={areaData} />
            </Card.Body>
          </Card>
        </Col>

        <Col lg={4}>
          <Card className="surface-card hover-lift h-100">
            <Card.Body>
              <h3 className="mb-3">Status Breakdown</h3>
              <StatusDonut data={donutData} />
              <div className="d-flex flex-wrap gap-2 justify-content-center mt-2">
                {donutData.map((item) => (
                  <span key={item.name} className="small d-inline-flex align-items-center gap-1">
                    <span className="status-dot" style={{ background: item.color }} />
                    {item.name}
                  </span>
                ))}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="surface-card hover-lift">
        <Card.Body className="p-0">
          <div className="p-3 border-bottom">
            <h3 className="mb-0">Recent Activity</h3>
          </div>
          <DataTable
            columns={columns}
            rows={activities}
            renderRow={(item) => (
              <tr key={item.id}>
                <td className="fw-medium">{item.name}</td>
                <td>
                  <StatusBadge status={item.status} text={item.status} />
                </td>
                <td>{item.contacts}</td>
                <td>{item.sent}</td>
                <td className="text-secondary">{item.time}</td>
              </tr>
            )}
          />
        </Card.Body>
      </Card>

      {/* Bandit Analytics Quick Preview */}
      {policies.length > 0 && (
        <Row className="g-3 mb-4">
          <Col>
            <Card className="border-top border-success border-3">
              <Card.Header className="bg-light">
                <div className="d-flex justify-content-between align-items-center">
                  <strong>🤖 Bandit Analytics Preview</strong>
                  <a href="/bandit" className="btn btn-sm btn-outline-success">View Full Analytics →</a>
                </div>
              </Card.Header>
              <Card.Body>
                <BanditAnalytics policyId={selectedPolicy} />
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
}
