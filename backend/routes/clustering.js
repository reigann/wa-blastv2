const express = require('express');
const { admin, getFirestore } = require('../services/firebaseAdmin');
const clusteringService = require('../services/clusteringServiceWrapper');

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

// Middleware: Only allow Firebase mode (apply to all routes below)
router.use((req, res, next) => {
  if (STORAGE_PROVIDER !== 'firebase') {
    return res.status(503).json({
      error: 'Clustering route is configured for Firebase storage mode only.',
    });
  }
  return next();
});

// POST /run - Run clustering using Python scikit-learn
router.post('/run', async (req, res) => {
  try {
    console.log('📊 Starting clustering request...');
    const { groupName = null, nClusters = null, features = [] } = req.body || {};
    
    // Load contacts from Firebase
    console.log('Loading contacts...');
    const contacts = await loadContacts(groupName);

    if (contacts.length < 2) {
      return res.status(400).json({ 
        error: 'Minimal 2 kontak diperlukan untuk clustering',
        contactsFound: contacts.length
      });
    }

    // Filter features
    const selectedFeatures = Array.isArray(features)
      ? features.filter((item) => ['recency', 'frequency', 'group', 'prodi'].includes(item))
      : [];
    const featuresUsed = selectedFeatures.length ? selectedFeatures : ['recency', 'frequency', 'group'];

    console.log(`📊 Running Python clustering with ${contacts.length} contacts, ${nClusters || 'auto'} clusters, features: ${featuresUsed.join(',')}`);

    // Run Python clustering service
    let result;
    try {
      result = await clusteringService.runClustering(contacts, nClusters, featuresUsed);
    } catch (pythonError) {
      console.error('❌ Python clustering error:', pythonError.message);
      return res.status(500).json({ 
        error: `Clustering failed: ${pythonError.message}`,
        hint: 'Make sure Python 3.8+ and scikit-learn are installed'
      });
    }

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Unknown clustering error' });
    }

    console.log(`✅ Clustering completed. Labels: ${result.labels.length}, K: ${result.n_clusters}`);

    // Save to Firebase
    const firebaseDb = getFirestore();
    const batch = firebaseDb.batch();
    
    contacts.forEach((contact, index) => {
      const ref = firebaseDb.collection('contacts').doc(String(contact.id));
      batch.set(ref, {
        cluster_id: result.labels[index] || 0,
        updated_at: admin.firestore.Timestamp.now(),
      }, { merge: true });
    });

    console.log('💾 Saving to Firebase...');
    await batch.commit();

    // Save metadata to Firebase
    const now = admin.firestore.Timestamp.now();
    const metadataRef = await firebaseDb.collection('cluster_metadata').add({
      name: `Clustering_${groupName || 'all'}_${new Date().toISOString().slice(0, 10)}`,
      total_contacts: contacts.length,
      num_clusters: result.n_clusters,
      silhouette_score: result.silhouette_score || 0,
      davies_bouldin_index: result.davies_bouldin_index || 0,
      features_used: result.features_used || featuresUsed,
      created_at: now,
      updated_at: now,
    });

    console.log(`✅ Saved cluster metadata with ID: ${metadataRef.id}`);

    // Calculate cluster statistics
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
      message: `Clustering berhasil disimpan dengan ${result.n_clusters} cluster`,
      metrics: {
        silhouette_score: result.silhouette_score || 0,
        davies_bouldin_index: result.davies_bouldin_index || 0,
        n_clusters: result.n_clusters,
        total_contacts: contacts.length,
        cluster_stats: clusterStats,
        features_used: result.features_used || featuresUsed,
      },
    });
  } catch (error) {
    console.error('❌ Clustering run error:', error);
    return res.status(500).json({ 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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

module.exports = router;
