// Talks to the FastAPI backend.
// The backend address defaults to the local server. Override it with ?api=https://...
// in the page address (used later when the backend is hosted online).

const params = new URLSearchParams(window.location.search);
export const API_BASE = (params.get('api') || 'http://127.0.0.1:8000').replace(/\/+$/, '');

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
  hint: (id, n) => request(`/problems/${enc(id)}/hints/${n}`),
  ask: (id, question, history = []) =>
    request(`/problems/${enc(id)}/ask`, { method: 'POST', body: { question, history }, timeout: 20000 }),
};
