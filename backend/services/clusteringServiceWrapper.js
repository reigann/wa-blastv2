const { spawn } = require('child_process');
const path = require('path');
const db = require('../db/database');
const os = require('os');

function parseDate(dateStr) {
  if (!dateStr) return new Date();
  const d = new Date(typeof dateStr.toDate === 'function' ? dateStr.toDate() : String(dateStr).replace('Z', ''));
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function recencyDays(dateStr) {
  return Math.max(Math.floor((Date.now() - parseDate(dateStr).getTime()) / 86400000), 0);
}

function std(arr) {
  const n = arr.length;
  if (n < 2) return { mean: arr[0] || 0, std: 1 };
  const sum = arr.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  return { mean, std: Math.sqrt(variance) || 1 };
}

function standardize(matrix) {
  const nCols = matrix[0].length;
  const scaled = matrix.map((row) => [...row]);
  for (let j = 0; j < nCols; j++) {
    const col = matrix.map((row) => row[j]);
    const { mean, std: s } = std(col);
    for (let i = 0; i < matrix.length; i++) {
      scaled[i][j] = (scaled[i][j] - mean) / s;
    }
  }
  return scaled;
}

function euclidean(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

function kMeans(data, k, maxIter = 100) {
  const n = data.length;
  const dim = data[0].length;
  let centroids = [];
  const seen = new Set();
  for (let i = 0; i < k; i++) {
    let idx;
    do { idx = Math.floor(Math.random() * n); } while (seen.has(idx));
    seen.add(idx);
    centroids.push([...data[idx]]);
  }

  let labels = new Array(n).fill(0);
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      let minDist = Infinity;
      let best = 0;
      for (let j = 0; j < k; j++) {
        const dist = euclidean(data[i], centroids[j]);
        if (dist < minDist) { minDist = dist; best = j; }
      }
      if (labels[i] !== best) changed = true;
      labels[i] = best;
    }
    if (!changed) break;

    const sums = Array.from({ length: k }, () => new Array(dim).fill(0));
    const counts = new Array(k).fill(0);
    for (let i = 0; i < n; i++) {
      const lbl = labels[i];
      counts[lbl]++;
      for (let j = 0; j < dim; j++) sums[lbl][j] += data[i][j];
    }
    for (let j = 0; j < k; j++) {
      if (counts[j] > 0) {
        for (let d = 0; d < dim; d++) centroids[j][d] = sums[j][d] / counts[j];
      }
    }
  }

  return { labels, centroids };
}

function silhouetteScore(data, labels) {
  const n = data.length;
  if (n < 2) return 0;
  const unique = [...new Set(labels)];
  if (unique.length < 2) return 0;

  let total = 0;
  for (let i = 0; i < n; i++) {
    let a = 0; let aCount = 0;
    let b = Infinity;
    for (const c of unique) {
      if (c === labels[i]) {
        for (let j = 0; j < n; j++) {
          if (i !== j && labels[j] === c) {
            a += euclidean(data[i], data[j]);
            aCount++;
          }
        }
      }
    }
    a = aCount > 0 ? a / aCount : 0;

    for (const c of unique) {
      if (c === labels[i]) continue;
      let sum = 0; let cnt = 0;
      for (let j = 0; j < n; j++) {
        if (labels[j] === c) {
          sum += euclidean(data[i], data[j]);
          cnt++;
        }
      }
      const avg = cnt > 0 ? sum / cnt : 0;
      if (avg < b) b = avg;
    }

    const maxAB = Math.max(a, b) || 1;
    total += (b - a) / maxAB;
  }
  return total / n;
}

function daviesBouldinIndex(data, labels) {
  const unique = [...new Set(labels)];
  const k = unique.length;
  if (k < 2) return 0;

  const means = {};
  const avgDists = {};
  for (const c of unique) {
    const points = data.filter((_, i) => labels[i] === c);
    const n = points.length;
    if (n === 0) { means[c] = new Array(data[0].length).fill(0); avgDists[c] = 0; continue; }
    const mean = new Array(data[0].length).fill(0);
    for (const p of points) for (let j = 0; j < p.length; j++) mean[j] += p[j];
    for (let j = 0; j < mean.length; j++) mean[j] /= n;
    means[c] = mean;
    let s = 0;
    for (const p of points) s += euclidean(p, mean);
    avgDists[c] = s / n;
  }

  let total = 0;
  for (let i = 0; i < k; i++) {
    let maxVal = 0;
    for (let j = 0; j < k; j++) {
      if (i === j) continue;
      const d = euclidean(means[unique[i]], means[unique[j]]) || 1;
      const val = (avgDists[unique[i]] + avgDists[unique[j]]) / d;
      if (val > maxVal) maxVal = val;
    }
    total += maxVal;
  }
  return total / k;
}

class ClusteringServiceWrapper {
  constructor() {
    this.pythonPath = this.findPython();
    if (!this.pythonPath) {
      console.warn('⚠️  Python not found - using JS fallback for clustering');
    } else {
      console.log(`✅ Using Python: ${this.pythonPath}`);
    }
  }

  findPython() {
    const fs = require('fs');
    const { execSync } = require('child_process');
    const backendDir = path.join(__dirname, '..');
    const candidates = [];

    if (os.platform() === 'win32') {
      candidates.push(
        path.join(backendDir, 'venv/Scripts/python.exe'),
        path.join(backendDir, '.venv/Scripts/python.exe'),
        'python.exe',
        'python3.exe'
      );
      try {
        const pythonFromWhere = execSync('where python', { encoding: 'utf-8', cwd: backendDir }).trim().split('\n')[0];
        if (pythonFromWhere) candidates.unshift(pythonFromWhere);
      } catch (_) { }
    } else {
      candidates.push(
        path.join(backendDir, 'venv/bin/python'),
        path.join(backendDir, '.venv/bin/python'),
        'python',
        'python3'
      );
      try {
        const pythonFromWhich = execSync('which python', { encoding: 'utf-8', cwd: backendDir }).trim();
        if (pythonFromWhich) candidates.unshift(pythonFromWhich);
      } catch (_) { }
    }

    for (const python of candidates) {
      try {
        if (fs.existsSync(python)) {
          execSync(`"${python}" --version`, { encoding: 'utf-8', stdio: 'pipe' });
          return python;
        }
      } catch (_) { }
    }
    return null;
  }

  runJSClustering(contacts, nClusters, selectedFeatures) {
    const selected = (selectedFeatures && selectedFeatures.length > 0)
      ? selectedFeatures
      : ['recency', 'frequency', 'group', 'prodi'];

    const matrix = [];
    const featureNames = [];

    let topProdis = [];
    if (selected.includes('prodi')) {
      const counts = {};
      for (const c of contacts) {
        const p = (c.minat_prodi || 'unknown').trim().toLowerCase();
        counts[p] = (counts[p] || 0) + 1;
      }
      topProdis = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([k]) => k);
    }

    let topSchools = [];
    if (selected.includes('school')) {
      const counts = {};
      for (const c of contacts) {
        const s = (c.asal_sekolah || 'unknown').trim();
        counts[s] = (counts[s] || 0) + 1;
      }
      topSchools = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([k]) => k);
    }

    for (const contact of contacts) {
      const row = [];
      if (selected.includes('recency')) {
        row.push(recencyDays(contact.created_at));
        if (!featureNames.includes('recency_days')) featureNames.push('recency_days');
      }
      if (selected.includes('frequency')) {
        row.push(Number(contact.message_count || 0));
        if (!featureNames.includes('message_count')) featureNames.push('message_count');
      }
      if (selected.includes('group')) {
        const g = String(contact.group_name || 'default').toLowerCase();
        row.push(Array.from(g).reduce((s, c) => s + c.charCodeAt(0), 0) % 100);
        if (!featureNames.includes('group_hash')) featureNames.push('group_hash');
      }
      if (selected.includes('prodi')) {
        const p = (contact.minat_prodi || 'unknown').trim().toLowerCase();
        if (topProdis.length === 0) {
          row.push(Array.from(p).reduce((s, c) => s + c.charCodeAt(0), 0) % 100);
          if (!featureNames.includes('prodi_hash')) featureNames.push('prodi_hash');
        } else {
          for (const tp of topProdis) {
            row.push(p === tp ? 1.0 : 0.0);
          }
          if (!featureNames.some((f) => f.startsWith('prodi_'))) {
            for (const tp of topProdis) {
              featureNames.push(`prodi_${tp.replace(/\s+/g, '_').slice(0, 30)}`);
            }
          }
        }
      }
      if (selected.includes('school')) {
        const s = (contact.asal_sekolah || 'unknown').trim();
        if (topSchools.length === 0) {
          row.push(Array.from(s).reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 100);
          if (!featureNames.includes('sekolah_hash')) featureNames.push('sekolah_hash');
        } else {
          for (const ts of topSchools) {
            row.push(s === ts ? 1.0 : 0.0);
          }
          if (!featureNames.some((f) => f.startsWith('sekolah_'))) {
            for (const ts of topSchools) {
              featureNames.push(`sekolah_${ts.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30)}`);
            }
          }
        }
      }
      matrix.push(row);
    }

    if (matrix.length < 2) {
      return { success: false, error: 'Minimal 2 kontak diperlukan untuk clustering' };
    }
    if (matrix[0].length < 1) {
      return { success: false, error: 'Tidak ada fitur yang bisa digunakan untuk clustering' };
    }

    const scaled = standardize(matrix);
    const k = nClusters || Math.min(3, matrix.length - 1);
    const result = kMeans(scaled, k);

    const sil = silhouetteScore(scaled, result.labels);
    const dbIdx = daviesBouldinIndex(scaled, result.labels);

    return {
      success: true,
      labels: result.labels,
      silhouette_score: sil,
      davies_bouldin_index: dbIdx,
      n_clusters: k,
      features_used: selectedFeatures && selectedFeatures.length > 0 ? selectedFeatures : featureNames,
    };
  }

  async runClustering(contacts, nClusters = null, selectedFeatures = []) {
    // Try Python first if available
    if (this.pythonPath) {
      try {
        return await this._runPythonClustering(contacts, nClusters, selectedFeatures);
      } catch (pyErr) {
        console.warn('⚠️  Python clustering failed, falling back to JS:', pyErr.message);
      }
    }
    // JS fallback
    console.log('📊 Running JS K-Means clustering...');
    return this.runJSClustering(contacts, nClusters, selectedFeatures);
  }

  _runPythonClustering(contacts, nClusters, selectedFeatures) {
    return new Promise((resolve, reject) => {
      try {
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
sys.argv=['clusteringService.py', json.dumps(contact_data), ${nClusters ? 'str('+nClusters+')' : '""'} , json.dumps(selected_features)];
runpy.run_path('${path.join(__dirname, 'clusteringService.py').replace(/\\/g,'\\\\')}', run_name='__main__')`,
          JSON.stringify(contactData),
          JSON.stringify(selectedFeatures)
        ];

        if (nClusters) args.push(nClusters.toString());
        if (selectedFeatures && selectedFeatures.length > 0) args.push(JSON.stringify(selectedFeatures));

        console.log(`🐍 Spawning Python: ${this.pythonPath}`);
        console.log(`👥 Contacts: ${contactData.length}`);

        const python = spawn(this.pythonPath, args, {
          maxBuffer: 10 * 1024 * 1024,
          timeout: 60000,
          windowsHide: true,
        });

        let output = '';
        let error = '';

        python.stdout.on('data', (data) => { output += data.toString(); });
        python.stderr.on('data', (data) => { error += data.toString(); });

        python.on('error', (err) => {
          reject(new Error(`Python spawn error: ${err.message}`));
        });

        python.on('close', (code) => {
          if (code !== 0) {
            return reject(new Error(error || `Python exited with code ${code}`));
          }
          try {
            if (!output.trim()) return reject(new Error('Python produced no output'));
            const result = JSON.parse(output);
            if (!result.success) return reject(new Error(result.error || 'Unknown Python error'));
            if (selectedFeatures && selectedFeatures.length > 0) result.features_used = selectedFeatures;
            resolve(result);
          } catch (e) {
            reject(new Error(`Parse error: ${e.message}. Output: ${output.slice(0, 500)}`));
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  async saveClusteringResults(clusterName, result, contactIds) {
    try {
      if (!result || !result.labels || !Array.isArray(result.labels)) {
        throw new Error(`Invalid clustering result: missing or invalid labels array. Got: ${JSON.stringify(result).substring(0, 200)}`);
      }
      if (result.labels.length !== contactIds.length) {
        throw new Error(`Labels count (${result.labels.length}) doesn't match contacts count (${contactIds.length})`);
      }

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

      const updateContactStmt = db.prepare(`UPDATE contacts SET cluster_id = ? WHERE id = ?`);
      const transaction = db.transaction(() => {
        for (let i = 0; i < contactIds.length; i++) {
          updateContactStmt.run(result.labels[i], contactIds[i]);
        }
      });
      transaction();

      return { success: true, clusterId, message: `Clustering berhasil disimpan dengan ${result.n_clusters || 3} cluster` };
    } catch (err) {
      console.error('❌ Failed to save clustering results:', err.message);
      throw err;
    }
  }

  getClusteringResults(clusterId = null) {
    try {
      if (clusterId) {
        const metadata = db.prepare(`SELECT * FROM cluster_metadata WHERE id = ?`).get(clusterId);
        if (!metadata) throw new Error('Clustering tidak ditemukan');
        const contacts = db.prepare(`SELECT id, name, phone, cluster_id, group_name FROM contacts WHERE cluster_id >= 0 ORDER BY cluster_id, name`).all();
        return { metadata, contacts };
      }
      return db.prepare(`SELECT * FROM cluster_metadata ORDER BY created_at DESC`).all();
    } catch (err) {
      throw new Error(`Failed to get clustering results: ${err.message}`);
    }
  }

  getClusterStats(clusterId = null) {
    try {
      let whereClause = 'WHERE cluster_id >= 0';
      const params = [];
      if (clusterId) { whereClause = 'WHERE id = ?'; params.push(clusterId); }
      return db.prepare(`
        SELECT cluster_id, COUNT(*) as total,
          COUNT(*) * 100.0 / (SELECT COUNT(*) FROM contacts WHERE cluster_id >= 0) as percentage
        FROM contacts ${whereClause} GROUP BY cluster_id ORDER BY cluster_id
      `).all(...params);
    } catch (err) {
      throw new Error(`Failed to get cluster stats: ${err.message}`);
    }
  }

  clearClustering() {
    try {
      db.exec(`UPDATE contacts SET cluster_id = -1; DELETE FROM cluster_metadata; DELETE FROM features;`);
      return { success: true, message: 'Clustering berhasil dihapus' };
    } catch (err) {
      throw new Error(`Failed to clear clustering: ${err.message}`);
    }
  }
}

module.exports = new ClusteringServiceWrapper();