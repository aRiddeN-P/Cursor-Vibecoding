import { apiRequest } from './client.js';

export function getStories(ageGroup) {
  return apiRequest(`/stories?age_group=${encodeURIComponent(ageGroup)}`);
}

export function getParentStories(ageGroup) {
  const query = ageGroup
    ? `?age_group=${encodeURIComponent(ageGroup)}&source=parent`
    : '?source=parent';
  return apiRequest(`/stories${query}`);
}

export function analyzeParentStory(title, content) {
  return apiRequest('/stories/custom-text/analyze', {
    method: 'POST',
    body: JSON.stringify({ title, content }),
  });
}

export function submitParentStory(title, content, childId, ageGroup) {
  return apiRequest('/stories/custom-text', {
    method: 'POST',
    body: JSON.stringify({ title, content, child_id: childId, age_group: ageGroup }),
  });
}

export function getStory(id) {
  return apiRequest(`/stories/${id}`);
}

export function getRemainingToday(childId) {
  return apiRequest(`/stories/remaining?child_id=${childId}`);
}

export function generateCustomStory(topic, ageGroup, childId) {
  return apiRequest('/stories/generate-custom', {
    method: 'POST',
    body: JSON.stringify({ topic, age_group: ageGroup, child_id: childId }),
  });
}

export function getStoryLibraryStatus() {
  return apiRequest('/stories/status');
}

export function generateStoryAudio(storyId, voiceId) {
  return apiRequest(`/stories/${storyId}/audio`, {
    method: 'POST',
    body: JSON.stringify(voiceId ? { voice_id: voiceId } : {}),
  });
}
