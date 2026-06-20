const STORAGE_KEY = 'lalayi_selected_voice';

export function getSelectedVoiceId() {
  return localStorage.getItem(STORAGE_KEY) || 'default';
}

export function setSelectedVoiceId(voiceId) {
  if (!voiceId || voiceId === 'default') {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }

  localStorage.setItem(STORAGE_KEY, voiceId);
}
