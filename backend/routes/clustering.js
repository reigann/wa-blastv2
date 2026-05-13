const express = require('express');
const { admin, getFirestore } = require('../services/firebaseAdmin');
const clusteringService = require('../services/clusteringServiceWrapper');

const router = express.Router();
const STORAGE_PROVIDER = (process.env.STORAGE_PROVIDER || 'firebase').toLowerCase();
const PAGE_SIZE = 500;
const MAX_SAFE_SCAN = 5000;

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value._seconds === 'number') return value._seconds * 1000;
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizePhone(raw) {
  return String(raw || '').replace(/^\+/, '').replace(/[^\d]/g, '');
}

function chunkArray(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function fetchAllContacts({ groupName = null, clusteredOnly = false } = {}) {
  const db = getFirestore();
  let query = db.collection('contacts');
  if (groupName) query = query.where('group_name', '==', groupName);
  if (clusteredOnly) query = query.where('cluster_id', '>=', 0).orderBy('cluster_id', 'asc');

  const result = [];
  let lastDoc = null;
  while (true) {
    let pageQuery = query.limit(PAGE_SIZE);
    if (lastDoc) pageQuery = pageQuery.startAfter(lastDoc);
    const snap = await pageQuery.get();
    if (snap.empty) break;
    snap.docs.forEach((doc) => result.push({ id: doc.id, ...doc.data() }));
    lastDoc = snap.docs[snap.docs.length - 1];
    if (result.length > MAX_SAFE_SCAN) break;
  }
  return result;
}

async function getSentMapByPhones(phones = []) {
  const db = getFirestore();
  const out = new Map();
  const normalized = Array.from(new Set(phones.map((p) => normalizePhone(p)).filter(Boolean)));
  if (!normalized.length) return out;

  const sixMonthsAgo = admin.firestore.Timestamp.fromMillis(Date.now() - (180 * 24 * 60 * 60 * 1000));
  const chunks = chunkArray(normalized, 10);
  for (const chunk of chunks) {
    try {
      const snap = await db.collection('blast_logs')
        .where('status', '==', 'sent')
        .where('sent_at', '>=', sixMonthsAgo)
        .where('phone', 'in', chunk)
        .limit(MAX_SAFE_SCAN)
        .get();

      snap.docs.forEach((doc) => {
        const key = normalizePhone(doc.data()?.phone);
        if (!key) return;
        out.set(key, (out.get(key) || 0) + 1);
      });
    } catch (error) {
      // If index is not ready, fall back to simpler query
      if (error.code === 9 || error.message.includes('FAILED_PRECONDITION')) {
        console.warn('⚠️  Firestore index not ready, using fallback query for sent logs');
        // Fallback: get all sent logs and filter in memory (less efficient but works)
        const fallbackSnap = await db.collection('blast_logs')
          .where('status', '==', 'sent')
          .where('sent_at', '>=', sixMonthsAgo)
          .limit(MAX_SAFE_SCAN * 2)
          .get();

        fallbackSnap.docs.forEach((doc) => {
          const phone = normalizePhone(doc.data()?.phone);
          if (phone && chunk.includes(phone)) {
            out.set(phone, (out.get(phone) || 0) + 1);
          }
        });
      } else {
        throw error;
      }
    }
  }
  return out;
}

function mapFeatures(features = []) {
  const allowed = new Set(['name', 'tags', 'group', 'recency', 'frequency', 'prodi']);
  const normalized = Array.isArray(features)
    ? features.map((f) => String(f).toLowerCase()).filter((f) => allowed.has(f))
    : [];
  if (!normalized.length) return ['recency', 'frequency', 'group', 'prodi'];
  return normalized.map((f) => (f === 'tags' ? 'prodi' : f));
}

function computeClusterPayload(contacts = [], sentMap = new Map()) {
  const countByCluster = new Map();
  contacts.forEach((contact) => {
    const key = Number(contact.cluster_id);
    countByCluster.set(key, (countByCluster.get(key) || 0) + 1);
  });

  const totalClustered = contacts.length || 1;
  const stats = Array.from(countByCluster.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([clusterId, total]) => ({
      cluster_id: clusterId,
      total,
      percentage: Number(((total / totalClustered) * 100).toFixed(1)),
    }));

  const clusters = stats.map((stat) => {
    const items = contacts.filter((contact) => Number(contact.cluster_id) === Number(stat.cluster_id));
    const groupCounter = new Map();
    const tagCounter = new Map();
    let totalRecency = 0;
    let totalFrequency = 0;

    items.forEach((item) => {
      const group = item.group_name || 'default';
      const tag = item.minat_prodi || 'Unknown';
      groupCounter.set(group, (groupCounter.get(group) || 0) + 1);
      tagCounter.set(tag, (tagCounter.get(tag) || 0) + 1);

      const created = toMillis(item.created_at);
      const recencyDays = created > 0 ? Math.max(Math.floor((Date.now() - created) / 86400000), 0) : 0;
      totalRecency += recencyDays;
      totalFrequency += Number(sentMap.get(normalizePhone(item.phone)) || 0);
    });

    const groupDistribution = Array.from(groupCounter.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    const tagsDistribution = Array.from(tagCounter.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name,
        count,
        percentage: items.length ? Number(((count / items.length) * 100).toFixed(1)) : 0,
      }));

    return {
      id: stat.cluster_id,
      total: stat.total,
      percentage: stat.percentage,
      avg_recency: items.length ? Number((totalRecency / items.length).toFixed(1)) : 0,
      avg_frequency: items.length ? Number((totalFrequency / items.length).toFixed(1)) : 0,
      top_groups: groupDistribution.map((x) => x.name),
      top_tags: tagsDistribution.slice(0, 3).map((x) => x.name),
      tags_distribution: tagsDistribution,
      group_distribution: groupDistribution,
    };
  });

  return { stats, clusters };
}

function dominantTag(contacts = []) {
  const map = new Map();
  contacts.forEach((c) => {
    const key = String(c.minat_prodi || 'Unknown');
    map.set(key, (map.get(key) || 0) + 1);
  });
  const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  const top = sorted[0];
  return top ? { name: top[0], count: top[1] } : null;
}

router.use((req, res, next) => {
  if (STORAGE_PROVIDER !== 'firebase') {
    return res.status(503).json({ error: 'Clustering route is configured for Firebase storage mode only.' });
  }
  return next();
});

router.post('/run', async (req, res) => {
  const txId = `cluster-${Date.now()}`;
  try {
    const { groupName = null, nClusters = null, features = [] } = req.body || {};
    const parsedK = nClusters === null || nClusters === undefined ? null : Number(nClusters);
    if (parsedK !== null && (!Number.isInteger(parsedK) || parsedK < 2 || parsedK > 8)) {
      return res.status(400).json({ error: 'nClusters harus integer 2-8' });
    }

    const contacts = await fetchAllContacts({ groupName });
    if (contacts.length < 2) {
      return res.status(400).json({ error: 'Minimal 2 kontak diperlukan untuk clustering', contactsFound: contacts.length });
    }

    const featuresUsed = mapFeatures(features);
    const phoneList = contacts.map((c) => c.phone);
    const sentMap = await getSentMapByPhones(phoneList);
    const enriched = contacts.map((c) => ({
      ...c,
      message_count: Number(sentMap.get(normalizePhone(c.phone)) || 0),
    }));

    const result = await clusteringService.runClustering(enriched, parsedK, featuresUsed);
    if (!result?.success || !Array.isArray(result.labels) || result.labels.length !== enriched.length) {
      return res.status(500).json({ error: result?.error || 'Invalid clustering output' });
    }

    const db = getFirestore();
    const now = admin.firestore.Timestamp.now();
    const metadataRef = db.collection('cluster_metadata').doc();

    await metadataRef.set({
      name: `Clustering_${groupName || 'all'}_${new Date().toISOString().slice(0, 10)}`,
      total_contacts: enriched.length,
      num_clusters: result.n_clusters,
      silhouette_score: Number(result.silhouette_score || 0),
      davies_bouldin_index: Number(result.davies_bouldin_index || 0),
      features_used: result.features_used || featuresUsed,
      created_at: now,
      updated_at: now,
      tx_id: txId,
    });

    const chunks = chunkArray(enriched.map((c, i) => ({ id: c.id, cluster_id: Number(result.labels[i] || 0) })), 500);
    for (const chunk of chunks) {
      const batch = db.batch();
      chunk.forEach((item) => {
        batch.set(db.collection('contacts').doc(String(item.id)), { cluster_id: item.cluster_id, updated_at: now }, { merge: true });
      });
      await batch.commit();
    }

    const latestContacts = enriched.map((c, i) => ({ ...c, cluster_id: Number(result.labels[i] || 0) }));
    const payload = computeClusterPayload(latestContacts, sentMap);
    return res.json({
      success: true,
      clusterId: metadataRef.id,
      message: `Clustering berhasil disimpan dengan ${result.n_clusters} cluster`,
      metrics: {
        silhouette_score: Number(result.silhouette_score || 0),
        davies_bouldin_index: Number(result.davies_bouldin_index || 0),
        n_clusters: result.n_clusters,
        total_contacts: enriched.length,
        cluster_stats: payload.stats,
        features_used: result.features_used || featuresUsed,
      },
    });
  } catch (error) {
    console.error(`[Clustering:${txId}] run error`, error);
    return res.status(500).json({ error: error.message, tx_id: txId });
  }
});

router.get('/latest', async (req, res) => {
  console.log('🔍 Clustering latest endpoint called');
  try {
    console.log('📊 Fetching cluster metadata...');
    const db = getFirestore();
    const latestSnap = await db.collection('cluster_metadata').orderBy('created_at', 'desc').limit(1).get();
    const latestDoc = latestSnap.empty ? null : latestSnap.docs[0];
    const latest = latestDoc ? { id: latestDoc.id, ...latestDoc.data() } : null;

    console.log('📊 Latest cluster metadata:', latest ? 'found' : 'not found');

    if (!latest) return res.json({ latest: null, contacts: [], stats: [], clusters: [], features_used: [] });

    console.log('👥 Fetching clustered contacts...');
    const contacts = await fetchAllContacts({ clusteredOnly: true });
    console.log('👥 Found', contacts.length, 'clustered contacts');

    console.log('📈 Getting sent map for phones...');
    const sentMap = await getSentMapByPhones(contacts.map((c) => c.phone));
    console.log('📈 Sent map created with', sentMap.size, 'entries');

    const payload = computeClusterPayload(contacts, sentMap);
    const dominant = dominantTag(contacts);

    console.log('✅ Clustering latest completed successfully');
    return res.json({
      latest,
      contacts,
      stats: payload.stats,
      clusters: payload.clusters,
      features_used: Array.isArray(latest.features_used) ? latest.features_used : [],
      dominant_interest: dominant,
      warning: contacts.length === 0 ? 'Cache mungkin terputus, coba refresh halaman' : null,
    });
  } catch (error) {
    console.error('❌ Clustering latest error:', error);
    console.error('❌ Error stack:', error.stack);
    return res.status(500).json({ error: error.message });
  }
});

router.get('/results', async (req, res) => {
  try {
    const { clusterId } = req.query;
    const db = getFirestore();
    if (clusterId) {
      const doc = await db.collection('cluster_metadata').doc(String(clusterId)).get();
      if (!doc.exists) return res.status(404).json({ error: 'Clustering tidak ditemukan' });
      return res.json({ metadata: { id: doc.id, ...doc.data() } });
    }

    const snap = await db.collection('cluster_metadata').orderBy('created_at', 'desc').limit(100).get();
    return res.json({ results: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const contacts = await fetchAllContacts({ clusteredOnly: true });
    const counts = new Map();
    contacts.forEach((contact) => {
      const key = Number(contact.cluster_id);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const total = contacts.length || 1;
    const stats = Array.from(counts.entries()).sort((a, b) => a[0] - b[0]).map(([cluster_id, count]) => ({
      cluster_id,
      total: count,
      percentage: Number(((count / total) * 100).toFixed(1)),
    }));
    return res.json({ stats });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/contacts-by-cluster/:clusterId', async (req, res) => {
  try {
    const clusterId = Number(req.params.clusterId);
    const db = getFirestore();
    let query = db.collection('contacts').where('cluster_id', '==', clusterId).orderBy('created_at', 'desc');
    const contacts = [];
    let lastDoc = null;
    while (true) {
      let pageQuery = query.limit(PAGE_SIZE);
      if (lastDoc) pageQuery = pageQuery.startAfter(lastDoc);
      const snap = await pageQuery.get();
      if (snap.empty) break;
      snap.docs.forEach((doc) => contacts.push({ id: doc.id, ...doc.data() }));
      lastDoc = snap.docs[snap.docs.length - 1];
      if (contacts.length > MAX_SAFE_SCAN) break;
    }
    contacts.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    return res.json({ clusterId, count: contacts.length, contacts });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/clear', async (req, res) => {
  try {
    const db = getFirestore();
    const now = admin.firestore.Timestamp.now();
    const contacts = await fetchAllContacts();
    const chunks = chunkArray(contacts, 500);
    for (const chunk of chunks) {
      const batch = db.batch();
      chunk.forEach((c) => batch.set(db.collection('contacts').doc(String(c.id)), { cluster_id: -1, updated_at: now }, { merge: true }));
      await batch.commit();
    }

    const metaSnap = await db.collection('cluster_metadata').limit(MAX_SAFE_SCAN).get();
    for (const chunk of chunkArray(metaSnap.docs, 500)) {
      const batch = db.batch();
      chunk.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    const featuresSnap = await db.collection('features').limit(MAX_SAFE_SCAN).get();
    for (const chunk of chunkArray(featuresSnap.docs, 500)) {
      const batch = db.batch();
      chunk.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    return res.json({
      success: true,
      message: 'Clustering data cleared',
      note: 'Firestore eventual consistency berlaku; verifikasi count bisa butuh jeda singkat.',
    });
  } catch (error) {
    console.error('Clustering clear error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.get('/debug', async (_req, res) => {
  try {
    const db = getFirestore();
    const pythonAvailable = clusteringService.pythonPath !== null;
    const clustered = await fetchAllContacts({ clusteredOnly: true });
    const clusterMeta = await db.collection('cluster_metadata').limit(MAX_SAFE_SCAN).get();
    const features = await db.collection('features').limit(MAX_SAFE_SCAN).get();
    return res.json({
      pythonAvailable,
      pythonPath: clusteringService.pythonPath || 'Not found',
      totalContacts: clustered.length,
      clusteringMetadataRecords: clusterMeta.size,
      tables: {
        contacts: clustered.length,
        cluster_metadata: clusterMeta.size,
        features: features.size,
      },
      status: 'OK',
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
