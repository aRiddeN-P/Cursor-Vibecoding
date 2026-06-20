const fs = require('fs');
const path = require('path');

const DEFAULT_VOICE_ID = process.env.ELEVENLABS_DEFAULT_VOICE_ID || '9BWtsMINqrJLrRacOk9x';
const AUDIO_DIR = path.join(__dirname, '../../public/audio');

function ensureAudioDir() {
  if (!fs.existsSync(AUDIO_DIR)) {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
  }
}

function voiceFileKey(voiceId) {
  const id = voiceId || 'default';
  return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getAudioFilePath(storyId, voiceId) {
  return path.join(AUDIO_DIR, `story_${storyId}_${voiceFileKey(voiceId)}.mp3`);
}

function getAudioUrl(storyId, voiceId) {
  return `/audio/story_${storyId}_${voiceFileKey(voiceId)}.mp3`;
}

async function synthesizeSpeech(text, voiceId) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ElevenLabs API key is not configured');
  }

  const resolvedVoice = voiceId || DEFAULT_VOICE_ID;
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${resolvedVoice}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.75,
        similarity_boost: 0.75,
        style: 0.2,
        use_speaker_boost: false,
        speed: 0.82,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ElevenLabs API error ${response.status}: ${errText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function getOrCreateStoryAudio(storyId, content, voiceId) {
  ensureAudioDir();
  const resolvedVoice = voiceId || DEFAULT_VOICE_ID;
  const filePath = getAudioFilePath(storyId, resolvedVoice);
  const audioUrl = getAudioUrl(storyId, resolvedVoice);

  if (fs.existsSync(filePath)) {
    return audioUrl;
  }

  const audioBuffer = await synthesizeSpeech(content, resolvedVoice);
  fs.writeFileSync(filePath, audioBuffer);
  return audioUrl;
}

async function cloneVoice(name, buffer, mimeType, filename) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ElevenLabs API key is not configured');
  }

  const formData = new FormData();
  formData.append('name', name);
  formData.append('files', new Blob([buffer], { type: mimeType || 'audio/webm' }), filename || 'recording.webm');

  const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ElevenLabs clone error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  if (!data.voice_id) {
    throw new Error('ElevenLabs did not return a voice_id');
  }

  return data.voice_id;
}

async function deleteVoice(voiceId) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ElevenLabs API key is not configured');
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
    method: 'DELETE',
    headers: { 'xi-api-key': apiKey },
  });

  if (!response.ok && response.status !== 404) {
    const errText = await response.text();
    throw new Error(`ElevenLabs delete error ${response.status}: ${errText}`);
  }
}

async function getSubscriptionUsage() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || apiKey === 'your-elevenlabs-api-key-here') {
    return { configured: false };
  }

  const response = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
    headers: { 'xi-api-key': apiKey },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ElevenLabs subscription error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const used = data.character_count ?? 0;
  const limit = data.character_limit ?? 0;

  return {
    configured: true,
    available: true,
    tier: data.tier || null,
    character_count: used,
    character_limit: limit,
    characters_remaining: Math.max(0, limit - used),
    reset_unix: data.next_character_count_reset_unix || null,
  };
}

module.exports = {
  getOrCreateStoryAudio,
  getAudioUrl,
  cloneVoice,
  deleteVoice,
  getSubscriptionUsage,
  DEFAULT_VOICE_ID,
};
