const express = require('express');
const { admin, getFirestore } = require('../services/firebaseAdmin');

const router = express.Router();
const STORAGE_PROVIDER = (process.env.STORAGE_PROVIDER || 'firebase').toLowerCase();

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

function clampClusters(value, totalContacts) {
  const parsed = Number(value);
  const desired = Number.isFinite(parsed) ? Math.floor(parsed) : 3;
  const maxAllowed = Math.min(8, totalContacts);
  return Math.max(2, Math.min(desired, maxAllowed));
}

function toVector(contact, sentMap, selectedFeatures) {
  const created = toMillis(contact.created_at);
  const recencyDays = created > 0 ? Math.max(Math.floor((Date.now() - created) / 86400000), 0) : 0;
  const frequency = Number(sentMap.get(normalizePhone(contact.phone)) || 0);
  const groupSignal = String(contact.group_name || 'default').length;
  const prodiSignal = String(contact.minat_prodi || 'unknown').length;

  const featureMap = {
    recency: recencyDays,
    frequency,
    group: groupSignal,
    prodi: prodiSignal,
  };

  return selectedFeatures.map((key) => Number(featureMap[key] || 0));
}

function distanceSquared(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const diff = (a[i] || 0) - (b[i] || 0);
    sum += diff * diff;
  }
  return sum;
}

function meanVector(vectors, fallback) {
  if (!vectors.length) return fallback.slice();
  const size = vectors[0].length;
  const out = Array.from({ length: size }, () => 0);
  vectors.forEach((v) => {
    for (let i = 0; i < size; i += 1) out[i] += Number(v[i] || 0);
  });
  for (let i = 0; i < size; i += 1) out[i] /= vectors.length;
  return out;
}

function runSimpleKMeans(vectors, k, maxIterations = 12) {
  const centroids = vectors.slice(0, k).map((v) => v.slice());
  const labels = Array.from({ length: vectors.length }, () => 0);

  for (let iter = 0; iter < maxIterations; iter += 1) {
    let changed = false;

    for (let i = 0; i < vectors.length; i += 1) {
      let bestIndex = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      for (let c = 0; c < k; c += 1) {
        const dist = distanceSquared(vectors[i], centroids[c]);
        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = c;
        }
      }
      if (labels[i] !== bestIndex) {
        labels[i] = bestIndex;
        changed = true;
      }
    }

    const groups = Array.from({ length: k }, () => []);
    for (let i = 0; i < vectors.length; i += 1) groups[labels[i]].push(vectors[i]);

    for (let c = 0; c < k; c += 1) {
      centroids[c] = meanVector(groups[c], centroids[c]);
    }

    if (!changed) break;
  }

  return { labels, centroids };
}

async function loadContacts(groupName = null) {
  const db = getFirestore();
  let query = db.collection('contacts');
  if (groupName) query = query.where('group_name', '==', groupName);
  const snap = await query.get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function getSentMap() {
  const db = getFirestore();
  const sentLogs = await db.collection('blast_logs').where('status', '==', 'sent').get();
  const map = new Map();
  sentLogs.docs.forEach((doc) => {
    const data = doc.data();
    const key = normalizePhone(data.phone);
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  });
  return map;
}

router.use((req, res, next) => {
  if (STORAGE_PROVIDER !== 'firebase') {
    return res.status(503).json({
      error: 'Clustering route is configured for Firebase storage mode only.',
    });
  }
  return next();
});

router.post('/run', async (req, res) => {
  try {
    const { groupName = null, nClusters = null, features = [] } = req.body || {};
    const contacts = await loadContacts(groupName);

    if (contacts.length < 2) {
      return res.status(400).json({ error: 'Minimal 2 kontak diperlukan untuk clustering' });
    }

    const selectedFeatures = Array.isArray(features)
      ? features.filter((item) => ['recency', 'frequency', 'group', 'prodi'].includes(item))
      : [];
    const featuresUsed = selectedFeatures.length ? selectedFeatures : ['recency', 'frequency', 'group'];

    const k = clampClusters(nClusters, contacts.length);
    const sentMap = await getSentMap();
    const vectors = contacts.map((contact) => toVector(contact, sentMap, featuresUsed));
    const result = runSimpleKMeans(vectors, k);

    const db = getFirestore();
    const batch = db.batch();
    contacts.forEach((contact, index) => {
      const ref = db.collection('contacts').doc(String(contact.id));
      batch.set(ref, { cluster_id: result.labels[index], updated_at: admin.firestore.Timestamp.now() }, { merge: true });
    });
    await batch.commit();

    const now = admin.firestore.Timestamp.now();
    const metadataRef = await db.collection('cluster_metadata').add({
      name: `Clustering_${groupName || 'all'}_${new Date().toISOString().slice(0, 10)}`,
      total_contacts: contacts.length,
      num_clusters: k,
      silhouette_score: 0,
      davies_bouldin_index: 0,
      features_used: featuresUsed,
      created_at: now,
      updated_at: now,
    });

    const clusterCounter = new Map();
    result.labels.forEach((label) => {
      clusterCounter.set(label, (clusterCounter.get(label) || 0) + 1);
    });

    const clusterStats = Array.from(clusterCounter.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([clusterId, total]) => ({
        cluster_id: clusterId,
        total,
        percentage: Number(((total / contacts.length) * 100).toFixed(1)),
      }));

    return res.json({
      success: true,
      clusterId: metadataRef.id,
      message: `Clustering berhasil disimpan dengan ${k} cluster`,
      metrics: {
        silhouette_score: 0,
        davies_bouldin_index: 0,
        n_clusters: k,
        total_contacts: contacts.length,
        cluster_stats: clusterStats,
        features_used: featuresUsed,
      },
    });
  } catch (error) {
    console.error('Clustering run error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.get('/latest', async (req, res) => {
  try {
    const db = getFirestore();

    const latestSnap = await db.collection('cluster_metadata').orderBy('created_at', 'desc').limit(1).get();
    const latestDoc = latestSnap.empty ? null : latestSnap.docs[0];
    const latest = latestDoc ? { id: latestDoc.id, ...latestDoc.data() } : null;

    if (!latest) {
      return res.json({ latest: null, contacts: [], stats: [], clusters: [], features_used: [] });
    }

    const contactsSnap = await db.collection('contacts').get();
    const contacts = contactsSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((contact) => Number(contact.cluster_id) >= 0)
      .sort((a, b) => Number(a.cluster_id) - Number(b.cluster_id));

    const sentMap = await getSentMap();
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
      const prodiCounter = new Map();
      let totalRecency = 0;
      let totalFrequency = 0;

      items.forEach((item) => {
        const group = item.group_name || 'default';
        const prodi = item.minat_prodi || 'Unknown';
        groupCounter.set(group, (groupCounter.get(group) || 0) + 1);
        prodiCounter.set(prodi, (prodiCounter.get(prodi) || 0) + 1);

        const created = toMillis(item.created_at);
        const recencyDays = created > 0 ? Math.max(Math.floor((Date.now() - created) / 86400000), 0) : 0;
        totalRecency += recencyDays;
        totalFrequency += Number(sentMap.get(normalizePhone(item.phone)) || 0);
      });

      const topGroups = Array.from(groupCounter.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name);

      const prodiDistribution = Array.from(prodiCounter.entries())
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
        top_groups: topGroups,
        prodi_distribution: prodiDistribution,
      };
    });

    return res.json({
      latest,
      contacts,
      stats,
      clusters,
      features_used: Array.isArray(latest.features_used) ? latest.features_used : [],
    });
  } catch (error) {
    console.error('Clustering latest error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/clear', async (req, res) => {
  try {
    const db = getFirestore();

    const contactsSnap = await db.collection('contacts').get();
    let batch = db.batch();
    const commitJobs = [];
    let op = 0;

    contactsSnap.docs.forEach((doc) => {
      batch.set(doc.ref, { cluster_id: -1, updated_at: admin.firestore.Timestamp.now() }, { merge: true });
      op += 1;
      if (op % 450 === 0) {
        commitJobs.push(batch.commit());
        batch = db.batch();
      }
    });
    if (op % 450 !== 0 || op === 0) {
      commitJobs.push(batch.commit());
    }
    await Promise.all(commitJobs);

    const metadataSnap = await db.collection('cluster_metadata').get();
    let deleteBatch = db.batch();
    const deleteJobs = [];
    let delOp = 0;
    metadataSnap.docs.forEach((doc) => {
      deleteBatch.delete(doc.ref);
      delOp += 1;
      if (delOp % 450 === 0) {
        deleteJobs.push(deleteBatch.commit());
        deleteBatch = db.batch();
      }
    });
    if (delOp % 450 !== 0 || delOp === 0) {
      deleteJobs.push(deleteBatch.commit());
    }
    await Promise.all(deleteJobs);

    return res.json({ success: true, message: 'Clustering berhasil dihapus' });
  } catch (error) {
    console.error('Clustering clear error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.get('/contacts-by-cluster/:clusterId', async (req, res) => {
  try {
    const clusterId = Number(req.params.clusterId);
    const snap = await getFirestore().collection('contacts').where('cluster_id', '==', clusterId).get();
    const contacts = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

    return res.json({ clusterId, count: contacts.length, contacts });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/results', async (req, res) => {
  try {
    const { clusterId } = req.query;
    if (clusterId) {
      const doc = await getFirestore().collection('cluster_metadata').doc(String(clusterId)).get();
      if (!doc.exists) return res.status(404).json({ error: 'Clustering tidak ditemukan' });
      return res.json({ metadata: { id: doc.id, ...doc.data() } });
    }
    const snap = await getFirestore().collection('cluster_metadata').orderBy('created_at', 'desc').get();
    return res.json({ results: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const contactsSnap = await getFirestore().collection('contacts').get();
    const clustered = contactsSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((contact) => Number(contact.cluster_id) >= 0);

    const counts = new Map();
    clustered.forEach((contact) => {
      const key = Number(contact.cluster_id);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    const total = clustered.length || 1;
    const stats = Array.from(counts.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([cluster_id, count]) => ({
        cluster_id,
        total: count,
        percentage: Number(((count / total) * 100).toFixed(1)),
      }));

    return res.json({ stats });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/debug', async (req, res) => {
  try {
    const db = getFirestore();
    const contactsCount = (await db.collection('contacts').get()).size;
    const metadataCount = (await db.collection('cluster_metadata').get()).size;

    return res.json({
      pythonAvailable: false,
      pythonPath: 'not_required_in_firebase_mode',
      totalContacts: contactsCount,
      clusteringMetadataRecords: metadataCount,
      storage: STORAGE_PROVIDER,
      status: 'OK',
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
