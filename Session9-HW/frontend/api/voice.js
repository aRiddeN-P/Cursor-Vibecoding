import { apiRequest, apiUpload } from './client.js';

export function getVoiceProfiles() {
  return apiRequest('/voice-profiles');
}

export function createVoiceProfile(name, audioBlob) {
  const formData = new FormData();
  formData.append('name', name);
  formData.append('audio_file', audioBlob, 'recording.webm');
  return apiUpload('/voice-profiles', formData);
}

export function deleteVoiceProfile(id) {
  return apiRequest(`/voice-profiles/${id}`, { method: 'DELETE' });
}
