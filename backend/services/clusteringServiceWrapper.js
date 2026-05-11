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
  const fs = require('fs');
  const candidates = [];

  if (os.platform() === 'win32') {
    candidates.push(
      // 1. Cek folder venv (tanpa titik) di dalam backend
      path.join(__dirname, '../venv/Scripts/python.exe'), 
      path.join(process.cwd(), 'backend/venv/Scripts/python.exe'),
      // 2. Tambahkan juga pengecekan .venv (dengan titik) untuk jaga-jaga
      path.join(__dirname, '../.venv/Scripts/python.exe'),
      'python.exe',
      'python3.exe'
    );
  } else {
    candidates.push(
      path.join(__dirname, '../venv/bin/python'),
      path.join(__dirname, '../.venv/bin/python'),
      'python',
      'python3'
    );
  }

    // Try each candidate - full paths first
    for (const python of candidates) {
      try {
        if (fs.existsSync(python)) return python;
      } catch (err) {
        // ignore
      }
    }

    return null;
  }


  /**
   * Run K-Means clustering on contacts
   */
  async runClustering(contacts, nClusters = null, selectedFeatures = []) {
    return new Promise((resolve, reject) => {
      try {
        // Check if Python is available
        if (!this.pythonPath) {
          return reject(new Error('Python is not installed or not found in PATH. Clustering feature is unavailable.'));
        }

        // Prepare data - use message_count already provided or from contact object
        const contactData = contacts.map((c) => ({
          id: c.id,
          group_name: c.group_name || 'default',
          created_at: c.created_at,
          message_count: Number(c.message_count || 0),
          minat_prodi: c.minat_prodi || 'Teknik Informatika',
          asal_sekolah: c.asal_sekolah || 'unknown',
        }));

        const args = [
          "-u",
          "-c",
          `import runpy, json, sys; 
contact_data=json.loads(sys.argv[1]); 
selected_features=json.loads(sys.argv[2]); 
# Patch argv expected by clusteringService.py: [contacts_json, n_clusters(optional), selected_features(optional)]
# We'll run clusteringService.py but override sys.argv accordingly.
sys.argv=['clusteringService.py', json.dumps(contact_data), ${nClusters ? 'str('+nClusters+')' : '""'} , json.dumps(selected_features)];
runpy.run_path('${path.join(__dirname, 'clusteringService.py').replace(/\\/g,'\\\\')}', run_name='__main__')`,
          JSON.stringify(contactData),
          JSON.stringify(selectedFeatures)
        ];



        if (nClusters) {
          args.push(nClusters.toString());
        }
        if (selectedFeatures && selectedFeatures.length > 0) {
          args.push(JSON.stringify(selectedFeatures));
        }

        // Spawn Python process (Windows-safe)
        console.log(`🐍 Spawning Python: ${this.pythonPath}`);
        console.log(`📊 Script: ${args[0]}`);
        console.log(`👥 Contacts: ${contactData.length}`);

        // On Windows, passing an interpreter absolute path directly to spawn()
        // can still resolve incorrectly in some environments.
        // Using cmd.exe makes interpreter routing deterministic.
        const python = spawn(this.pythonPath, args, {
        maxBuffer: 10 * 1024 * 1024,
        timeout: 60000,
        windowsHide: true,
      });


        // Force windows-style stderr capture in case python wraps interpreter resolution
        // (Observed failure mentions /usr/bin/python.exe; this helps expose full argv)
        console.log('🐍 Python argv:', python.spawnargs);


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
          console.error(`❌ Python spawn error: ${err.message}`);
          console.error(`   Python path was: ${this.pythonPath}`);
          reject(new Error(`Python not found at: ${this.pythonPath}\n${err.message}`));
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
            if (selectedFeatures && selectedFeatures.length > 0) {
              result.features_used = selectedFeatures;
            }
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
