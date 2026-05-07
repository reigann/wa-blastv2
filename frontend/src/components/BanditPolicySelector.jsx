import { useState, useEffect } from 'react';
import { Card, Row, Col, Badge, Alert, Spinner, Button } from 'react-bootstrap';
import { banditAPI } from '../services/api';

export default function BanditPolicySelector({ onPolicySelect, selectedPolicy }) {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPolicies();
  }, []);

  const loadPolicies = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await banditAPI.getPolicies();
      if (response.data?.success) {
        setPolicies(response.data.policies);
      }
    } catch (err) {
      setError('Failed to load policies');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <Spinner animation="border" variant="success" size="sm" />
        <p className="text-muted small mt-2">Loading policies...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger" className="mb-0">
        {error}
      </Alert>
    );
  }

  if (policies.length === 0) {
    return (
      <Alert variant="info" className="mb-0">
        No policies found. Run init script to create default policies.
      </Alert>
    );
  }

  return (
    <div className="bandit-policy-selector">
      <label className="form-label fw-bold mb-2">
        🤖 Optimize Campaign with Bandit (Optional)
      </label>

      <Row className="g-2 mb-3">
        {policies.map((policy) => {
          const isSelected = selectedPolicy?.id === policy.id;
          const armCount = policy.arms;
          const policyType = policy.name.includes('template') ? 'template' : 'timing';

          return (
            <Col md={6} key={policy.id}>
              <Card
                className={`cursor-pointer policy-card h-100 ${
                  isSelected ? 'border-success border-3 bg-light' : 'border-secondary'
                }`}
                onClick={() => onPolicySelect(policy)}
                style={{ cursor: 'pointer' }}
              >
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <h6 className="mb-0 d-flex align-items-center gap-2">
                        {policyType === 'template' ? '📝' : '⏰'}
                        {policy.name.replace(/_/g, ' ')}
                        {isSelected && <Badge bg="success">Selected</Badge>}
                      </h6>
                    </div>
                  </div>

                  <small className="text-muted d-block mb-2">
                    {policyType === 'template'
                      ? 'Optimize message type & format'
                      : 'Optimize sending time'}
                  </small>

                  <div className="policy-arms small">
                    <Badge bg="light" text="dark" className="me-1">
                      {armCount} strategies
                    </Badge>
                    {policyType === 'template' && (
                      <>
                        <Badge bg="light" text="dark" className="me-1">
                          Short text
                        </Badge>
                        <Badge bg="light" text="dark" className="me-1">
                          Medium text
                        </Badge>
                        <Badge bg="light" text="dark">
                          + Media
                        </Badge>
                      </>
                    )}
                    {policyType === 'timing' && (
                      <>
                        <Badge bg="light" text="dark" className="me-1">
                          🌅 Morning
                        </Badge>
                        <Badge bg="light" text="dark" className="me-1">
                          ☀️ Afternoon
                        </Badge>
                        <Badge bg="light" text="dark">
                          🌙 Evening
                        </Badge>
                      </>
                    )}
                  </div>
                </Card.Body>
              </Card>
            </Col>
          );
        })}
      </Row>

      {selectedPolicy && (
        <Alert variant="success" className="mb-0 py-2">
          <small>
            ✅ Using <strong>{selectedPolicy.name}</strong> - System will auto-optimize for
            {selectedPolicy.name.includes('template')
              ? ' best message format'
              : ' best sending time'}
          </small>
        </Alert>
      )}
    </div>
  );
}
