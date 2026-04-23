#!/usr/bin/env python3
"""
K-Means Clustering Service for WhatsApp Contact Segmentation
Handles feature extraction, clustering, and evaluation metrics
"""

import json
import sys
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score, davies_bouldin_score
import warnings

warnings.filterwarnings('ignore')

class ContactClusteringService:
    def __init__(self):
        self.scaler = StandardScaler()
        self.kmeans = None
        self.features = None
        self.feature_names = None
        
    def extract_features(self, contacts):
        """Extract features dari contact data"""
        features_list = []
        feature_names = []
        
        for contact in contacts:
            features = []
            
            # Feature 1: Minat Prodi (one-hot encoded)
            prodi = contact.get('minat_prodi', 'unknown').lower()
            prodi_mapping = {
                'teknik informatika': [1, 0, 0],
                'ilmu komputer': [0, 1, 0],
                'sistem informasi': [0, 0, 1]
            }
            prodi_features = prodi_mapping.get(prodi, [0, 0, 1])
            features.extend(prodi_features)
            
            if len(feature_names) == 0:
                feature_names.extend(['prodi_ti', 'prodi_ilkom', 'prodi_si'])
            
            # Feature 2: Asal Sekolah (hash location string)
            sekolah = contact.get('asal_sekolah', 'unknown').lower()
            sekolah_hash = sum(ord(c) for c in sekolah) % 10
            features.append(sekolah_hash / 10.0)
            
            if len(feature_names) == 3:
                feature_names.append('sekolah_hash')
            
            features_list.append(features)
        
        self.features = np.array(features_list)
        self.feature_names = feature_names
        return self.features, feature_names
    
    def normalize_features(self):
        """Normalisasi fitur menggunakan StandardScaler"""
        if self.features is None:
            raise ValueError("Features belum diekstrak")
        
        self.features = self.scaler.fit_transform(self.features)
        return self.features
    
    def find_optimal_k(self, max_k=10):
        """Menggunakan Elbow Method untuk cari K optimal"""
        inertias = []
        silhouette_scores = []
        ks = range(2, min(max_k + 1, len(self.features)))
        
        for k in ks:
            kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
            kmeans.fit(self.features)
            inertias.append(kmeans.inertia_)
            
            if len(np.unique(kmeans.labels_)) > 1:
                silhouette_scores.append(silhouette_score(self.features, kmeans.labels_))
            else:
                silhouette_scores.append(-1)
        
        # Find elbow point (simple heuristic)
        diffs = np.diff(inertias)
        elbow_k = int(ks[np.argmax(np.diff(diffs)) + 1]) if len(diffs) > 1 else 3
        
        return {
            'ks': list(ks),
            'inertias': inertias,
            'silhouette_scores': silhouette_scores,
            'optimal_k': elbow_k
        }
    
    def cluster(self, n_clusters):
        """Jalankan K-Means clustering"""
        if self.features is None:
            raise ValueError("Features belum diekstrak dan dinormalisasi")
        
        self.kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = self.kmeans.fit_predict(self.features)
        
        # Hitung metrik evaluasi
        silhouette_avg = silhouette_score(self.features, labels) if len(np.unique(labels)) > 1 else 0
        davies_bouldin = davies_bouldin_score(self.features, labels) if len(np.unique(labels)) > 1 else 0
        
        return {
            'labels': labels.tolist(),
            'silhouette_score': float(silhouette_avg),
            'davies_bouldin_index': float(davies_bouldin),
            'n_clusters': n_clusters
        }
    
    def get_cluster_stats(self, labels):
        """Hitung statistik per cluster"""
        unique_labels = np.unique(labels)
        stats = {}
        
        for label in unique_labels:
            cluster_mask = np.array(labels) == label
            cluster_indices = np.where(cluster_mask)[0]
            
            stats[int(label)] = {
                'size': int(len(cluster_indices)),
                'percentage': float(len(cluster_indices) / len(labels) * 100)
            }
        
        return stats
    
    def process(self, contacts, n_clusters=None):
        """Main processing pipeline"""
        try:
            # Step 1: Extract features
            self.extract_features(contacts)
            
            # Step 2: Normalize
            self.normalize_features()
            
            # Step 3: Find optimal K jika tidak diberikan
            if n_clusters is None:
                optimal_info = self.find_optimal_k()
                n_clusters = optimal_info['optimal_k']
            
            # Step 4: Clustering
            result = self.cluster(n_clusters)
            
            # Step 5: Get stats
            stats = self.get_cluster_stats(result['labels'])
            
            return {
                'success': True,
                'labels': result['labels'],
                'silhouette_score': result['silhouette_score'],
                'davies_bouldin_index': result['davies_bouldin_index'],
                'n_clusters': n_clusters,
                'cluster_stats': stats,
                'features_used': self.feature_names
            }
        
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }


def main():
    """Entry point untuk script"""
    if len(sys.argv) < 2:
        print("Usage: python clusteringService.py <json_data> [n_clusters]")
        sys.exit(1)
    
    try:
        # Parse input
        contacts = json.loads(sys.argv[1])
        n_clusters = int(sys.argv[2]) if len(sys.argv) > 2 else None
        
        # Process
        service = ContactClusteringService()
        result = service.process(contacts, n_clusters)
        
        # Output result as JSON
        print(json.dumps(result))
    
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()
