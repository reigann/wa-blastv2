import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertCircle, Play, Trash2, RefreshCw } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

// Configure axios baseURL for API calls
axios.defaults.baseURL = 'http://localhost:3001';

const Clustering = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [nClusters, setNClusters] = useState(3);
  const [latestResult, setLatestResult] = useState(null);
  const [clusterStats, setClusterStats] = useState(null);

  // Colors untuk pie chart
  const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

  useEffect(() => {
    fetchLatestClustering();
  }, []);

  const fetchLatestClustering = async () => {
    try {
      const response = await axios.get('/api/clustering/latest');
      if (response.data.latest) {
        setLatestResult(response.data.latest);
        setClusterStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error fetching clustering:', error);
    }
  };

  const handleRunClustering = async () => {
    if (nClusters < 2) {
      toast.error('Jumlah cluster minimal 2');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post('/api/clustering/run', {
        nClusters: parseInt(nClusters)
      });

      if (response.data.success) {
        toast.success(`Clustering berhasil! ${response.data.message}`);
        fetchLatestClustering();
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error running clustering');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearClustering = async () => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus clustering?')) return;

    try {
      await axios.delete('/api/clustering/clear');
      toast.success('Clustering berhasil dihapus');
      setLatestResult(null);
      setClusterStats(null);
    } catch (error) {
      toast.error('Error clearing clustering');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Segmentasi Kontak</h1>
          <p className="text-gray-600">Otomatisasi pengelompokan kontak dengan K-Means Clustering</p>
        </div>

        {/* Control Panel */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Konfigurasi Clustering</h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Jumlah Cluster (K)
              </label>
              <input
                type="number"
                min="2"
                max="10"
                value={nClusters}
                onChange={(e) => setNClusters(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
            </div>

            <button
              onClick={handleRunClustering}
              disabled={isLoading || !nClusters}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition"
            >
              <Play size={18} />
              {isLoading ? 'Processing...' : 'Jalankan'}
            </button>

            <button
              onClick={fetchLatestClustering}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-medium transition"
            >
              <RefreshCw size={18} />
              Refresh
            </button>

            <button
              onClick={handleClearClustering}
              disabled={isLoading || !latestResult}
              className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition"
            >
              <Trash2 size={18} />
              Clear
            </button>
          </div>
        </div>

        {/* Results Section */}
        {latestResult ? (
          <div className="space-y-8">
            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow-md p-6">
                <p className="text-gray-600 text-sm font-medium">Total Kontak</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{latestResult.total_contacts}</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <p className="text-gray-600 text-sm font-medium">Jumlah Cluster</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{latestResult.num_clusters}</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <p className="text-gray-600 text-sm font-medium">Silhouette Score</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{latestResult.silhouette_score?.toFixed(3)}</p>
                <p className="text-xs text-gray-500 mt-1">Range: -1 to 1 (lebih tinggi lebih baik)</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-6">
                <p className="text-gray-600 text-sm font-medium">Davies-Bouldin Index</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{latestResult.davies_bouldin_index?.toFixed(3)}</p>
                <p className="text-xs text-gray-500 mt-1">Lebih rendah lebih baik</p>
              </div>
            </div>

            {/* Cluster Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pie Chart */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribusi Cluster</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={clusterStats || []}
                      dataKey="total"
                      nameKey="cluster_id"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {(clusterStats || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Bar Chart */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Ukuran Cluster</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={clusterStats || []}
                    margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="cluster_id" label={{ value: 'Cluster ID', position: 'insideBottomRight', offset: -5 }} />
                    <YAxis label={{ value: 'Jumlah Kontak', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Bar dataKey="total" fill="#3B82F6" name="Kontak" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>


          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg mb-4">Belum ada hasil clustering</p>
            <p className="text-gray-500 text-sm">Jalankan clustering untuk mulai segmentasi kontak</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Clustering;
