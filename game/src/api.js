// Talks to the FastAPI backend.
// The backend address: ?api=https://... in the page address, else config.js when the game is
// opened from its website, else the local server.

const params = new URLSearchParams(window.location.search);
const onThisComputer = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);
// On your own computer the game always uses the local backend; online it uses config.js.
export const API_BASE = (params.get('api') || (onThisComputer ? '' : window.HDH_CONFIG?.apiBase) || 'http://127.0.0.1:8000').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, timeout = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(API_BASE + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!response.ok) throw new ApiError(`${method} ${path} failed (${response.status})`, response.status);
    return await response.json();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(err.name === 'AbortError' ? 'Request timed out' : 'Cannot reach the backend');
  } finally {
    clearTimeout(timer);
  }
}

const enc = encodeURIComponent;

export const api = {
  health: () => request('/health', { timeout: 5000 }),
  listProblems: () => request('/problems'),
  getProblem: (id) => request(`/problems/${enc(id)}`),
  rephrase: (id) => request(`/problems/${enc(id)}/rephrase`, { method: 'POST', timeout: 20000 }),
  answer: (id, optionId) => request(`/problems/${enc(id)}/answer`, { method: 'POST', body: { option_id: optionId } }),
  check: (id, optionId, attempt, nextHint) =>
    request(`/problems/${enc(id)}/check`, { method: 'POST', body: { option_id: optionId, attempt, next_hint: nextHint } }),
  handsOn: (id) => request(`/problems/${enc(id)}/hands-on`),
  finishHandsOn: (id, attempt) => request(`/problems/${enc(id)}/hands-on/finish`, { method: 'POST', body: { attempt } }),
  escalate: (id, body) => request(`/problems/${enc(id)}/escalate`, { method: 'POST', body }),
  daily: (day) => request(`/daily/${enc(day)}`),
  coach: (stats) => request('/coach', { method: 'POST', body: stats, timeout: 20000 }),
  notes: (id) => request(`/problems/${enc(id)}/notes`),
  hint: (id, n) => request(`/problems/${enc(id)}/hints/${n}`),
  match: (id, text) => request(`/problems/${enc(id)}/match`, { method: 'POST', body: { text }, timeout: 20000 }),
  ask: (id, question, history = []) =>
    request(`/problems/${enc(id)}/ask`, { method: 'POST', body: { question, history }, timeout: 20000 }),
};
