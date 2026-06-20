function floatTo16BitPCM(float32) {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}

function resampleTo16k(float32, inputRate) {
  if (inputRate === 16000) return float32;

  const ratio = inputRate / 16000;
  const newLength = Math.round(float32.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const idx = Math.floor(srcIndex);
    const frac = srcIndex - idx;
    const a = float32[idx] || 0;
    const b = float32[idx + 1] || a;
    result[i] = a + (b - a) * frac;
  }

  return result;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function createPcmPlayer(sampleRate = 24000) {
  const audioContext = new AudioContext({ sampleRate });
  let nextStartTime = 0;

  return {
    async resume() {
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
    },

    playBase64Pcm(base64) {
      const buffer = base64ToArrayBuffer(base64);
      const int16 = new Int16Array(buffer);
      const float32 = new Float32Array(int16.length);

      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
      }

      const audioBuffer = audioContext.createBuffer(1, float32.length, sampleRate);
      audioBuffer.copyToChannel(float32, 0);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      const startAt = Math.max(nextStartTime, audioContext.currentTime);
      source.start(startAt);
      nextStartTime = startAt + audioBuffer.duration;
    },

    stop() {
      audioContext.close();
    },
  };
}

export async function createMicStreamer(onPcmChunk) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
    },
  });

  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  const gain = audioContext.createGain();
  gain.gain.value = 0;

  source.connect(processor);
  processor.connect(gain);
  gain.connect(audioContext.destination);

  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0);
    const resampled = resampleTo16k(input, audioContext.sampleRate);
    const pcm16 = floatTo16BitPCM(resampled);
    onPcmChunk(arrayBufferToBase64(pcm16.buffer));
  };

  return {
    async resume() {
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
    },

    stop() {
      processor.disconnect();
      source.disconnect();
      gain.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      audioContext.close();
    },
  };
}
