const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function getActiveTenantId() {
  return localStorage.getItem('activeTenantId') || '';
}

function tenantPath(path) {
  const tenantId = getActiveTenantId();
  return `/tenant/${tenantId}${path}`;
}

function forceLogout() {
  localStorage.removeItem('user');
  localStorage.removeItem('lastActivity');
  localStorage.removeItem('activeTenantId');
  window.location.href = '/';
}

async function request(path, options = {}) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': user.id || '',
      ...options.headers,
    },
    ...options,
  });
  const data = await res.json();
  if (res.status === 401) {
    forceLogout();
    throw new Error('Session expired');
  }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  // Update activity timestamp on every successful API call
  localStorage.setItem('lastActivity', Date.now().toString());
  return data;
}

export const authApi = {
  sendOtp: (email) => request('/auth/send-otp', { method: 'POST', body: JSON.stringify({ email }) }),
  verifyOtp: (email, otp) => request('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email, otp }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
};

export const userApi = {
  getAll: () => request(tenantPath('/users')),
  create: (data) => request(tenantPath('/users'), { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(tenantPath(`/users/${id}`), { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(tenantPath(`/users/${id}`), { method: 'DELETE' }),
};

export const tenantApi = {
  getAll: (includeInactive = false) => request(`/tenants?includeInactive=${includeInactive}`),
  getById: (id) => request(`/tenants/${id}`),
  create: (data) => request('/tenants', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/tenants/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/tenants/${id}`, { method: 'DELETE' }),
  restore: (id) => request(`/tenants/${id}/restore`, { method: 'POST' }),
  getConfig: () => request(tenantPath('/config')),
};

export const companyApi = {
  getAll: (includeInactive = false) => request(tenantPath(`/companies?includeInactive=${includeInactive}`)),
  getById: (id) => request(tenantPath(`/companies/${id}`)),
  create: (data) => request(tenantPath('/companies'), { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(tenantPath(`/companies/${id}`), { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(tenantPath(`/companies/${id}`), { method: 'DELETE' }),
  restore: (id) => request(tenantPath(`/companies/${id}/restore`), { method: 'POST' }),
  enrich: (id) => request(tenantPath(`/companies/${id}/enrich`), { method: 'POST' }),
  refreshLinkedIn: (id) => request(tenantPath(`/companies/${id}/refresh-linkedin`), { method: 'POST' }),
  refreshG2: (id) => request(tenantPath(`/companies/${id}/refresh-g2`), { method: 'POST' }),
  refreshGartner: (id) => request(tenantPath(`/companies/${id}/refresh-gartner`), { method: 'POST' }),
  refreshTrustpilot: (id) => request(tenantPath(`/companies/${id}/refresh-trustpilot`), { method: 'POST' }),
  refreshCapterra: (id) => request(tenantPath(`/companies/${id}/refresh-capterra`), { method: 'POST' }),
  refreshAllLogos: () => request(tenantPath('/companies/refresh-logos'), { method: 'POST' }),
  generateSummaries: (id) => request(tenantPath(`/companies/${id}/generate-summaries`), { method: 'POST' }),
  getSummaryProgress: (id) => request(tenantPath(`/companies/${id}/summary-progress`)),
  refreshWebsiteScrape: (id) => request(tenantPath(`/companies/${id}/refresh-website-scrape`), { method: 'POST' }),
  retryFailedWebsiteAnalysis: (id) => request(tenantPath(`/companies/${id}/retry-failed-website-analysis`), { method: 'POST' }),
  resumeWebsiteAnalysis: (id) => request(tenantPath(`/companies/${id}/resume-website-analysis`), { method: 'POST' }),
  getWebsiteScrapeProgress: (id) => request(tenantPath(`/companies/${id}/website-scrape-progress`)),
};

export const projectApi = {
  getAll: () => request(tenantPath('/projects')),
  getById: (id) => request(tenantPath(`/projects/${id}`)),
  create: (data) => request(tenantPath('/projects'), { method: 'POST', body: JSON.stringify(data) }),
  delete: (id) => request(tenantPath(`/projects/${id}`), { method: 'DELETE' }),
  generateSummary: (projectId, companyId) =>
    request(tenantPath(`/projects/${projectId}/companies/${companyId}/generate-summary`), { method: 'POST' }),
  getSummaryProgress: (projectId, companyId) =>
    request(tenantPath(`/projects/${projectId}/companies/${companyId}/summary-progress`)),
  getProjectProgress: (id) => request(tenantPath(`/projects/${id}/progress`)),
};

export const featureReportApi = {
  generate: (projectId, refresh = false) =>
    request(tenantPath(`/projects/${projectId}/feature-report/generate${refresh ? '?refresh=true' : ''}`), { method: 'POST' }),
  getStatus: (projectId) => request(tenantPath(`/projects/${projectId}/feature-report/status`)),
  getData: (projectId) => request(tenantPath(`/projects/${projectId}/feature-report/data`)),
  regenerateSection: (projectId) =>
    request(tenantPath(`/projects/${projectId}/feature-report/regenerate-section`), { method: 'POST' }),
  getVersions: (projectId) => request(tenantPath(`/projects/${projectId}/feature-report/versions`)),
  activateVersion: (projectId, versionId) =>
    request(tenantPath(`/projects/${projectId}/feature-report/versions/${versionId}/activate`), { method: 'POST' }),
};

// Feature Matrix v2 — the evidence-first pipeline. Every yes/partial cell is
// backed by a verbatim quote that the backend has already verified as an exact
// substring of its source page; not_marketed and unverifiable mean different
// things and must not be collapsed in the UI.
export const featureMatrixV2Api = {
  generate: (projectId, { refresh = false, vendorIds } = {}) => {
    const qs = new URLSearchParams();
    if (refresh) qs.set('refresh', 'true');
    if (vendorIds?.length) qs.set('vendors', vendorIds.join(','));
    const q = qs.toString();
    return request(tenantPath(`/projects/${projectId}/feature-report/v2/generate${q ? `?${q}` : ''}`), { method: 'POST' });
  },
  getData: (projectId, { vendorIds } = {}) => {
    const q = vendorIds?.length ? `?vendors=${vendorIds.join(',')}` : '';
    return request(tenantPath(`/projects/${projectId}/feature-report/v2/data${q}`));
  },
};

export const intelApi = {
  // Dashboard composites
  executiveSnapshot: () => request('/intel/dashboard/executive-snapshot'),
  financialPerformance: () => request('/intel/dashboard/financial-performance'),
  transcriptIntel: () => request('/intel/dashboard/transcript-intel'),
  subSectorDeepDive: () => request('/intel/dashboard/sub-sector-deep-dive'),
  advisoryPipeline: () => request('/intel/dashboard/advisory-pipeline'),
  // Entity endpoints
  companies: () => request('/intel/companies'),
  companyFull: (id) => request(`/intel/companies/${id}/full`),
  financials: () => request('/intel/financials'),
  signals: (filters) => request(`/intel/signals${filters ? '?' + new URLSearchParams(filters) : ''}`),
  deals: (filters) => request(`/intel/deals${filters ? '?' + new URLSearchParams(filters) : ''}`),
  drifts: () => request('/intel/drifts'),
  themes: () => request('/intel/themes'),
  competitive: (filters) => request(`/intel/competitive/moves${filters ? '?' + new URLSearchParams(filters) : ''}`),
  marketPulse: () => request('/intel/market-pulse'),
  talkVsWalk: () => request('/intel/talk-vs-walk'),
  watchlist: () => request('/intel/watchlist'),
  leadership: () => request('/intel/leadership'),
  actionLens: (filters) => request(`/intel/action-lens${filters ? '?' + new URLSearchParams(filters) : ''}`),
  opportunities: (filters) => request(`/intel/opportunities${filters ? '?' + new URLSearchParams(filters) : ''}`),
};

export const reportApi = {
  generate: (projectId, refresh = false) =>
    request(tenantPath(`/projects/${projectId}/report/generate${refresh ? '?refresh=true' : ''}`), { method: 'POST' }),
  getStatus: (projectId) => request(tenantPath(`/projects/${projectId}/report/status`)),
  getData: (projectId) => request(tenantPath(`/projects/${projectId}/report/data`)),
  getVersions: (projectId) => request(tenantPath(`/projects/${projectId}/report/versions`)),
  activateVersion: (projectId, versionId) =>
    request(tenantPath(`/projects/${projectId}/report/versions/${versionId}/activate`), { method: 'POST' }),
  getMarketOverview: (projectId, { refresh = false } = {}) =>
    request(tenantPath(`/projects/${projectId}/report-data.json${refresh ? '?refresh=true' : ''}`)),
  getBattlecard: (projectId, companyId, threatData, { refresh = false } = {}) =>
    request(tenantPath(`/projects/${projectId}/battlecard/${companyId}.json${refresh ? '?refresh=true' : ''}`), {
      method: 'POST',
      body: JSON.stringify({ threatData }),
    }),
  getSelfAssessment: (projectId, { refresh = false } = {}) =>
    request(tenantPath(`/projects/${projectId}/self-assessment.json${refresh ? '?refresh=true' : ''}`)),
  getReportUrl: (projectId) => `${BASE_URL}${tenantPath(`/projects/${projectId}/report`)}`,
};
