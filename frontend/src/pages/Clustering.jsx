import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Col,
  Form,
  Modal,
  Row,
  Spinner,
} from 'react-bootstrap';
import {
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import { blastAPI, clusteringAPI, templatesAPI } from '../services/api';
import { toMillis } from '../lib/datetime';

const clusterColors = ['#25D366', '#128C7E', '#dc3545', '#1a2942', '#06b6d4', '#f97316', '#6366f1', '#84cc16'];

function jitter(seed) {
  const x = Math.sin(seed * 9999) * 10000;
  return (x - Math.floor(x) - 0.5) * 0.35;
}

function recencyDays(dateStr) {
  const ms = toMillis(dateStr);
  if (!ms) return 0;
  return Math.max(Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24)), 0);
}

export default function Clustering() {
  const [kValue, setKValue] = useState(3);
  const [features, setFeatures] = useState({ recency: true, frequency: true, group: true });
  const [loading, setLoading] = useState(false);
  const [latestMeta, setLatestMeta] = useState(null);
  const [clusterSummary, setClusterSummary] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [usedFeatures, setUsedFeatures] = useState([]);

  const [templates, setTemplates] = useState([]);
  const [blastModalOpen, setBlastModalOpen] = useState(false);
  const [blastCluster, setBlastCluster] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [blastSending, setBlastSending] = useState(false);

  useEffect(() => {
    fetchLatest();
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const response = await templatesAPI.getAll();
      setTemplates(response.data || []);
      if (response.data?.length) {
        setSelectedTemplateId(String(response.data[0].id));
      }
    } catch (error) {
      setTemplates([]);
    }
  }

  async function fetchLatest() {
    try {
      const response = await clusteringAPI.latest();
      const payload = response.data || {};
      setLatestMeta(payload.latest || null);
      setClusterSummary(payload.clusters || []);
      setContacts(payload.contacts || []);
      setUsedFeatures(payload.features_used || []);

      if (payload.latest?.num_clusters) {
        setKValue(payload.latest.num_clusters);
      }
    } catch (error) {
      setLatestMeta(null);
      setClusterSummary([]);
      setContacts([]);
      setUsedFeatures([]);
    }
  }

  async function runClustering() {
    const selectedFeatures = Object.entries(features)
      .filter(([, checked]) => checked)
      .map(([key]) => key);

    if (selectedFeatures.length === 0) {
      toast.error('Select at least one feature');
      return;
    }

    setLoading(true);
    try {
      const response = await clusteringAPI.run({
        nClusters: kValue,
        features: selectedFeatures,
      });
      toast.success(response.data?.message || 'Clustering completed');
      await fetchLatest();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to run clustering');
    } finally {
      setLoading(false);
    }
  }

  async function clearClustering() {
    setLoading(true);
    try {
      await clusteringAPI.clear();
      toast.success('Clustering data cleared');
      setLatestMeta(null);
      setClusterSummary([]);
      setContacts([]);
      setUsedFeatures([]);
    } catch (error) {
      toast.error('Failed to clear clustering');
    } finally {
      setLoading(false);
    }
  }

  const scatterDataByCluster = useMemo(() => {
    const map = new Map();
    contacts.forEach((contact) => {
      const clusterId = Number(contact.cluster_id);
      const points = map.get(clusterId) || [];
      points.push({
        ...contact,
        x: clusterId + 1 + jitter(contact.id),
        y: recencyDays(contact.created_at),
      });
      map.set(clusterId, points);
    });
    return map;
  }, [contacts]);

  const selectedTemplate = templates.find((template) => String(template.id) === String(selectedTemplateId));

  function openBlastModal(cluster) {
    setBlastCluster(cluster);
    if (templates.length > 0) {
      setSelectedTemplateId(String(templates[0].id));
    }
    setBlastModalOpen(true);
  }

  async function blastThisCluster() {
    if (!blastCluster) return;
    if (!selectedTemplate) {
      toast.error('Please choose a template first');
      return;
    }

    const contactIds = contacts
      .filter((contact) => Number(contact.cluster_id) === Number(blastCluster.id))
      .map((contact) => contact.id);

    if (contactIds.length === 0) {
      toast.error('No contacts in this cluster');
      return;
    }

    setBlastSending(true);
    try {
      await blastAPI.start({
        name: `Cluster ${blastCluster.id} Campaign`,
        message: selectedTemplate.content,
        contact_ids: contactIds,
        delay_min: 2000,
        delay_max: 3500,
        template_media_path: selectedTemplate.media_path || undefined,
      });
      toast.success(`Blast started for Cluster ${blastCluster.id}`);
      setBlastModalOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to start blast');
    } finally {
      setBlastSending(false);
    }
  }

  return (
    <div className="page-enter-active">
      <PageHeader
        title="Clustering"
        subtitle="Fungsi menu ini: membagi kontak ke beberapa segmen otomatis supaya kamu bisa kirim blast lebih terarah per cluster."
      />

      <Row className="g-3 mb-3">
        <Col md={4}>
          <Card className="surface-card h-100">
            <Card.Body>
              <h3 className="mb-3" style={{ fontSize: 16 }}>Config</h3>

              <Form.Group className="mb-3">
                <Form.Label>K Value ({kValue})</Form.Label>
                <Form.Range min={2} max={8} value={kValue} onChange={(event) => setKValue(Number(event.target.value))} />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Features</Form.Label>
                <Form.Check
                  label="Recency (umur kontak)"
                  checked={features.recency}
                  onChange={(event) => setFeatures((prev) => ({ ...prev, recency: event.target.checked }))}
                />
                <Form.Check
                  label="Frequency (riwayat kirim)"
                  checked={features.frequency}
                  onChange={(event) => setFeatures((prev) => ({ ...prev, frequency: event.target.checked }))}
                />
                <Form.Check
                  label="Group"
                  checked={features.group}
                  onChange={(event) => setFeatures((prev) => ({ ...prev, group: event.target.checked }))}
                />
              </Form.Group>

              <div className="d-flex gap-2">
                <Button className="flex-grow-1" onClick={runClustering} disabled={loading}>
                  {loading ? <><Spinner size="sm" className="me-2" />Analyzing...</> : 'Run Clustering'}
                </Button>
                <Button variant="light" className="btn-outline-soft" onClick={clearClustering} disabled={loading || !latestMeta}>
                  Clear
                </Button>
              </div>

              {latestMeta ? (
                <div className="mt-3 small text-secondary">
                  <div>Silhouette: <strong>{Number(latestMeta.silhouette_score || 0).toFixed(3)}</strong></div>
                  <div>Davies-Bouldin: <strong>{Number(latestMeta.davies_bouldin_index || 0).toFixed(3)}</strong></div>
                  <div>Total Contacts: <strong>{latestMeta.total_contacts || 0}</strong></div>
                </div>
              ) : null}
            </Card.Body>
          </Card>
        </Col>

        <Col md={8}>
          <Card className="surface-card h-100">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h3 className="mb-0" style={{ fontSize: 16 }}>Cluster Visualization</h3>
                <div className="small text-secondary">
                  Active features: {usedFeatures.length ? usedFeatures.join(', ') : '-'}
                </div>
              </div>

              {contacts.length === 0 ? (
                <EmptyState title="No clustering data" description="Run clustering to generate cluster segments" />
              ) : (
                <div style={{ height: 340 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart>
                      <XAxis type="number" dataKey="x" name="Cluster" domain={[0.5, 8.5]} tickFormatter={(value) => `${Math.round(value)}`} />
                      <YAxis type="number" dataKey="y" name="Recency (days)" />
                      <Tooltip
                        formatter={(value, name) => [value, name]}
                        labelFormatter={() => 'Contact Point'}
                        content={({ active, payload }) => {
                          if (!active || !payload || payload.length === 0) return null;
                          const point = payload[0].payload;
                          return (
                            <div className="p-2 border bg-white rounded shadow-sm small">
                              <div className="fw-semibold">{point.name}</div>
                              <div>{point.phone}</div>
                              <div>Cluster: {point.cluster_id}</div>
                              <div>Recency: {point.y} days</div>
                            </div>
                          );
                        }}
                      />
                      {clusterSummary.map((cluster, index) => (
                        <Scatter
                          key={cluster.id}
                          name={`Cluster ${cluster.id}`}
                          data={scatterDataByCluster.get(Number(cluster.id)) || []}
                          fill={clusterColors[index % clusterColors.length]}
                        />
                      ))}
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3">
        {clusterSummary.length === 0 ? (
          <Col>
            <Card className="surface-card">
              <EmptyState title="Cluster details unavailable" description="Run clustering to see actionable cluster cards" />
            </Card>
          </Col>
        ) : (
          clusterSummary.map((cluster, index) => (
            <Col lg={4} md={6} key={cluster.id}>
              <Card className="surface-card hover-lift h-100">
                <Card.Body>
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <div className="d-flex align-items-center gap-2">
                      <span className="status-dot" style={{ background: clusterColors[index % clusterColors.length], width: 12, height: 12 }} />
                      <h3 className="mb-0" style={{ fontSize: 16 }}>Cluster {cluster.id}</h3>
                    </div>
                    <Badge bg="light" text="dark">{cluster.percentage}%</Badge>
                  </div>

                  <div className="small text-secondary mb-1">Size: <strong>{cluster.total}</strong></div>
                  <div className="small text-secondary mb-1">Avg Recency: <strong>{cluster.avg_recency} days</strong></div>
                  <div className="small text-secondary mb-1">Avg Frequency: <strong>{cluster.avg_frequency}</strong></div>
                  <div className="small text-secondary mb-3">Top Groups: <strong>{cluster.top_groups?.join(', ') || '-'}</strong></div>

                  <Button variant="primary" className="w-100" onClick={() => openBlastModal(cluster)}>
                    Blast this cluster
                  </Button>
                </Card.Body>
              </Card>
            </Col>
          ))
        )}
      </Row>

      <Modal show={blastModalOpen} onHide={() => setBlastModalOpen(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Blast Cluster {blastCluster?.id}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Template Message</Form.Label>
            <Form.Select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </Form.Select>
          </Form.Group>

          <div className="small text-secondary">
            Contacts in cluster: <strong>{contacts.filter((contact) => Number(contact.cluster_id) === Number(blastCluster?.id)).length}</strong>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" className="btn-outline-soft" onClick={() => setBlastModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={blastThisCluster} disabled={blastSending || !selectedTemplate}>
            {blastSending ? 'Starting...' : 'Start Blast'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
