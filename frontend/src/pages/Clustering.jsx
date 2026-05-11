import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Col, Form, Modal, Row, Spinner } from 'react-bootstrap';
import { Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import { blastAPI, clusteringAPI, templatesAPI } from '../services/api';
import { toMillis } from '../lib/datetime';

const clusterColors = ['#25D366', '#128C7E', '#dc3545', '#1a2942', '#06b6d4', '#f97316', '#6366f1', '#84cc16'];

const qualityInfo = (score) => {
  const v = Number(score || 0);
  if (v >= 0.6) return { label: 'Excellent', desc: 'Segments sangat jelas dan terpisah.' };
  if (v >= 0.4) return { label: 'Good', desc: 'Segments cukup baik untuk blasting.' };
  if (v >= 0.2) return { label: 'Fair', desc: 'Masih ada overlap antar segment.' };
  return { label: 'Needs Review', desc: 'Evaluasi feature dan nilai K.' };
};

const formatValue = (n) => Number(n || 0).toFixed(3);
const displayClusterNumber = (id) => Number(id) + 1;
const recencyDays = (dateStr) => {
  const ms = toMillis(dateStr);
  if (!ms) return 0;
  return Math.max(Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24)), 0);
};

export default function Clustering() {
  const [kValue, setKValue] = useState(3);
  const [features, setFeatures] = useState({ tags: true, group: true });
  const [loading, setLoading] = useState(false);
  const [hasRunClustering, setHasRunClustering] = useState(false);
  const [latestMeta, setLatestMeta] = useState(null);
  const [clusterSummary, setClusterSummary] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [usedFeatures, setUsedFeatures] = useState([]);
  const [dominantInterest, setDominantInterest] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [blastModalOpen, setBlastModalOpen] = useState(false);
  const [blastCluster, setBlastCluster] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [blastSending, setBlastSending] = useState(false);
  const [blastDelayMin, setBlastDelayMin] = useState(2000);
  const [blastDelayMax, setBlastDelayMax] = useState(3500);
  const [queueStatus, setQueueStatus] = useState(false);

  useEffect(() => {
    fetchLatest();
    loadTemplates();
    checkQueueStatus();
  }, []);

  useEffect(() => {
    if (!hasRunClustering) return undefined;
    const t = setInterval(() => {
      fetchLatest();
      checkQueueStatus();
    }, 5000);
    return () => clearInterval(t);
  }, [hasRunClustering]);

  const usedFeatureLabels = useMemo(() => {
    if (usedFeatures.length) return usedFeatures;
    return Object.entries(features).filter(([, v]) => v).map(([k]) => k);
  }, [usedFeatures, features]);

  const quality = useMemo(() => qualityInfo(latestMeta?.silhouette_score), [latestMeta]);

  const scatterDataByCluster = useMemo(() => {
    const map = new Map();
    contacts.forEach((contact) => {
      const clusterId = Number(contact.cluster_id);
      const points = map.get(clusterId) || [];
      const tagScore = String(contact.minat_prodi || '').length % 100;
      const groupScore = String(contact.group_name || '').length % 100;
      points.push({
        ...contact,
        x: clusterId + 1,
        y: Math.round((tagScore + groupScore) / 2),
        tagScore,
        groupScore,
      });
      map.set(clusterId, points);
    });
    return map;
  }, [contacts]);

  const selectedTemplate = templates.find((t) => String(t.id) === String(selectedTemplateId));

  async function loadTemplates() {
    try {
      const response = await templatesAPI.getAll();
      const rows = Array.isArray(response.data) ? response.data : [];
      setTemplates(rows);
      if (rows.length) setSelectedTemplateId(String(rows[0].id));
    } catch {
      setTemplates([]);
    }
  }

  async function checkQueueStatus() {
    try {
      const response = await blastAPI.isActive();
      setQueueStatus(Boolean(response?.data?.active));
    } catch {
      setQueueStatus(false);
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
      setDominantInterest(payload.dominant_interest || null);
      setHasRunClustering(Boolean(payload.latest));
      if (payload.latest?.num_clusters) setKValue(payload.latest.num_clusters);
      if (payload.warning) toast(payload.warning, { icon: '⚠️' });
    } catch {
      setLatestMeta(null);
      setClusterSummary([]);
      setContacts([]);
      setUsedFeatures([]);
      setDominantInterest(null);
      setHasRunClustering(false);
    }
  }

  async function runClustering() {
    const selected = [];
    if (features.tags) selected.push('tags');
    if (features.group) selected.push('group');
    if (!selected.length) return toast.error('Select at least one feature');
    setLoading(true);
    try {
      const response = await clusteringAPI.run({ nClusters: kValue, features: selected });
      toast.success(response.data?.message || 'Clustering completed');
      setHasRunClustering(true);
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
      setDominantInterest(null);
      setHasRunClustering(false);
    } catch {
      toast.error('Failed to clear clustering');
    } finally {
      setLoading(false);
    }
  }

  function openBlastModal(cluster) {
    setBlastCluster(cluster);
    setBlastModalOpen(true);
  }

  async function blastThisCluster() {
    if (!blastCluster || !selectedTemplate) return;
    const contactIds = contacts.filter((c) => Number(c.cluster_id) === Number(blastCluster.id)).map((c) => c.id);
    if (!contactIds.length) return toast.error('No contacts in this cluster');
    setBlastSending(true);
    try {
      await blastAPI.start({
        name: `Cluster ${displayClusterNumber(blastCluster.id)} Campaign`,
        message: selectedTemplate.content,
        contact_ids: contactIds,
        delay_min: Number(blastDelayMin),
        delay_max: Number(Math.max(blastDelayMin, blastDelayMax)),
        template_media_path: selectedTemplate.media_path || undefined,
      });
      toast.success(`Blast started for Cluster ${displayClusterNumber(blastCluster.id)}`);
      setBlastModalOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to start blast');
    } finally {
      setBlastSending(false);
    }
  }

  return (
    <div className="page-enter-active">
      <PageHeader title="Clustering Dashboard" subtitle="Machine Learning Based Contact Segmentation System for WhatsApp Blast research using K-Means clustering." />

      <Card className="surface-card mb-3">
        <Card.Body className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <div className="small text-secondary text-uppercase">Research Dashboard</div>
            <h3 className="mb-1" style={{ fontSize: 20 }}>K-Means Contact Segmentation Analysis</h3>
            <div className="small text-secondary">This dashboard highlights cluster formation quality, segment distribution, and academic-ready summaries for machine learning based contact grouping.</div>
          </div>
          <div className="d-flex flex-wrap gap-2">
            {usedFeatureLabels.map((f) => <Badge key={f} bg="light" text="dark">{f}</Badge>)}
          </div>
        </Card.Body>
      </Card>

      <Row className="g-3 mb-3">
        <Col md={3}>
          <Card className="surface-card h-100">
            <Card.Body>
              <div className="small text-secondary">Configuration</div>
              <h4 style={{ fontSize: 18 }}>Cluster Setup</h4>
              <Form.Group className="mb-2">
                <Form.Label>Optimal Cluster (K): {kValue} <Badge bg="light" text="dark">K-Means</Badge></Form.Label>
                <Form.Range min={2} max={8} value={kValue} onChange={(e) => setKValue(Number(e.target.value))} />
                <div className="small text-secondary">K determines the number of contact segments generated by K-Means clustering.</div>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Check label="Tags (Minat Prodi)" checked={features.tags} onChange={(e) => setFeatures((p) => ({ ...p, tags: e.target.checked }))} />
                <Form.Check label="Group (Gelombang)" checked={features.group} onChange={(e) => setFeatures((p) => ({ ...p, group: e.target.checked }))} />
                <div className="small text-secondary">Contact names remain visible as identity labels, not clustering variables.</div>
              </Form.Group>
              <Button className="w-100 mb-2" onClick={runClustering} disabled={loading}>{loading ? <><Spinner size="sm" className="me-2" />Analyzing...</> : 'Run Clustering'}</Button>
              <Button className="w-100" variant="outline-secondary" onClick={clearClustering} disabled={loading || !latestMeta}>Clear</Button>
            </Card.Body>
          </Card>
        </Col>
        <Col md={9}>
          <Card className="surface-card h-100">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start mb-3">
                <div>
                  <div className="small text-secondary">Research Summary</div>
                  <h4 style={{ fontSize: 18 }}>Segmentation Overview</h4>
                  <div className="small text-secondary">Academic summary of clustering output for machine learning based contact segmentation.</div>
                </div>
                <Badge bg="light" text="dark">{quality.label}</Badge>
              </div>
              <Row className="g-2">
                <Col md={6}><Card><Card.Body><div className="small text-secondary">Total Clusters</div><h5>{latestMeta?.num_clusters || 0}</h5></Card.Body></Card></Col>
                <Col md={6}><Card><Card.Body><div className="small text-secondary">Total Contacts</div><h5>{latestMeta?.total_contacts || 0}</h5></Card.Body></Card></Col>
                <Col md={6}><Card><Card.Body><div className="small text-secondary">Dominant Interest</div><h5>{dominantInterest?.name || '-'}</h5></Card.Body></Card></Col>
                <Col md={6}><Card><Card.Body><div className="small text-secondary">Cluster Quality Status</div><h5>{quality.label}</h5></Card.Body></Card></Col>
              </Row>
              <div className="small text-secondary mt-2">{quality.desc}</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col md={6}><Card className="surface-card"><Card.Body><div className="small text-secondary">Metric</div><h5>Silhouette Score</h5><div className="small text-secondary mb-2">Measures how well contacts fit inside their assigned segments.</div><h2>{formatValue(latestMeta?.silhouette_score)}</h2><div className="small text-secondary">{qualityInfo(latestMeta?.silhouette_score).desc}</div></Card.Body></Card></Col>
        <Col md={6}><Card className="surface-card"><Card.Body><div className="small text-secondary">Metric</div><h5>Davies-Bouldin Index</h5><div className="small text-secondary mb-2">Evaluates how compact and separated each contact segment is.</div><h2>{formatValue(latestMeta?.davies_bouldin_index)}</h2><div className="small text-secondary">{Number(latestMeta?.davies_bouldin_index || 0) <= 1 ? 'Lower is better, current value is healthy.' : 'Value indicates overlap, consider feature tuning.'}</div></Card.Body></Card></Col>
      </Row>

      <Card className="surface-card mb-3">
        <Card.Body>
          <div className="small text-secondary">Visualization</div>
          <h4 style={{ fontSize: 18 }}>Cluster Distribution Map</h4>
          <div className="small text-secondary mb-2">Scatter plot of clustered contacts using selected research features and cluster assignment.</div>
          <div className="small text-secondary mb-3">Active features: {usedFeatureLabels.length ? usedFeatureLabels.join(', ') : '-'}</div>
          {!hasRunClustering || contacts.length === 0 ? (
            <EmptyState title="No clustering data" description="Run clustering to generate cluster segments" />
          ) : (
            <div style={{ height: 340 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <XAxis type="number" dataKey="x" name="Cluster Segment" domain={[1, 8]} />
                  <YAxis type="number" dataKey="y" name="Composite Feature Score" domain={[0, 100]} />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload;
                    return <div className="p-2 border bg-white rounded shadow-sm small">
                      <div className="fw-semibold">{p.name}</div><div>{p.phone}</div>
                      <div>Cluster: {displayClusterNumber(p.cluster_id)}</div><div>Group: {p.group_name || '-'}</div>
                      <div>Interest: {p.minat_prodi || '-'}</div><div>Tag score: {p.tagScore}</div><div>Group score: {p.groupScore}</div>
                    </div>;
                  }} />
                  <Legend />
                  {clusterSummary.map((cluster, idx) => (
                    <Scatter key={cluster.id} name={`Cluster ${displayClusterNumber(cluster.id)}`} data={scatterDataByCluster.get(Number(cluster.id)) || []} fill={clusterColors[idx % clusterColors.length]} />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card.Body>
      </Card>

      <Row className="g-3">
        {!hasRunClustering || clusterSummary.length === 0 ? (
          <Col><Card className="surface-card"><EmptyState title="Cluster details unavailable" description="Run clustering to see actionable cluster cards" /></Card></Col>
        ) : clusterSummary.map((cluster, idx) => (
          <Col lg={4} md={6} key={cluster.id}>
            <Card className="surface-card h-100">
              <Card.Body>
                <div className="small text-secondary">Segment</div>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h5 className="mb-0">Cluster {displayClusterNumber(cluster.id)}</h5>
                  <Badge bg="light" text="dark">{cluster.percentage}%</Badge>
                </div>
                <Row className="text-center mb-2">
                  <Col><div className="small text-secondary">Contacts</div><strong>{cluster.total}</strong></Col>
                  <Col><div className="small text-secondary">Avg. Frequency</div><strong>{cluster.avg_frequency}</strong></Col>
                  <Col><div className="small text-secondary">Avg. Recency</div><strong>{cluster.avg_recency}</strong></Col>
                </Row>
                <div className="small text-secondary">Top Program Study Interest</div>
                <div className="mb-2 d-flex flex-wrap gap-1">{(cluster.top_tags || []).slice(0, 3).map((tag) => <Badge key={tag} bg="secondary">{tag}</Badge>)}</div>
                <div className="small text-secondary">Dominant Group Labels</div>
                <div className="small mb-2">{(cluster.top_groups || []).join(', ') || '-'}</div>
                <div className="small text-secondary">Sample Contact Identity</div>
                <div className="mb-3 d-flex flex-wrap gap-1">
                  {contacts.filter((c) => Number(c.cluster_id) === Number(cluster.id)).slice(0, 4).map((c) => <Badge key={c.id} bg="light" text="dark">{c.name}</Badge>)}
                </div>
                <Button className="w-100" onClick={() => openBlastModal(cluster)} style={{ background: clusterColors[idx % clusterColors.length], borderColor: clusterColors[idx % clusterColors.length] }}>
                  Blast this cluster
                </Button>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      <Modal show={blastModalOpen} onHide={() => setBlastModalOpen(false)} centered>
        <Modal.Header closeButton><Modal.Title>Blast Cluster {displayClusterNumber(blastCluster?.id || 0)}</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Template Message</Form.Label>
            <Form.Select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </Form.Select>
          </Form.Group>
          <div className={`small p-2 rounded mb-3 ${queueStatus ? 'bg-warning-subtle text-warning-emphasis' : 'bg-light text-secondary'}`}>
            {queueStatus ? 'Ada blast yang sedang berjalan...' : 'Queue blast kosong.'}
          </div>
          <Row className="g-2">
            <Col><Form.Label className="small">Delay Minimum (ms)</Form.Label><Form.Control type="number" min={1000} step={500} value={blastDelayMin} onChange={(e) => setBlastDelayMin(Number(e.target.value || 1000))} /></Col>
            <Col><Form.Label className="small">Delay Maximum (ms)</Form.Label><Form.Control type="number" min={blastDelayMin} step={500} value={blastDelayMax} onChange={(e) => setBlastDelayMax(Number(e.target.value || blastDelayMin))} /></Col>
          </Row>
          <div className="small text-secondary mt-2">Delay ini dipakai sebagai jeda antar pesan pada blast cluster dan tetap mengikuti flow queue backend yang sudah ada.</div>
          <div className="small text-secondary mt-2">Contacts in cluster: <strong>{contacts.filter((c) => Number(c.cluster_id) === Number(blastCluster?.id)).length}</strong></div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setBlastModalOpen(false)}>Cancel</Button>
          <Button onClick={blastThisCluster} disabled={!selectedTemplate || blastSending}>{blastSending ? 'Starting...' : 'Start Blast'}</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
