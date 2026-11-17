import axios from 'axios';

const rawBase = import.meta.env.VITE_API_BASE_URL || '/api';
const apiBaseUrl = rawBase.endsWith('/api')
  ? rawBase.replace(/\/+$/, '')
  : `${rawBase.replace(/\/+$/, '')}/api`;

const http = axios.create({
  baseURL: apiBaseUrl
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('job_ops_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const api = {
  apiBaseUrl,
  getStreamUrl: async (path) => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${apiBaseUrl}${cleanPath}`;
  },
  openProtectedFile: (filePath) => {
    if (!filePath) return;
    const target = filePath.startsWith('/files/') || filePath.startsWith('http')
      ? filePath
      : `/files/${filePath.replace(/^\/+/, '')}`;
    window.open(target, '_blank', 'noopener,noreferrer');
  },
  bootstrap: () =>
    Promise.all([
      http.get('/auth/session').then((res) => res.data),
      http.get('/applications').then((res) => res.data),
      http.get('/scan-results').then((res) => res.data),
      http.get('/config').then((res) => res.data),
      http.get('/activity').then((res) => res.data)
    ]),
  loginLocal: async () => {
    const res = await http.post('/auth/local');
    if (res.data?.token) {
      localStorage.setItem('job_ops_token', res.data.token);
    }
    return res.data;
  },
  getApplications: () => http.get('/applications').then((res) => res.data),
  getScanResults: () => http.get('/scan-results').then((res) => res.data),
  getConfig: () => http.get('/config').then((res) => res.data),
  getSetupStatus: () => http.get('/config/status').then((res) => res.data),
  getUsage: () => http.get('/usage').then((res) => res.data),
  testApiKey: (payload) => http.post('/config/test-key', payload).then((res) => res.data),
  updateApiKey: (payload) => http.post('/config/update-key', payload).then((res) => res.data),
  uploadCvPdf: (file) =>
    http
      .post('/config/cv-pdf', file, {
        headers: {
          'Content-Type': 'application/pdf'
        }
      })
      .then((res) => res.data),
  updateApplicationStatus: (id, payload) =>
    http.patch(`/applications/${id}`, payload).then((res) => res.data),
  updateApplicationsBulk: (payload) =>
    http.patch('/applications', payload).then((res) => res.data),
  deleteApplication: (id) => http.delete(`/applications/${id}`).then((res) => res.data),
  saveConfig: (payload) => http.post('/config', payload).then((res) => res.data),
  runScan: (payload) => http.post('/scan', payload).then((res) => res.data),
  stopScan: () => http.post('/scan/stop').then((res) => res.data),
  runEvaluate: (payload) => http.post('/evaluate', payload).then((res) => res.data),
  runResume: (payload) => http.post('/resume', payload).then((res) => res.data),
  resetWorkspace: (payload) => http.post('/workspace/reset', payload).then((res) => res.data),
  getOpsHealth: () => http.get('/ops/health').then((res) => res.data),
  getAtsReport: (id) => http.get(`/applications/${id}/ats-report`).then((res) => res.data),
  generateInterviewPrep: (id) => http.post(`/applications/${id}/interview-prep`).then((res) => res.data),
  getInterviewPrep: (id) => http.get(`/applications/${id}/interview-prep`).then((res) => res.data),
  getStaleApplications: () => http.get('/ops/stale-applications').then((res) => res.data),
  getOutreachDrafts: (id) => http.post(`/applications/${id}/outreach`).then((res) => res.data)
};
