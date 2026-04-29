import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Col, Form, Row } from 'react-bootstrap';
import Papa from 'papaparse';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { blastAPI } from '../services/api';

const rowHeight = 66;

function inferLevel(log) {
  if (log.status === 'sent') return 'SUCCESS';
  if ((log.error_message || '').toLowerCase().includes('warn')) return 'WARN';
  if (log.error_message) return 'ERROR';
  return 'INFO';
}

export default function Logs() {
  const [entries, setEntries] = useState([]);
  const [query, setQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = setInterval(loadLogs, 5000);
    return () => clearInterval(timer);
  }, [autoRefresh]);

  async function loadLogs() {
    try {
      const sessionsRes = await blastAPI.getSessions();
      const sessions = (sessionsRes.data || []).slice(0, 10);
      const logsPerSession = await Promise.all(
        sessions.map(async (session) => {
          try {
            const logRes = await blastAPI.getSessionLogs(session.id);
            return (logRes.data || []).map((log) => ({
              ...log,
              session_name: session.name,
              timestamp: log.sent_at || session.created_at,
              level: inferLevel(log),
              message: log.error_message || `${log.name || log.phone} ${log.status}`,
              stack: log.error_message ? `Session ${session.id}: ${log.error_message}` : '',
            }));
          } catch (error) {
            return [];
          }
        }),
      );

      setEntries(
        logsPerSession
          .flat()
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
      );
    } catch (error) {
      setEntries([]);
    }
  }

  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      const text = `${entry.session_name} ${entry.message} ${entry.phone || ''}`.toLowerCase();
      const level = entry.level || 'INFO';

      const matchQuery = text.includes(query.toLowerCase());
      const matchLevel = levelFilter === 'ALL' || level === levelFilter;

      const entryDate = new Date(entry.timestamp);
      const fromOk = !dateFrom || entryDate >= new Date(dateFrom);
      const toOk = !dateTo || entryDate <= new Date(`${dateTo}T23:59:59`);

      return matchQuery && matchLevel && fromOk && toOk;
    });
  }, [entries, query, levelFilter, dateFrom, dateTo]);

  const height = 470;
  const visibleCount = Math.ceil(height / rowHeight) + 6;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 3);
  const end = Math.min(filtered.length, start + visibleCount);

  const visible = filtered.slice(start, end);
  const topPad = start * rowHeight;
  const bottomPad = Math.max(0, (filtered.length - end) * rowHeight);

  function exportCsv() {
    const csv = Papa.unparse(
      filtered.map((entry) => ({
        timestamp: entry.timestamp,
        level: entry.level,
        session: entry.session_name,
        phone: entry.phone,
        message: entry.message,
      })),
    );

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `blast-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  }

  return (
    <div className="page-enter-active">
      <PageHeader
        title="Logs"
        subtitle="Inspect delivery events, errors, and stack traces in near real-time"
        actions={[
          <Button key="export" variant="light" className="btn-outline-soft" onClick={exportCsv}>
            <i className="bi bi-download me-2" />Export CSV
          </Button>,
        ]}
      />

      <Card className="surface-card mb-3">
        <Card.Body>
          <Row className="g-2 align-items-center">
            <Col md={2}>
              <Form.Control type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </Col>
            <Col md={2}>
              <Form.Control type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </Col>
            <Col md={2}>
              <Form.Select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}>
                <option value="ALL">All Levels</option>
                <option value="INFO">INFO</option>
                <option value="WARN">WARN</option>
                <option value="ERROR">ERROR</option>
                <option value="SUCCESS">SUCCESS</option>
              </Form.Select>
            </Col>
            <Col md={4}>
              <Form.Control
                placeholder="Search logs"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </Col>
            <Col md={2}>
              <Form.Check
                type="switch"
                checked={autoRefresh}
                label="Auto 5s"
                onChange={(event) => setAutoRefresh(event.target.checked)}
              />
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="surface-card">
        <div
          className="virtual-scroll"
          ref={containerRef}
          style={{ height }}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        >
          {topPad > 0 ? <div style={{ height: topPad }} /> : null}

          {visible.map((entry) => {
            const isOpen = Boolean(expanded[entry.id]);
            const level = entry.level.toLowerCase();
            return (
              <div key={`${entry.id}-${entry.timestamp}`} className="log-row">
                <div className="d-flex align-items-start gap-3">
                  <div style={{ minWidth: 76 }}>
                    <StatusBadge status={level} text={entry.level} />
                  </div>

                  <div className="flex-grow-1">
                    <div className="log-time text-secondary">{new Date(entry.timestamp).toLocaleString()}</div>
                    <div className="fw-medium">{entry.message}</div>
                    {isOpen && entry.stack ? <pre className="small mt-2 mb-0">{entry.stack}</pre> : null}
                  </div>

                  <button
                    className="btn btn-sm btn-light border"
                    onClick={() => setExpanded((prev) => ({ ...prev, [entry.id]: !prev[entry.id] }))}
                    aria-label="Toggle stack trace"
                  >
                    <i className={`bi ${isOpen ? 'bi-chevron-up' : 'bi-chevron-down'}`} />
                  </button>
                </div>
              </div>
            );
          })}

          {bottomPad > 0 ? <div style={{ height: bottomPad }} /> : null}
        </div>
      </Card>
    </div>
  );
}
