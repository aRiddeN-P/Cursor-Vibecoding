const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const { GoogleGenAI, Modality } = require('@google/genai');
const childModel = require('../models/child');
const storyModel = require('../models/story');
const generationLog = require('../models/storyGenerationLog');
const {
  buildInteractiveSystemInstruction,
  buildLibraryStoryInstruction,
} = require('../services/geminiLiveService');
const geminiUsageTracker = require('../services/geminiUsageTracker');

const DAILY_LIMIT_MESSAGE =
  'امروز ۵ قصه تازه ساختی! فردا دوباره می‌تونیم قصه جدید بسازیم 🌙 — تا اون موقع می‌تونی از کتابخونه قصه‌ها لذت ببری';

const SERVICE_UNAVAILABLE_MESSAGE =
  'سرویس قصه تعاملی الان در دسترس نیست — کمی بعد دوباره امتحان کن. 🌙';

const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-2.5-flash-native-audio';
const VALID_AGE_GROUPS = ['0-2', '3-5', '6-7'];
const ERROR_CLOSE_DELAY_MS = 300;

function sendJson(ws, payload) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function sendErrorAndClose(ws, { message, code }, cleanup) {
  sendJson(ws, { type: 'error', message, code });
  setTimeout(() => {
    cleanup?.();
    if (ws.readyState === ws.OPEN) {
      ws.close();
    }
  }, ERROR_CLOSE_DELAY_MS);
}

function mapGeminiConnectError(err) {
  const msg = (err?.message || String(err)).toLowerCase();

  if (
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('resource_exhausted') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests')
  ) {
    const daily =
      msg.includes('per day') || msg.includes('daily') || msg.includes('rpd');
    return {
      code: daily ? 'gemini_daily_limit' : 'gemini_rate_limit',
      message: daily
        ? geminiUsageTracker.LIMIT_MESSAGES.gemini_daily_limit
        : geminiUsageTracker.LIMIT_MESSAGES.gemini_rate_limit,
    };
  }

  if (
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('deadline') ||
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    msg.includes('fetch failed')
  ) {
    return { code: 'service_unavailable', message: SERVICE_UNAVAILABLE_MESSAGE };
  }

  return { code: 'service_unavailable', message: SERVICE_UNAVAILABLE_MESSAGE };
}

function parseConnectionParams(url) {
  const params = new URL(url || '/', 'http://localhost').searchParams;
  return {
    token: params.get('token'),
    childId: Number(params.get('child_id')),
    topic: params.get('topic') || '',
    ageGroup: params.get('age_group') || '',
    storyId: Number(params.get('story_id')),
  };
}

function handleGeminiMessage(ws, message) {
  const content = message.serverContent;
  if (!content) return;

  if (content.interrupted) {
    sendJson(ws, { type: 'state', state: 'listening' });
  }

  if (content.turnComplete) {
    sendJson(ws, { type: 'state', state: 'listening' });
  }

  if (content.modelTurn?.parts) {
    let hasAudio = false;

    for (const part of content.modelTurn.parts) {
      if (part.inlineData?.data) {
        hasAudio = true;
        sendJson(ws, {
          type: 'audio',
          data: part.inlineData.data,
          mimeType: part.inlineData.mimeType || 'audio/pcm;rate=24000',
        });
      }
    }

    if (hasAudio) {
      sendJson(ws, { type: 'state', state: 'speaking' });
    }
  }
}

function attachInteractiveStoryWs(server) {
  const wss = new WebSocketServer({ server, path: '/ws/interactive-story' });

  wss.on('connection', async (ws, req) => {
    let geminiSession = null;
    let closed = false;
    let storyStarted = false;
    let sessionReady = false;

    const cleanup = () => {
      if (closed) return;
      closed = true;

      try {
        geminiSession?.close();
      } catch {
        // ignore close errors
      }
      geminiSession = null;
    };

    ws.on('close', cleanup);
    ws.on('error', cleanup);

    try {
      const { token, childId, topic, ageGroup, storyId } = parseConnectionParams(req.url);

      if (!token) {
        sendErrorAndClose(ws, { message: 'Unauthorized', code: 'unauthorized' }, cleanup);
        return;
      }

      let userId;
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        userId = payload.userId;
      } catch {
        sendErrorAndClose(
          ws,
          { message: 'Invalid or expired token', code: 'unauthorized' },
          cleanup
        );
        return;
      }

      if (!VALID_AGE_GROUPS.includes(ageGroup) || !Number.isInteger(childId) || childId <= 0) {
        sendErrorAndClose(
          ws,
          { message: 'Invalid session parameters', code: 'invalid_params' },
          cleanup
        );
        return;
      }

      const child = childModel.getById(childId);
      if (!child || child.user_id !== userId) {
        sendErrorAndClose(ws, { message: 'Child not found', code: 'not_found' }, cleanup);
        return;
      }

      const trimmedTopic = topic.trim();
      const hasStoryId = Number.isInteger(storyId) && storyId > 0;
      let libraryStory = null;

      if (hasStoryId) {
        libraryStory = storyModel.getById(storyId);
        const isLibrary = libraryStory && !libraryStory.is_custom;
        const isParentStory = libraryStory && libraryStory.submitted_by_user_id;
        if (!libraryStory || (!isLibrary && !isParentStory)) {
          sendErrorAndClose(ws, { message: 'Story not found', code: 'not_found' }, cleanup);
          return;
        }
        if (isParentStory && libraryStory.submitted_by_user_id !== userId) {
          sendErrorAndClose(ws, { message: 'Story not found', code: 'not_found' }, cleanup);
          return;
        }
        if (isParentStory && libraryStory.approval_status === 'pending') {
          sendErrorAndClose(
            ws,
            {
              message:
                'این قصه هنوز تأیید نشده و نمی‌تونی ازش استفاده کنی. بعداً دوباره امتحان کن 🌙',
              code: 'story_pending',
            },
            cleanup
          );
          return;
        }
      } else if (!trimmedTopic) {
        sendErrorAndClose(
          ws,
          { message: 'topic or story_id is required', code: 'invalid_params' },
          cleanup
        );
        return;
      }

      if (generationLog.getTodayCount(childId) >= generationLog.DAILY_CAP) {
        sendErrorAndClose(
          ws,
          { message: DAILY_LIMIT_MESSAGE, code: 'daily_limit' },
          cleanup
        );
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'your-gemini-api-key-here') {
        sendErrorAndClose(
          ws,
          {
            message:
              'تنظیمات سرویس هنوز کامل نیست — لطفاً کمی بعد دوباره امتحان کنید. ✨',
            code: 'api_key',
          },
          cleanup
        );
        return;
      }

      const geminiStatus = geminiUsageTracker.checkAvailability();
      if (!geminiStatus.available) {
        sendErrorAndClose(
          ws,
          { message: geminiStatus.message, code: geminiStatus.code },
          cleanup
        );
        return;
      }

      const systemInstruction = libraryStory
        ? buildLibraryStoryInstruction(ageGroup, libraryStory.title, libraryStory.content)
        : buildInteractiveSystemInstruction(ageGroup, trimmedTopic);

      const ai = new GoogleGenAI({ apiKey });

      const startPrompt = libraryStory
        ? `لطفاً قصه «${libraryStory.title}» را الآن با لحن آرام و خواب‌آور شروع کن.`
        : 'لطفاً قصه را الآن با لحن آرام و خواب‌آور شروع کن.';

      geminiSession = await ai.live.connect({
        model: LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction,
        },
        callbacks: {
          onmessage: (message) => handleGeminiMessage(ws, message),
          onerror: (e) => {
            console.error('Gemini Live error:', e?.message || e);
            if (!closed) {
              const mapped = mapGeminiConnectError(e);
              sendErrorAndClose(ws, mapped, cleanup);
            }
          },
          onclose: () => {
            if (closed) return;

            if (!storyStarted) {
              sendErrorAndClose(
                ws,
                { code: 'service_unavailable', message: SERVICE_UNAVAILABLE_MESSAGE },
                cleanup
              );
              return;
            }

            sendJson(ws, { type: 'close' });
            setTimeout(() => {
              cleanup();
              if (ws.readyState === ws.OPEN) {
                ws.close();
              }
            }, ERROR_CLOSE_DELAY_MS);
          },
        },
      });

      sessionReady = true;
      sendJson(ws, { type: 'ready', remaining_today: generationLog.getRemainingToday(childId) });

      ws.on('message', (data) => {
        if (closed || !geminiSession) return;

        try {
          const msg = JSON.parse(data.toString());

          if (msg.type === 'start' && !storyStarted) {
            storyStarted = true;
            geminiUsageTracker.recordGeminiRequestOnly(500);
            generationLog.incrementToday(childId);
            sendJson(ws, {
              type: 'remaining',
              remaining_today: generationLog.getRemainingToday(childId),
            });
            geminiSession.sendRealtimeInput({ text: startPrompt });
            return;
          }

          if (msg.type === 'audio' && msg.data) {
            geminiSession.sendRealtimeInput({
              audio: {
                data: msg.data,
                mimeType: 'audio/pcm;rate=16000',
              },
            });
          } else if (msg.type === 'end') {
            cleanup();
            ws.close();
          }
        } catch (err) {
          console.error('Interactive story WS message error:', err.message);
        }
      });
    } catch (err) {
      console.error('Interactive story connection failed:', err.message);
      const mapped = sessionReady
        ? { code: 'service_unavailable', message: SERVICE_UNAVAILABLE_MESSAGE }
        : mapGeminiConnectError(err);
      sendErrorAndClose(ws, mapped, cleanup);
    }
  });
}

module.exports = { attachInteractiveStoryWs, DAILY_LIMIT_MESSAGE };
