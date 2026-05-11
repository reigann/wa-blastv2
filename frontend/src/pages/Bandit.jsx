import { Container, Alert, Spinner } from 'react-bootstrap';
import { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import BanditStatsEnhanced from '../components/BanditStatsEnhanced';
import { banditAPI } from '../services/api';

export default function BanditPage() {
  const [policies, setPolicies] = useState([]);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPolicies();
  }, []);

  const loadPolicies = async () => {
    try {
      setError(null);
      const response = await banditAPI.getPolicies();
      if (response.data?.success && response.data.policies) {
        setPolicies(response.data.policies);
        if (response.data.policies.length > 0 && !selectedPolicy) {
          setSelectedPolicy(response.data.policies[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load policies:', err);
      setError(err.response?.data?.error || 'Gagal memuat policy bandit');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="success" />
        <p className="mt-3 text-muted">Memuat data bandit...</p>
      </div>
    );
  }

  return (
    <Container fluid className="py-4">
      <PageHeader title="Bandit Analytics" subtitle="Multi-Armed Bandit Performance Dashboard" />

      {error && (
        <Alert variant="danger" className="mb-3">
          {error}
          <button className="btn btn-sm btn-link ms-2" onClick={loadPolicies}>Retry</button>
        </Alert>
      )}

      <div className="mb-4">
        <Alert variant="light" className="mb-3 border">
          <strong>Info:</strong> Label <strong>Strategi 1, Strategi 2, ...</strong> adalah varian pesan/waktu kirim yang sedang dibandingkan oleh Bandit untuk mencari performa terbaik.
        </Alert>
        <div className="row">
          <div className="col-md-12">
            <label className="form-label fw-bold">Select Bandit Policy:</label>
            <select
              className="form-select"
              value={selectedPolicy || ''}
              onChange={(e) => setSelectedPolicy(Number(e.target.value))}
              disabled={policies.length === 0}
            >
              <option value="">-- Choose a policy --</option>
              {policies.map((policy) => (
                <option key={policy.id} value={policy.id}>
                  {policy.name} (Arms: {policy.arms})
                </option>
              ))}
            </select>
            {policies.length === 0 && (
              <Alert variant="info" className="mt-2 mb-0">
                No policies found. Create a policy to see analytics.
              </Alert>
            )}
          </div>
        </div>
      </div>

      <BanditStatsEnhanced policyId={selectedPolicy} />
    </Container>
  );
}
