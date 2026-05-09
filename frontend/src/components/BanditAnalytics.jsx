import { memo, useEffect, useState } from 'react';
import { Card, Col, Row, Badge, Spinner, Alert } from 'react-bootstrap';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { banditAPI } from '../services/api';

const BanditAnalytics = memo(function BanditAnalytics({ policyId }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!policyId) return;

    const loadAnalytics = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log(`[BanditAnalytics] Loading analytics for policyId: ${policyId}`);
        const response = await banditAPI.getAnalytics(policyId);
        console.log('[BanditAnalytics] Response:', response.data);
        
        if (response.data?.success) {
          setAnalytics(response.data.analytics);
          console.log('[BanditAnalytics] Analytics set successfully:', response.data.analytics);
        } else {
          setError('Invalid response from server');
          setAnalytics(null);
        }
      } catch (err) {
        console.error('[BanditAnalytics] Error loading analytics:', err);
        setError(err.response?.data?.error || err.message || 'Failed to load analytics');
        setAnalytics(null);
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
    const interval = setInterval(loadAnalytics, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [policyId]);

  if (!policyId) {
    return (
      <Alert variant="info" className="mb-4">
        No bandit policy selected. Create a policy to see analytics.
      </Alert>
    );
  }

  if (loading && !analytics) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="success" />
        <p className="mt-3 text-muted">Loading bandit analytics...</p>
      </div>
    );
  }

  if (error && !analytics) {
    return (
      <Alert variant="danger" className="mb-4">
        {error}
      </Alert>
    );
  }

  if (!analytics || Object.keys(analytics).length === 0) {
    return (
      <Alert variant="warning" className="mb-4">
        No data yet. Run a campaign to see arm performance analytics.
      </Alert>
    );
  }

  const arms = Object.values(analytics).sort((a, b) => a.arm_id - b.arm_id);
  
  // Validate arms data
  if (arms.length === 0) {
    return (
      <Alert variant="danger" className="mb-4">
        Invalid analytics data received.
      </Alert>
    );
  }

  const bestArm = arms.reduce((best, curr) => {
    const currReward = Number(curr.avg_reward) || 0;
    const bestReward = Number(best.avg_reward) || 0;
    return currReward > bestReward ? curr : best;
  }, arms[0]);

  // Data for bar chart (avg reward comparison)
  const rewardChartData = arms.map(arm => ({
    arm: `Arm ${Number(arm.arm_id)}`,
    avg_reward: Number((arm.avg_reward || 0).toFixed(2)),
    total_reward: Number((arm.total_reward || 0).toFixed(2)),
  })).filter(item => !isNaN(item.avg_reward) && !isNaN(item.total_reward));

  // Data for line chart (success vs failure)
  const successChartData = arms.map(arm => ({
    arm: `Arm ${Number(arm.arm_id)}`,
    successful: Number(arm.successful_count || 0),
    failed: Number(arm.failed_count || 0),
  })).filter(item => !isNaN(item.successful) && !isNaN(item.failed));

  // Data for engagement metrics
  const engagementChartData = arms.map(arm => ({
    arm: `Arm ${Number(arm.arm_id)}`,
    read: Number(arm.read_count || 0),
    reply: Number(arm.reply_count || 0),
  })).filter(item => !isNaN(item.read) && !isNaN(item.reply));

  const getArmColor = (armId) => {
    const colors = ['#25D366', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];
    return colors[armId % colors.length];
  };

  return (
    <div className="bandit-analytics">
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <h5 className="mb-3">🤖 Multi-Armed Bandit - Arm Performance</h5>
          <p className="text-muted small">
            Best performing arm: <strong>Arm {bestArm.arm_id}</strong> with avg reward{' '}
            <Badge bg="success" className="ms-2">{bestArm.avg_reward.toFixed(2)}</Badge>
          </p>
        </Col>
      </Row>

      {/* Arm Cards */}
      <Row className="mb-4">
        {arms.map((arm) => {
          const successRate = arm.total_recommendations > 0 
            ? Math.round((arm.successful_count / arm.total_recommendations) * 100)
            : 0;
          const isOptimal = arm.arm_id === bestArm.arm_id;

          return (
            <Col md={6} lg={4} key={arm.arm_id} className="mb-3">
              <Card className={`h-100 ${isOptimal ? 'border-success border-3' : ''}`}>
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <h6 className="mb-0">Arm {arm.arm_id}</h6>
                    {isOptimal && <Badge bg="success">Best</Badge>}
                  </div>

                  <div className="arm-stats small">
                    <div className="stat-row d-flex justify-content-between mb-2">
                      <span className="text-muted">Recommendations:</span>
                      <strong>{arm.total_recommendations}</strong>
                    </div>
                    <div className="stat-row d-flex justify-content-between mb-2">
                      <span className="text-muted">Avg Reward:</span>
                      <strong className="text-success">{arm.avg_reward.toFixed(3)}</strong>
                    </div>
                    <div className="stat-row d-flex justify-content-between mb-2">
                      <span className="text-muted">Total Reward:</span>
                      <strong>{arm.total_reward.toFixed(1)}</strong>
                    </div>
                    <div className="stat-row d-flex justify-content-between mb-2">
                      <span className="text-muted">Success Rate:</span>
                      <strong className={successRate > 80 ? 'text-success' : 'text-warning'}>
                        {successRate}%
                      </strong>
                    </div>
                    <div className="stat-row d-flex justify-content-between mb-2">
                      <span className="text-muted">Delivered:</span>
                      <strong className="text-info">{arm.successful_count}</strong>
                    </div>
                    <div className="stat-row d-flex justify-content-between mb-2">
                      <span className="text-muted">Failed:</span>
                      <strong className="text-danger">{arm.failed_count}</strong>
                    </div>
                    <div className="stat-row d-flex justify-content-between">
                      <span className="text-muted">Engagement:</span>
                      <span>
                        👁️ {arm.read_count || 0}
                        <span className="ms-2">💬 {arm.reply_count || 0}</span>
                      </span>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* Charts */}
      <Row>
        {/* Average Reward Comparison */}
        <Col lg={6} className="mb-4">
          <Card>
            <Card.Header className="bg-light">
              <strong>Average Reward by Arm</strong>
            </Card.Header>
            <Card.Body>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={rewardChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="arm" />
                  <YAxis />
                  <Tooltip formatter={(value) => value.toFixed(3)} />
                  <Bar dataKey="avg_reward" radius={[8, 8, 0, 0]}>
                    {rewardChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getArmColor(index)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card.Body>
          </Card>
        </Col>

        {/* Success vs Failure */}
        <Col lg={6} className="mb-4">
          <Card>
            <Card.Header className="bg-light">
              <strong>Delivery Success vs Failure</strong>
            </Card.Header>
            <Card.Body>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={successChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="arm" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="successful" stackId="a" fill="#22c55e" />
                  <Bar dataKey="failed" stackId="a" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </Card.Body>
          </Card>
        </Col>

        {/* Engagement Metrics */}
        <Col lg={6} className="mb-4">
          <Card>
            <Card.Header className="bg-light">
              <strong>Engagement Metrics (Read & Reply)</strong>
            </Card.Header>
            <Card.Body>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={engagementChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="arm" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="read" stroke="#3b82f6" strokeWidth={2} />
                  <Line type="monotone" dataKey="reply" stroke="#f59e0b" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card.Body>
          </Card>
        </Col>

        {/* Total Reward Comparison */}
        <Col lg={6} className="mb-4">
          <Card>
            <Card.Header className="bg-light">
              <strong>Total Reward Accumulation</strong>
            </Card.Header>
            <Card.Body>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={rewardChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="arm" />
                  <YAxis />
                  <Tooltip formatter={(value) => value.toFixed(1)} />
                  <Bar dataKey="total_reward" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Data Table */}
      <Row>
        <Col className="mb-4">
          <Card>
            <Card.Header className="bg-light">
              <strong>Detailed Arm Statistics</strong>
            </Card.Header>
            <Card.Body style={{ overflowX: 'auto' }}>
              <table className="table table-sm table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Arm</th>
                    <th>Recommendations</th>
                    <th>Avg Reward</th>
                    <th>Total Reward</th>
                    <th>Success</th>
                    <th>Failed</th>
                    <th>Read</th>
                    <th>Reply</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {arms.map((arm) => (
                    <tr key={arm.arm_id} className={arm.arm_id === bestArm.arm_id ? 'table-success' : ''}>
                      <td>
                        <strong>#{arm.arm_id}</strong>
                      </td>
                      <td>{arm.total_recommendations}</td>
                      <td className="text-success">
                        <strong>{arm.avg_reward.toFixed(3)}</strong>
                      </td>
                      <td>{arm.total_reward.toFixed(1)}</td>
                      <td>
                        <span className="badge bg-success">{arm.successful_count}</span>
                      </td>
                      <td>
                        <span className="badge bg-danger">{arm.failed_count}</span>
                      </td>
                      <td>{arm.read_count || 0}</td>
                      <td>{arm.reply_count || 0}</td>
                      <td>
                        {arm.arm_id === bestArm.arm_id ? (
                          <Badge bg="success">⭐ Best</Badge>
                        ) : (
                          <Badge bg="secondary">Active</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <style>{`
        .arm-stats {
          font-size: 0.875rem;
        }
        .stat-row {
          border-bottom: 1px solid #f0f0f0;
          padding: 0.25rem 0;
        }
        .stat-row:last-child {
          border-bottom: none;
        }
        .bandit-analytics .table-hover tbody tr:hover {
          background-color: rgba(37, 211, 102, 0.05);
        }
      `}</style>
    </div>
  );
});

export default BanditAnalytics;
