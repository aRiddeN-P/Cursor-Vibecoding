import { apiRequest } from './client.js';

export function getChildren() {
  return apiRequest('/children');
}

export function createChild(name, birthDate) {
  return apiRequest('/children', {
    method: 'POST',
    body: JSON.stringify({ name, birth_date: birthDate }),
  });
}
