const rawBackendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export const BACKEND_URL = String(rawBackendUrl).replace(/\/$/, '');
export const API_BASE_URL = `${BACKEND_URL}/api`;

export function isFeatureEnabled(flagName, defaultValue = false) {
  const value = String(import.meta.env[flagName] ?? defaultValue).toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
}
