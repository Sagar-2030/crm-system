import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('crm_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Expired or invalid session: clear it and return to login
    if (err.response && err.response.status === 401 && !err.config.url.includes('/auth/login')) {
      localStorage.removeItem('crm_token');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const errMsg = (err) => {
  const d = err.response && err.response.data;
  if (d && d.details) return `${d.message}: ${[].concat(d.details).join(', ')}`;
  return (d && d.message) || err.message || 'Something went wrong';
};

export const STAGES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Converted', 'Lost'];
export const SOURCES = ['Website', 'Referral', 'Social Media', 'Email Campaign', 'Cold Call', 'Event', 'Other'];
export const TASK_STATUSES = ['Pending', 'In Progress', 'Completed'];
export const PRIORITIES = ['Low', 'Medium', 'High'];
export const ROLE_LABELS = { superadmin: 'Super Admin', manager: 'Admin / Manager', agent: 'Salesman / Agent' };

const dateZone = () => localStorage.getItem('crm_timezone') || undefined;
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', ...(dateZone() ? { timeZone: dateZone() } : {}) }) : '—');
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', ...(dateZone() ? { timeZone: dateZone() } : {}) }) : '—');
export const fmtMoney = (value, options = {}) => new Intl.NumberFormat(undefined, { style: 'currency', currency: localStorage.getItem('crm_currency') || 'USD', ...options }).format(Number(value) || 0);
export const toInputDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export default api;
