import { memo, useEffect, useState } from 'react';
import { Card, Col, Row, Badge, Spinner, Alert, Tab, Tabs, Table } from 'react-bootstrap';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { banditAPI, templatesAPI } from '../services/api';

const BanditStatsEnhanced = memo(function BanditStatsEnhanced({ policyId, sessionId }) {
  const [stats, setStats] = useState(null);
  const [policyStats, setPolicyStats] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [learningProgress, setLearningProgress] = useState(null);
  const [recentEvents, setRecentEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [templateRecommendation, setTemplateRecommendation] = useState(null);

  useEffect(() => {
    if (!policyId && !sessionId) return;

    const loadStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const dateParams = {};
        if (startDate) dateParams.start_date = startDate;
        if (endDate) dateParams.end_date = endDate;

        // Load policy stats
        if (policyId) {
          const pResponse = await banditAPI.getPolicyStats(policyId, dateParams);
          if (pResponse.data?.success) {
            setPolicyStats(pResponse.data.analytics);
          }

          // Load breakdown
          const bResponse = await banditAPI.getEventBreakdown(policyId, dateParams);
          if (bResponse.data?.success) {
            setBreakdown(bResponse.data.breakdown);
          }

          // Load learning progress
          const lResponse = await banditAPI.getLearningProgress(policyId, dateParams);
          if (lResponse.data?.success) {
            setLearningProgress(lResponse.data.progress);
          }

          // Load recent events
          const eResponse = await banditAPI.getRecentEvents(policyId, 50, dateParams);
          if (eResponse.data?.success) {
            setRecentEvents(eResponse.data.events || []);
          }

          const templateRes = await templatesAPI.getAll();
          const templateIds = Array.isArray(templateRes.data) ? templateRes.data.map((t) => t.id) : [];
          if (templateIds.length > 0) {
            const tResponse = await banditAPI.recommendTemplate(templateIds, policyId, startDate || null, endDate || null);
            if (tResponse.data?.success) {
              setTemplateRecommendation(tResponse.data.recommendation || null);
            } else {
              setTemplateRecommendation(null);
            }
          } else {
            setTemplateRecommendation(null);
          }
        }

        // Load session stats
        if (sessionId) {
          const sResponse = await banditAPI.getSessionStats(sessionId);
          if (sResponse.data?.success) {
            setStats(sResponse.data.stats);
          }
        }
      } catch (err) {
        console.error('Failed to load stats:', err);
        setError(err.response?.data?.error || 'Failed to load statistics');
      } finally {
        setLoading(false);
      }
    };

    loadStats();
    const interval = setInterval(loadStats, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [policyId, sessionId, startDate, endDate]);

  if (loading && !policyStats && !stats) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="success" />
        <p className="mt-3 text-muted">Loading statistics...</p>
      </div>
    );
  }

  if (error && !policyStats && !stats) {
    return <Alert variant="danger">{error}</Alert>;
  }

  const getStatusBadge = (status) => {
    if (status === 'delivered') return <Badge bg="success">✓ Delivered</Badge>;
    if (status === 'failed') return <Badge bg="danger">✗ Failed</Badge>;
    if (status === 'sent') return <Badge bg="info">→ Sent</Badge>;
    return <Badge bg="secondary">Pending</Badge>;
  };

  const overallChartData = policyStats?.overall ? [
    { name: 'Delivery', value: Number(policyStats.overall.delivery_rate || 0), fill: '#22c55e' },
    { name: 'Read', value: Number(policyStats.overall.read_rate || 0), fill: '#0ea5e9' },
    { name: 'Reply', value: Number(policyStats.overall.reply_rate || 0), fill: '#f59e0b' },
    { name: 'Failure', value: Number(policyStats.overall.failure_rate || 0), fill: '#ef4444' },
  ] : [];

  const armChartData = policyStats?.arms
    ? Object.values(policyStats.arms).map((arm) => ({
        arm: `Arm ${arm.arm}`,
        sent: Number(arm.sent_count || 0),
        delivered: Number(arm.delivered_count || 0),
        read: Number(arm.read_count || 0),
        replied: Number(arm.replied_count || 0),
        avg_reward: Number(arm.avg_reward || 0),
      }))
    : [];

  return (
    <div className="bandit-stats-enhanced">
      <Card className="mb-3">
        <Card.Body className="py-2">
          <Row className="g-2 align-items-end">
            <Col md={3}>
              <label className="form-label small mb-1">From</label>
              <input className="form-control form-control-sm" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Col>
            <Col md={3}>
              <label className="form-label small mb-1">To</label>
              <input className="form-control form-control-sm" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Col>
            <Col md={3}>
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
              >
                Reset Filter
              </button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {templateRecommendation?.recommended_template_id && (
        <Card className="mb-3 border-warning">
          <Card.Body className="py-2">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <strong>Best Template (Bandit)</strong>
                <div className="small text-muted">
                  Template ID: {templateRecommendation.recommended_template_id}
                </div>
              </div>
              <Badge bg="warning" text="dark">Recommended</Badge>
            </div>
            {Array.isArray(templateRecommendation.candidates) && templateRecommendation.candidates.length > 0 && (
              <div className="small mt-2">
                Top score: {templateRecommendation.candidates[0].score} | Read: {templateRecommendation.candidates[0].read_rate}% | Reply: {templateRecommendation.candidates[0].reply_rate}%
              </div>
            )}
          </Card.Body>
        </Card>
      )}

      <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-4">
        {/* OVERVIEW TAB */}
        <Tab eventKey="overview" title="📊 Overview">
          {/* Session Stats Cards */}
          {stats && (
            <Row className="mb-4">
              <Col md={6} lg={3} className="mb-3">
                <Card className="text-center">
                  <Card.Body>
                    <h6 className="text-muted mb-2">Sent</h6>
                    <h2 className="mb-0 text-primary">{stats.stats?.sent || 0}</h2>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={6} lg={3} className="mb-3">
                <Card className="text-center">
                  <Card.Body>
                    <h6 className="text-muted mb-2">Delivered</h6>
                    <h2 className="mb-0 text-success">{stats.stats?.delivered || 0}</h2>
                    <small className="text-muted">{stats.stats?.delivery_rate}%</small>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={6} lg={3} className="mb-3">
                <Card className="text-center">
                  <Card.Body>
                    <h6 className="text-muted mb-2">Read</h6>
                    <h2 className="mb-0 text-info">{stats.stats?.read || 0}</h2>
                    <small className="text-muted">{stats.stats?.read_rate}%</small>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={6} lg={3} className="mb-3">
                <Card className="text-center">
                  <Card.Body>
                    <h6 className="text-muted mb-2">Replied</h6>
                    <h2 className="mb-0 text-warning">{stats.stats?.replied || 0}</h2>
                    <small className="text-muted">{stats.stats?.reply_rate}%</small>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          )}

          {/* Policy Stats Overview */}
          {policyStats && (
            <Row>
              <Col lg={8}>
                <Card className="mb-4">
                  <Card.Header className="bg-light">
                    <strong>Policy Performance Overview</strong>
                  </Card.Header>
                  <Card.Body>
                    <Row className="text-center">
                      <Col md={3}>
                        <h6 className="text-muted">Total Events</h6>
                        <h3 className="text-primary">{policyStats.total_events}</h3>
                      </Col>
                      <Col md={3}>
                        <h6 className="text-muted">Avg Reward</h6>
                        <h3 className="text-success">{policyStats.overall?.avg_reward}</h3>
                      </Col>
                      <Col md={3}>
                        <h6 className="text-muted">Delivery Rate</h6>
                        <h3 className="text-info">{policyStats.overall?.delivery_rate}%</h3>
                      </Col>
                      <Col md={3}>
                        <h6 className="text-muted">Reply Rate</h6>
                        <h3 className="text-warning">{policyStats.overall?.reply_rate}%</h3>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              </Col>

              <Col lg={4}>
                <Card className="mb-4">
                  <Card.Header className="bg-light">
                    <strong>Event Status</strong>
                  </Card.Header>
                  <Card.Body>
                    <div className="mb-2">
                      <div className="d-flex justify-content-between mb-1">
                        <span>Completed</span>
                        <strong>{policyStats.completed_events}</strong>
                      </div>
                      <div className="progress">
                        <div className="progress-bar bg-success" style={{ width: `${(policyStats.completed_events / policyStats.total_events * 100) || 0}%` }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="d-flex justify-content-between">
                        <span>Pending</span>
                        <strong>{policyStats.pending_events}</strong>
                      </div>
                      <div className="progress">
                        <div className="progress-bar bg-warning" style={{ width: `${(policyStats.pending_events / policyStats.total_events * 100) || 0}%` }}></div>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          )}

          {policyStats && (
            <Row className="mt-1">
              <Col lg={6} className="mb-4">
                <Card>
                  <Card.Header className="bg-light">
                    <strong>Performance Rates (%)</strong>
                  </Card.Header>
                  <Card.Body>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={overallChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip formatter={(value) => `${Number(value || 0).toFixed(1)}%`} />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                          {overallChartData.map((entry) => (
                            <Cell key={entry.name} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Card.Body>
                </Card>
              </Col>

              <Col lg={6} className="mb-4">
                <Card>
                  <Card.Header className="bg-light">
                    <strong>Arm Engagement Comparison</strong>
                  </Card.Header>
                  <Card.Body>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={armChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="arm" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="delivered" fill="#22c55e" name="Delivered" />
                        <Bar dataKey="read" fill="#0ea5e9" name="Read" />
                        <Bar dataKey="replied" fill="#f59e0b" name="Replied" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          )}
        </Tab>

        {/* ARM COMPARISON TAB */}
        <Tab eventKey="arms" title="🎯 Arm Performance">
          {policyStats && policyStats.arms && (
            <>
              <Row className="mb-4">
                {Object.values(policyStats.arms || {}).map((arm) => (
                  <Col md={6} lg={4} key={arm.arm} className="mb-3">
                    <Card>
                      <Card.Body>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <h6 className="mb-0">Arm {arm.arm}</h6>
                          {arm.avg_reward > 0.7 && <Badge bg="success">Top</Badge>}
                        </div>
                        <table className="table table-sm mb-0">
                          <tbody>
                            <tr>
                              <td className="text-muted">Sent</td>
                              <td className="text-end"><strong>{arm.sent_count}</strong></td>
                            </tr>
                            <tr>
                              <td className="text-muted">Delivered</td>
                              <td className="text-end"><strong>{arm.delivered_count}</strong></td>
                            </tr>
                            <tr>
                              <td className="text-muted">Delivery Rate</td>
                              <td className="text-end"><strong>{arm.delivery_rate}%</strong></td>
                            </tr>
                            <tr>
                              <td className="text-muted">Avg Reward</td>
                              <td className="text-end"><Badge bg="info">{arm.avg_reward}</Badge></td>
                            </tr>
                            <tr>
                              <td className="text-muted">Read / Reply</td>
                              <td className="text-end"><strong>{arm.read_count} / {arm.replied_count}</strong></td>
                            </tr>
                          </tbody>
                        </table>
                      </Card.Body>
                    </Card>
                  </Col>
                ))}
              </Row>
            </>
          )}
        </Tab>

        {/* BREAKDOWN TAB */}
        <Tab eventKey="breakdown" title="📈 Breakdown">
          {breakdown && (
            <Row>
              <Col lg={6} className="mb-4">
                <Card>
                  <Card.Header className="bg-light">
                    <strong>Delivery Status Distribution</strong>
                  </Card.Header>
                  <Card.Body>
                    <table className="table">
                      <tbody>
                        <tr>
                          <td>Pending</td>
                          <td className="text-end"><Badge bg="secondary">{breakdown.breakdown?.by_delivery_status?.pending || 0}</Badge></td>
                        </tr>
                        <tr>
                          <td>Sent</td>
                          <td className="text-end"><Badge bg="info">{breakdown.breakdown?.by_delivery_status?.sent || 0}</Badge></td>
                        </tr>
                        <tr>
                          <td>Delivered</td>
                          <td className="text-end"><Badge bg="success">{breakdown.breakdown?.by_delivery_status?.delivered || 0}</Badge></td>
                        </tr>
                        <tr>
                          <td>Failed</td>
                          <td className="text-end"><Badge bg="danger">{breakdown.breakdown?.by_delivery_status?.failed || 0}</Badge></td>
                        </tr>
                      </tbody>
                    </table>
                  </Card.Body>
                </Card>
              </Col>

              <Col lg={6} className="mb-4">
                <Card>
                  <Card.Header className="bg-light">
                    <strong>Engagement & Reward Status</strong>
                  </Card.Header>
                  <Card.Body>
                    <table className="table">
                      <tbody>
                        <tr>
                          <td>Read</td>
                          <td className="text-end"><Badge bg="info">{breakdown.breakdown?.by_read_status?.read || 0}</Badge></td>
                        </tr>
                        <tr>
                          <td>Unread</td>
                          <td className="text-end"><Badge bg="secondary">{breakdown.breakdown?.by_read_status?.unread || 0}</Badge></td>
                        </tr>
                        <tr>
                          <td>Replied</td>
                          <td className="text-end"><Badge bg="success">{breakdown.breakdown?.by_reply_status?.replied || 0}</Badge></td>
                        </tr>
                        <tr>
                          <td>No Reply</td>
                          <td className="text-end"><Badge bg="secondary">{breakdown.breakdown?.by_reply_status?.no_reply || 0}</Badge></td>
                        </tr>
                        <tr>
                          <td>Rewarded</td>
                          <td className="text-end"><Badge bg="success">{breakdown.breakdown?.by_reward_status?.rewarded || 0}</Badge></td>
                        </tr>
                        <tr>
                          <td>Pending Reward</td>
                          <td className="text-end"><Badge bg="warning">{breakdown.breakdown?.by_reward_status?.pending_reward || 0}</Badge></td>
                        </tr>
                      </tbody>
                    </table>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          )}
        </Tab>

        {/* LEARNING PROGRESS TAB */}
        <Tab eventKey="learning" title="📚 Learning Progress">
          {learningProgress && learningProgress.timeline && (
            <>
              <Card className="mb-4">
                <Card.Header className="bg-light">
                  <strong>Learning Timeline</strong>
                </Card.Header>
                <Card.Body>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={learningProgress.timeline || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="phase" label={{ value: 'Phase', position: 'insideBottomRight', offset: -5 }} />
                      <YAxis label={{ value: 'Avg Reward', angle: -90, position: 'insideLeft' }} />
                      <Tooltip formatter={(value) => {
                        const num = Number(value);
                        return Number.isFinite(num) ? num.toFixed(3) : '0.000';
                      }} />
                      <Legend />
                      <Line type="monotone" dataKey="avg_reward" stroke="#10b981" strokeWidth={2} name="Avg Reward" />
                    </LineChart>
                  </ResponsiveContainer>
                </Card.Body>
              </Card>

              <Card>
                <Card.Header className="bg-light">
                  <strong>Improvement Analysis</strong>
                </Card.Header>
                <Card.Body>
                  <Row className="text-center">
                    <Col md={4}>
                      <h6 className="text-muted">Initial Avg Reward</h6>
                      <h3 className="text-info">{learningProgress.improvement?.first_phase_avg_reward}</h3>
                    </Col>
                    <Col md={4}>
                      <h6 className="text-muted">Current Avg Reward</h6>
                      <h3 className="text-success">{learningProgress.improvement?.last_phase_avg_reward}</h3>
                    </Col>
                    <Col md={4}>
                      <h6 className="text-muted">Improvement</h6>
                      <h3 className={learningProgress.improvement?.avg_reward_change >= 0 ? 'text-success' : 'text-danger'}>
                        {learningProgress.improvement?.avg_reward_change}%
                      </h3>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </>
          )}
        </Tab>

        {/* RECENT EVENTS TAB */}
        <Tab eventKey="events" title="📋 Recent Events">
          <Card>
            <Card.Header className="bg-light">
              <strong>Latest Events (Last 50)</strong>
            </Card.Header>
            <Card.Body style={{ overflowX: 'auto' }}>
              <Table striped hover size="sm">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Arm</th>
                    <th>Delivery</th>
                    <th>Read</th>
                    <th>Reply</th>
                    <th>Reward</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEvents.slice(0, 50).map((ev) => (
                    <tr key={ev.id}>
                      <td className="small">{ev.id}</td>
                      <td><Badge bg="secondary">Arm {ev.arm}</Badge></td>
                      <td>{getStatusBadge(ev.delivery_status)}</td>
                      <td>{ev.read_status === 1 ? '👁' : '-'}</td>
                      <td>{ev.reply_received === 1 ? '💬' : '-'}</td>
                      <td>
                        {ev.reward !== null ? (
                          <Badge bg={ev.reward > 0 ? 'success' : 'danger'}>
                            {ev.reward.toFixed(2)}
                          </Badge>
                        ) : (
                          <Badge bg="warning">Pending</Badge>
                        )}
                      </td>
                      <td className="small text-muted">{new Date(ev.created_at_iso).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>
    </div>
  );
});

export default BanditStatsEnhanced;
