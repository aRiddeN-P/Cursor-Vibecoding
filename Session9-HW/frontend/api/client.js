import { API_BASE } from './config.js';
import { getToken } from '../utils/auth.js';
import { friendlyApiError } from '../utils/errors.js';

async function parseResponse(res) {
  const text = await res.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function buildError(res, data, cause) {
  const err = new Error(friendlyApiError({ status: res?.status, data, message: data?.message, cause }));
  err.status = res?.status;
  err.data = data;
  err.code = data?.code;
  return err;
}

export async function apiRequest(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (cause) {
    throw buildError(null, {}, cause);
  }

  const data = await parseResponse(res);

  if (!res.ok) {
    throw buildError(res, data);
  }

  return data;
}

export async function apiUpload(path, formData) {
  const headers = {};

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers,
      body: formData,
    });
  } catch (cause) {
    throw buildError(null, {}, cause);
  }

  const data = await parseResponse(res);

  if (!res.ok) {
    throw buildError(res, data);
  }

  return data;
}
