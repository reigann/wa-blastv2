const { spawn } = require('child_process');
const path = require('path');
const db = require('../db/database');
const os = require('os');

class ClusteringServiceWrapper {
  constructor() {
    // Try multiple paths for Python
    this.pythonPath = this.findPython();
    if (!this.pythonPath) {
      console.warn('⚠️  Python not found - Clustering features will be disabled');
    } else {
      console.log(`✅ Using Python: ${this.pythonPath}`);
    }
  }

  /**
   * Find Python executable in various locations
   */
  findPython() {
    const candidates = [];
    
    // Windows paths
    if (os.platform() === 'win32') {
      candidates.push(
        path.join(__dirname, '../../.venv/Scripts/python.exe'),
        'python.exe',
        'python3.exe',
        'py.exe'
      );
    } else {
      // Unix/Linux/Mac paths
      candidates.push(
        path.join(__dirname, '../../.venv/bin/python'),
        path.join(__dirname, '../../.venv/bin/python3'),
        'python',
        'python3'
      );
    }

    // Try each candidate
    for (const python of candidates) {
      try {
        // For global commands, we can't check if exists easily, so just return them
        if (python === 'python.exe' || python === 'python3.exe' || python === 'python' || python === 'python3' || python === 'py.exe') {
          return python;
        }
        // For full paths, verify they exist
        const fs = require('fs');
        if (fs.existsSync(python)) {
          return python;
        }
      } catch (err) {
        // Continue to next candidate
      }
    }

    return null;
  }

  /**
   * Run K-Means clustering on contacts
   */
  async runClustering(contacts, nClusters = null) {
    return new Promise((resolve, reject) => {
      try {
        // Check if Python is available
        if (!this.pythonPath) {
          return reject(new Error('Python is not installed or not found in PATH. Clustering feature is unavailable.'));
        }

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
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
          timeout: 60000 // 60 second timeout
        });

        let output = '';
        let error = '';

        python.stdout.on('data', (data) => {
          output += data.toString();
        });

        python.stderr.on('data', (data) => {
          error += data.toString();
        });

        python.on('error', (err) => {
          // Handle spawn errors (e.g., Python not found)
          reject(new Error(`Failed to spawn Python process: ${err.message}`));
        });

        python.on('close', (code) => {
          if (code !== 0) {
            // Return more detailed error message
            const errorMsg = error || `Python script exited with code ${code}`;
            console.error('❌ Python script error:', errorMsg);
            return reject(new Error(`Clustering failed: ${errorMsg}`));
          }

          try {
            if (!output.trim()) {
              return reject(new Error('Python script produced no output'));
            }
            const result = JSON.parse(output);
            if (!result.success) {
              console.error('❌ Python script returned error:', result.error);
              return reject(new Error(result.error || 'Unknown clustering error'));
            }
            console.log('✅ Python clustering completed successfully');
            resolve(result);
          } catch (e) {
            console.error('❌ Failed to parse Python output:', output);
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
      // Validate result object
      if (!result || !result.labels || !Array.isArray(result.labels)) {
        throw new Error(`Invalid clustering result: missing or invalid labels array. Got: ${JSON.stringify(result).substring(0, 200)}`);
      }

      if (result.labels.length !== contactIds.length) {
        throw new Error(`Labels count (${result.labels.length}) doesn't match contacts count (${contactIds.length})`);
      }

      // Insert cluster metadata
      const metadataStmt = db.prepare(`
        INSERT INTO cluster_metadata (name, total_contacts, num_clusters, silhouette_score, davies_bouldin_index, features_used, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);

      const clusterId = metadataStmt.run(
        clusterName,
        contactIds.length,
        result.n_clusters || 3,
        result.silhouette_score || 0,
        result.davies_bouldin_index || 0,
        JSON.stringify(result.features_used || [])
      ).lastInsertRowid;

      console.log(`✅ Saved cluster metadata with ID: ${clusterId}`);

      // Update contacts with cluster assignments
      const updateContactStmt = db.prepare(`
        UPDATE contacts SET cluster_id = ? WHERE id = ?
      `);

      const transaction = db.transaction(() => {
        for (let i = 0; i < contactIds.length; i++) {
          const clusterId = result.labels[i];
          const contactId = contactIds[i];
          updateContactStmt.run(clusterId, contactId);
        }
      });

      transaction();
      console.log(`✅ Updated ${contactIds.length} contacts with cluster assignments`);

      return {
        success: true,
        clusterId,
        message: `Clustering berhasil disimpan dengan ${result.n_clusters || 3} cluster`
      };

    } catch (err) {
      console.error('❌ Failed to save clustering results:', err.message);
      throw err;
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
