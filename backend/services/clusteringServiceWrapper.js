const { spawn } = require('child_process');
const path = require('path');
const db = require('../db/database');

class ClusteringServiceWrapper {
  constructor() {
    // Use Python from venv
    this.pythonPath = path.join(__dirname, '../../.venv/Scripts/python.exe');
  }

  /**
   * Run K-Means clustering on contacts
   */
  async runClustering(contacts, nClusters = null) {
    return new Promise((resolve, reject) => {
      try {
        // Prepare data
        const contactData = contacts.map(c => ({
          id: c.id,
          minat_prodi: c.minat_prodi || 'Teknik Informatika',
          asal_sekolah: c.asal_sekolah || 'unknown'
        }));

        const args = [
          path.join(__dirname, 'clusteringService.py'),
          JSON.stringify(contactData)
        ];

        if (nClusters) {
          args.push(nClusters.toString());
        }

        // Spawn Python process
        const python = spawn(this.pythonPath, args, {
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        });

        let output = '';
        let error = '';

        python.stdout.on('data', (data) => {
          output += data.toString();
        });

        python.stderr.on('data', (data) => {
          error += data.toString();
        });

        python.on('close', (code) => {
          if (code !== 0) {
            return reject(new Error(`Python script failed: ${error}`));
          }

          try {
            const result = JSON.parse(output);
            if (!result.success) {
              return reject(new Error(result.error));
            }
            resolve(result);
          } catch (e) {
            reject(new Error(`Failed to parse Python output: ${e.message}`));
          }
        });

      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Save clustering results to database
   */
  async saveClusteringResults(clusterName, result, contactIds) {
    try {
      // Insert cluster metadata
      const metadataStmt = db.prepare(`
        INSERT INTO cluster_metadata (name, total_contacts, num_clusters, silhouette_score, davies_bouldin_index, features_used, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);

      const clusterId = metadataStmt.run(
        clusterName,
        contactIds.length,
        result.n_clusters,
        result.silhouette_score,
        result.davies_bouldin_index,
        JSON.stringify(result.features_used)
      ).lastInsertRowid;

      // Update contacts with cluster assignments
      const updateContactStmt = db.prepare(`
        UPDATE contacts SET cluster_id = ? WHERE id = ?
      `);

      const transaction = db.transaction(() => {
        for (let i = 0; i < contactIds.length; i++) {
          updateContactStmt.run(result.labels[i], contactIds[i]);
        }
      });

      transaction();

      // Save features
      const featureStmt = db.prepare(`
        INSERT INTO features (contact_id, feature_name, feature_value)
        VALUES (?, ?, ?)
        ON CONFLICT(contact_id, feature_name) DO UPDATE SET feature_value = excluded.feature_value
      `);

      return {
        success: true,
        clusterId,
        message: `Clustering berhasil disimpan dengan ${result.n_clusters} cluster`
      };

    } catch (err) {
      throw new Error(`Failed to save clustering results: ${err.message}`);
    }
  }

  /**
   * Get clustering results
   */
  getClusteringResults(clusterId = null) {
    try {
      if (clusterId) {
        const metadata = db.prepare(`
          SELECT * FROM cluster_metadata WHERE id = ?
        `).get(clusterId);

        if (!metadata) {
          throw new Error('Clustering tidak ditemukan');
        }

        const contacts = db.prepare(`
          SELECT id, name, phone, cluster_id, group_name FROM contacts 
          WHERE cluster_id >= 0
          ORDER BY cluster_id, name
        `).all();

        return {
          metadata,
          contacts
        };
      } else {
        // Get all clustering results
        const results = db.prepare(`
          SELECT * FROM cluster_metadata ORDER BY created_at DESC
        `).all();

        return results;
      }
    } catch (err) {
      throw new Error(`Failed to get clustering results: ${err.message}`);
    }
  }

  /**
   * Get cluster statistics
   */
  getClusterStats(clusterId = null) {
    try {
      let whereClause = 'WHERE cluster_id >= 0';
      const params = [];

      if (clusterId) {
        whereClause = `WHERE id = ?`;
        params.push(clusterId);
      }

      const stats = db.prepare(`
        SELECT 
          cluster_id,
          COUNT(*) as total,
          COUNT(*) * 100.0 / (SELECT COUNT(*) FROM contacts WHERE cluster_id >= 0) as percentage
        FROM contacts
        ${whereClause}
        GROUP BY cluster_id
        ORDER BY cluster_id
      `).all(...params);

      return stats;
    } catch (err) {
      throw new Error(`Failed to get cluster stats: ${err.message}`);
    }
  }

  /**
   * Clear clustering results
   */
  clearClustering() {
    try {
      db.exec(`
        UPDATE contacts SET cluster_id = -1;
        DELETE FROM cluster_metadata;
        DELETE FROM features;
      `);

      return { success: true, message: 'Clustering berhasil dihapus' };
    } catch (err) {
      throw new Error(`Failed to clear clustering: ${err.message}`);
    }
  }
}

module.exports = new ClusteringServiceWrapper();
