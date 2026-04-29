const express = require('express');
const router = express.Router();
const clusteringService = require('../services/clusteringServiceWrapper');
const db = require('../db/database');

/**
 * POST /api/clustering/run
 * Trigger K-Means clustering
 */
router.post('/run', async (req, res) => {
  try {
    // Check if Python is available
    if (!clusteringService.pythonPath) {
      return res.status(503).json({
        error: 'Clustering service unavailable: Python is not installed or not found in PATH. Please install Python or run: npm run setup-python'
      });
    }

    const { groupName = null, nClusters = null, features = [] } = req.body;

    // Get contacts to cluster
    let query = 'SELECT * FROM contacts';
    const params = [];

    if (groupName) {
      query += ' WHERE group_name = ?';
      params.push(groupName);
    }

    const contacts = db.prepare(query).all(...params);

    console.log(`📊 Starting clustering with ${contacts.length} contacts, nClusters=${nClusters}`);

    if (contacts.length < 2) {
      return res.status(400).json({
        error: 'Minimal 2 kontak diperlukan untuk clustering'
      });
    }

    // Prepare cluster name
    const timestamp = new Date().toISOString().slice(0, 10);
    const clusterName = `Clustering_${groupName || 'all'}_${timestamp}`;

    // Parse nClusters as integer
    const parsedNClusters = nClusters ? parseInt(nClusters) : null;
    if (parsedNClusters !== null && (Number.isNaN(parsedNClusters) || parsedNClusters < 2 || parsedNClusters > 8)) {
      return res.status(400).json({ error: 'nClusters harus di antara 2 sampai 8' });
    }

    const selectedFeatures = Array.isArray(features)
      ? features.filter((item) => ['recency', 'frequency', 'group', 'prodi'].includes(item))
      : [];

    // Run clustering
    const result = await clusteringService.runClustering(contacts, parsedNClusters, selectedFeatures);

    // Save results
    const contactIds = contacts.map(c => c.id);
    const saveResult = await clusteringService.saveClusteringResults(clusterName, result, contactIds);

    res.json({
      success: true,
      clusterId: saveResult.clusterId,
      message: saveResult.message,
      metrics: {
        silhouette_score: result.silhouette_score,
        davies_bouldin_index: result.davies_bouldin_index,
        n_clusters: result.n_clusters,
        total_contacts: contactIds.length,
        cluster_stats: result.cluster_stats,
        features_used: result.features_used
      }
    });

  } catch (error) {
    console.error('❌ Clustering error:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      error: error.message,
      details: error.stack
    });
  }
});

/**
 * GET /api/clustering/results
 * Get clustering results
 */
router.get('/results', (req, res) => {
  try {
    const { clusterId } = req.query;

    if (clusterId) {
      const result = clusteringService.getClusteringResults(parseInt(clusterId));
      return res.json(result);
    }

    const results = clusteringService.getClusteringResults();
    res.json({ results });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/clustering/stats
 * Get cluster statistics
 */
router.get('/stats', (req, res) => {
  try {
    const stats = clusteringService.getClusterStats();
    res.json({ stats });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/clustering/latest
 * Get latest clustering result
 */
router.get('/latest', (req, res) => {
  try {
    const latest = db.prepare(`
      SELECT * FROM cluster_metadata ORDER BY created_at DESC LIMIT 1
    `).get();

    if (!latest) {
      return res.json({ latest: null });
    }

    const contacts = db.prepare(`
      SELECT id, name, phone, cluster_id, group_name, created_at FROM contacts 
      WHERE cluster_id >= 0
      ORDER BY cluster_id, name
    `).all();

    const stats = db.prepare(`
      SELECT 
        cluster_id,
        COUNT(*) as total,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM contacts WHERE cluster_id >= 0), 1) as percentage
      FROM contacts
      WHERE cluster_id >= 0
      GROUP BY cluster_id
      ORDER BY cluster_id
    `).all();

    const logsByPhone = db.prepare(`
      SELECT phone, COUNT(*) AS sent_count
      FROM blast_logs
      WHERE status = 'sent'
      GROUP BY phone
    `).all();
    const sentMap = new Map(logsByPhone.map((row) => [row.phone, row.sent_count]));

    const clusters = stats.map((cluster) => {
      const items = contacts.filter((contact) => contact.cluster_id === cluster.cluster_id);
      const groupCounter = new Map();
      const prodiCounter = new Map();
      let totalRecency = 0;
      let totalFrequency = 0;

      items.forEach((item) => {
        const group = item.group_name || 'default';
        groupCounter.set(group, (groupCounter.get(group) || 0) + 1);
        const prodi = item.minat_prodi || 'Unknown';
        prodiCounter.set(prodi, (prodiCounter.get(prodi) || 0) + 1);
        const createdDate = new Date(item.created_at);
        const recencyDays = Math.max(Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)), 0);
        totalRecency += recencyDays;
        totalFrequency += Number(sentMap.get(item.phone) || 0);
      });

      const topGroups = [...groupCounter.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name);

      const prodiDistribution = [...prodiCounter.entries()]
        .sort((a,b)=>b[1]-a[1])
        .map(([name,count])=>({ name, count, percentage: items.length?Number(((count/items.length)*100).toFixed(1)):0 }));

      return {
        id: cluster.cluster_id,
        total: cluster.total,
        percentage: cluster.percentage,
        avg_recency: items.length ? Number((totalRecency / items.length).toFixed(1)) : 0,
        avg_frequency: items.length ? Number((totalFrequency / items.length).toFixed(1)) : 0,
        top_groups: topGroups,
        prodi_distribution: prodiDistribution
      };
    });

    res.json({
      latest,
      contacts,
      stats,
      clusters,
      features_used: (() => {
        try {
          return latest.features_used ? JSON.parse(latest.features_used) : [];
        } catch (err) {
          return [];
        }
      })()
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/clustering/clear
 * Clear all clustering results
 */
router.delete('/clear', (req, res) => {
  try {
    const result = clusteringService.clearClustering();
    res.json(result);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/clustering/contacts-by-cluster/:clusterId
 * Get contacts in specific cluster
 */
router.get('/contacts-by-cluster/:clusterId', (req, res) => {
  try {
    const clusterId = parseInt(req.params.clusterId);

    const contacts = db.prepare(`
      SELECT id, name, phone, group_name FROM contacts 
      WHERE cluster_id = ?
      ORDER BY name
    `).all(clusterId);

    res.json({ clusterId, count: contacts.length, contacts });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/clustering/debug
 * Debug clustering service
 */
router.get('/debug', (req, res) => {
  try {
    const contactCount = db.prepare('SELECT COUNT(*) as count FROM contacts').get().count;
    const clusterCount = db.prepare('SELECT COUNT(*) as count FROM cluster_metadata').get().count;
    
    res.json({
      pythonAvailable: !!clusteringService.pythonPath,
      pythonPath: clusteringService.pythonPath || 'not found',
      totalContacts: contactCount,
      clusteringMetadataRecords: clusterCount,
      tables: {
        contacts: true,
        cluster_metadata: true,
        features: true
      },
      status: 'OK'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
