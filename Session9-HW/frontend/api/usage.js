import { apiRequest } from './client.js';

export function getServiceUsage() {
  return apiRequest('/usage/services');
}
