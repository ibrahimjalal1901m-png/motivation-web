import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { generateSystemPrompt, ASPIRE_WEBSITE_KNOWLEDGE } from './src/data/chatbotKnowledge';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple in-memory rate limiter per IP: max 25 requests per 60 seconds
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 30;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  record.count += 1;
  return true;
}

// Fallback intelligent knowledge response generator when GEMINI_API_KEY is not configured or during API spikes
function generateKnowledgeBaseFallback(query: string): string {
  const q = query.toLowerCase().trim();

  // 1. Specific or general Pillar inquiries
  if (q.includes('pillar 1') || q.includes('first pillar') || q.includes('pillar 01') || (q.includes('discipline') && q.includes('pillar'))) {
    const p = ASPIRE_WEBSITE_KNOWLEDGE.pillars[0];
    return `**${p.pillar}: ${p.title}**\n\n*Summary:* ${p.summary}\n\n*Full Doctrine:* ${p.doctrine}\n\n*Key Tenets:*\n${p.tenets.map((t) => `• ${t}`).join('\n')}\n\n*Daily Action Habit:* **${p.actionHabit}**`;
  }

  if (q.includes('pillar 2') || q.includes('second pillar') || q.includes('pillar 02') || (q.includes('ambition') && q.includes('pillar'))) {
    const p = ASPIRE_WEBSITE_KNOWLEDGE.pillars[1];
    return `**${p.pillar}: ${p.title}**\n\n*Summary:* ${p.summary}\n\n*Full Doctrine:* ${p.doctrine}\n\n*Key Tenets:*\n${p.tenets.map((t) => `• ${t}`).join('\n')}\n\n*Daily Action Habit:* **${p.actionHabit}**`;
  }

  if (q.includes('pillar 3') || q.includes('third pillar') || q.includes('pillar 03') || (q.includes('wealth') && q.includes('pillar'))) {
    const p = ASPIRE_WEBSITE_KNOWLEDGE.pillars[2];
    return `**${p.pillar}: ${p.title}**\n\n*Summary:* ${p.summary}\n\n*Full Doctrine:* ${p.doctrine}\n\n*Key Tenets:*\n${p.tenets.map((t) => `• ${t}`).join('\n')}\n\n*Daily Action Habit:* **${p.actionHabit}**`;
  }

  if (q.includes('pillar 4') || q.includes('fourth pillar') || q.includes('pillar 04') || (q.includes('focus') && q.includes('pillar'))) {
    const p = ASPIRE_WEBSITE_KNOWLEDGE.pillars[3];
    return `**${p.pillar}: ${p.title}**\n\n*Summary:* ${p.summary}\n\n*Full Doctrine:* ${p.doctrine}\n\n*Key Tenets:*\n${p.tenets.map((t) => `• ${t}`).join('\n')}\n\n*Daily Action Habit:* **${p.actionHabit}**`;
  }

  if (q.includes('pillar 5') || q.includes('fifth pillar') || q.includes('pillar 05') || (q.includes('self-improvement') && q.includes('pillar'))) {
    const p = ASPIRE_WEBSITE_KNOWLEDGE.pillars[4];
    return `**${p.pillar}: ${p.title}**\n\n*Summary:* ${p.summary}\n\n*Full Doctrine:* ${p.doctrine}\n\n*Key Tenets:*\n${p.tenets.map((t) => `• ${t}`).join('\n')}\n\n*Daily Action Habit:* **${p.actionHabit}**`;
  }

  if (q.includes('pillar 6') || q.includes('sixth pillar') || q.includes('pillar 06') || (q.includes('confidence') && q.includes('pillar'))) {
    const p = ASPIRE_WEBSITE_KNOWLEDGE.pillars[5];
    return `**${p.pillar}: ${p.title}**\n\n*Summary:* ${p.summary}\n\n*Full Doctrine:* ${p.doctrine}\n\n*Key Tenets:*\n${p.tenets.map((t) => `• ${t}`).join('\n')}\n\n*Daily Action Habit:* **${p.actionHabit}**`;
  }

  if (q.includes('pillar') || q.includes('pillars')) {
    const pillars = ASPIRE_WEBSITE_KNOWLEDGE.pillars
      .map((p) => `**${p.pillar}: ${p.title}**\n${p.summary}\n*Daily Action Habit:* ${p.actionHabit}`)
      .join('\n\n');
    return `**The 6 Sovereign Pillars of ASPIRE WORK:**\n\n${pillars}\n\nAsk me about any specific pillar for its complete doctrine and key tenets.`;
  }

  // 2. Directives & Quotes
  if (q.includes('quote') || q.includes('directive') || q.includes('aphorism') || q.includes('saying')) {
    const randomQuote =
      ASPIRE_WEBSITE_KNOWLEDGE.quotes[
        Math.floor(Math.random() * ASPIRE_WEBSITE_KNOWLEDGE.quotes.length)
      ];
    return `**Aspire Directive:**\n\n> "${randomQuote.quote}"\n\n— **${randomQuote.author}** (*${randomQuote.meta}*)\n*Category:* ${randomQuote.category}\n\n*Operational insight:* Apply this directive directly to your high-priority needle-mover today. Small actions repeated every day compound into undeniable mastery.`;
  }

  // 3. Daily Discipline & Habits
  if (q.includes('discipline') || q.includes('routine') || q.includes('habit') || q.includes('checklist')) {
    const tasks = ASPIRE_WEBSITE_KNOWLEDGE.dailyDisciplineChecklist
      .map((t, idx) => `**0${idx + 1}. ${t.title}**\n   ↳ ${t.subtitle}`)
      .join('\n');
    return `**The ASPIRE WORK Daily Discipline Protocol:**\n\nDiscipline is the enduring furnace that fuels sovereign achievement. Here is the operational checklist recommended by ASPIRE WORK:\n\n${tasks}\n\n*Interactive Tracking:* Visit our **Daily Discipline** section to track your streak, complete tasks with audio cues, and record your daily execution score.`;
  }

  // 4. Brand & Manifesto
  if (q.includes('about') || q.includes('aspire work') || q.includes('brand') || q.includes('manifesto') || q.includes('who are you')) {
    const codes = ASPIRE_WEBSITE_KNOWLEDGE.manifestoCodes
      .map((c) => `• **Code ${c.number} (${c.title}):** ${c.doctrine}`)
      .join('\n');
    return `**About ASPIRE WORK — Sovereign High-Performance:**\n\n**Tagline:** "${ASPIRE_WEBSITE_KNOWLEDGE.brand.tagline}"\n**Presence:** ${ASPIRE_WEBSITE_KNOWLEDGE.brand.location}\n\nWe exist to eradicate mediocrity through deliberate discipline, unshakeable mental strength, and asymmetric compounding.\n\n**The 5 Sovereign Brand Codes:**\n${codes}\n\nContact the executive suite directly at \`${ASPIRE_WEBSITE_KNOWLEDGE.brand.email}\`.`;
  }

  // 5. Social Channels
  if (q.includes('social') || q.includes('instagram') || q.includes('youtube') || q.includes('tiktok') || q.includes('x') || q.includes('twitter')) {
    const channels = Object.values(ASPIRE_WEBSITE_KNOWLEDGE.social)
      .map((s) => `• **${s.platform}:** [${s.handle}](${s.url}) — *${s.subscribersOrFollowers}* (${s.description})`)
      .join('\n');
    return `**Official ASPIRE WORK Social Dispatches:**\n\nJoin over 2.6M operators worldwide across our official media channels:\n\n${channels}\n\nAlways ensure you are connecting with our verified handles.`;
  }

  // 6. Gallery
  if (q.includes('gallery') || q.includes('story') || q.includes('stories')) {
    const stories = ASPIRE_WEBSITE_KNOWLEDGE.gallery
      .map((g) => `• **${g.title}** (${g.category}): "${g.caption}" [${g.likes} likes]`)
      .join('\n');
    return `**ASPIRE WORK Curated Visual Gallery:**\n\n${stories}\n\nExplore these visual narratives in the **Stories & Gallery** section.`;
  }

  // 7. General Strategy & Goals
  if (q.includes('goal') || q.includes('future') || q.includes('success') || q.includes('productivity') || q.includes('motivation')) {
    return `**Executive Protocol for Goal Domination:**\n\n1. **Establish Asymmetric Goals:** Set targets audaciously high so that even partial execution dwarfs average benchmarks.\n2. **Isolate Deep Work Blocks:** Execute your critical needle-mover in 90-minute distraction-free intervals before noon.\n3. **Voluntary Hardening:** Train your vessel daily — physically and mentally — until friction feels like ordinary baseline operating procedure.\n4. **Audit Weekly:** Review your scorecard every Sunday night and prune 3 low-yield distractions.\n\n*"Your future is built by what you do today. Discipline over excuses."*`;
  }

  return `**Welcome to ASPIRE WORK.**\n\nI am **Aspire AI**, your high-performance motivational counselor. I can guide you through our **6 Motivation Pillars**, provide **verified maxims from our Quotes Vault**, outline the **Daily Discipline Protocol**, or assist with high-leverage habit construction.\n\n*Try asking:*\n• "Share today's motivational directive."\n• "What is the first pillar of ASPIRE WORK?"\n• "How do I cultivate daily discipline?"\n• "What are the 5 Sovereign Brand Codes?"`;
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json({ limit: '1mb' }));

  // Status endpoint
  app.get('/api/status', (req, res) => {
    const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
    res.json({
      status: 'online',
      provider: 'Google Gemini',
      model: 'gemini-3.8-flash',
      hasApiKey: hasKey,
      brand: 'ASPIRE WORK',
    });
  });

  // Voice Text-to-Speech endpoint (Gemini 3.8 Flash-Lite TTS)
  app.post('/api/voice', async (req, res) => {
    const { text, voice = 'Charon' } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required for voice synthesis.' });
    }

    // Clean markdown characters for spoken audio
    const cleanSpeech = text
      .replace(/(\*\*|\*|`|#|>|\[.*?\]\(.*?\))/g, '')
      .replace(/•|\-/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1000); // cap text to 1000 chars for optimal audio latency

    const apiKey = process.env.GEMINI_API_KEY?.trim();

    if (apiKey && apiKey.length > 5) {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const selectedVoice = ['Charon', 'Fenrir', 'Puck', 'Kore', 'Zephyr'].includes(voice)
          ? voice
          : 'Charon';

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TTS request timed out')), 10000)
        );

        const response = await Promise.race([
          ai.models.generateContent({
            model: 'gemini-3.8-flash-lite-tts',
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: cleanSpeech,
                    speechMetadata: {
                      style: 'Deep, calm, powerful masculine baritone, motivational and professional executive',
                    },
                  },
                ],
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: selectedVoice },
                },
              },
            },
          }),
          timeoutPromise,
        ]);

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

        if (base64Audio) {
          return res.json({
            audio: `data:audio/wav;base64,${base64Audio}`,
            voice: selectedVoice,
            format: 'audio/wav',
            isNeural: true,
          });
        }
      } catch (err: any) {
        console.warn('Gemini TTS synthesis fallback:', err?.message);
      }
    }

    // If Gemini TTS is not available or timed out, inform client to use browser speech synthesis
    return res.json({
      audio: null,
      useBrowserTts: true,
      text: cleanSpeech,
      notice: 'Using browser voice synthesis fallback.',
    });
  });

  // Audio Transcription endpoint (Gemini 3.5 Transcribe)
  app.post('/api/transcribe', async (req, res) => {
    const { audioData, mimeType = 'audio/webm' } = req.body;

    if (!audioData) {
      return res.status(400).json({ error: 'Audio data is required.' });
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (apiKey && apiKey.length > 5) {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const base64Clean = audioData.replace(/^data:audio\/\w+;base64,/, '');

        const response = await ai.models.generateContent({
          model: 'gemini-3.5-transcribe',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Clean,
                },
              },
              { text: 'Transcribe this spoken English audio exactly and concisely.' },
            ],
          },
        });

        const transcript = response.text?.trim() || '';
        return res.json({ transcript });
      } catch (err: any) {
        console.warn('Gemini Transcribe fallback:', err?.message);
        return res.status(500).json({ error: 'Transcription failed.', details: err?.message });
      }
    }

    return res.status(503).json({ error: 'API key not configured for server transcription.' });
  });

  // Chat API endpoint
  app.post('/api/chat', async (req, res) => {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown-client';

    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please wait a moment before sending another message.',
      });
    }

    const { messages, generateVoice = true, voice = 'Charon' } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Invalid request: "messages" must be a non-empty array.' });
    }

    // Validate message payload
    const sanitizedMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    for (const msg of messages.slice(-12)) {
      if (!msg || typeof msg.content !== 'string') continue;
      const role = msg.role === 'assistant' ? 'assistant' : 'user';
      const content = msg.content.trim().slice(0, 2000); // 2000 character cap per message
      if (content.length > 0) {
        sanitizedMessages.push({ role, content });
      }
    }

    if (sanitizedMessages.length === 0) {
      return res.status(400).json({ error: 'Message content cannot be empty.' });
    }

    const lastUserMessage = [...sanitizedMessages].reverse().find((m) => m.role === 'user');
    if (!lastUserMessage) {
      return res.status(400).json({ error: 'No user message provided.' });
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();

    // Helper to synthesize speech for generated text
    const synthesizeSpeech = async (text: string, voiceName: string): Promise<string | null> => {
      if (!apiKey || apiKey.length <= 5) return null;
      try {
        const cleanSpeech = text
          .replace(/(\*\*|\*|`|#|>|\[.*?\]\(.*?\))/g, '')
          .replace(/•|\-/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 1000);

        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });

        const selectedVoice = ['Charon', 'Fenrir', 'Puck', 'Kore', 'Zephyr'].includes(voiceName)
          ? voiceName
          : 'Charon';

        const ttsTimeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TTS timeout')), 5000)
        );

        const ttsRes = await Promise.race([
          ai.models.generateContent({
            model: 'gemini-3.8-flash-lite-tts',
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: cleanSpeech,
                    speechMetadata: {
                      style: 'Deep, calm, powerful masculine baritone, motivational and professional executive',
                    },
                  },
                ],
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } },
              },
            },
          }),
          ttsTimeoutPromise,
        ]);

        const b64 = ttsRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return b64 ? `data:audio/wav;base64,${b64}` : null;
      } catch (err) {
        console.warn('Speech synthesis skipped:', err);
        return null;
      }
    };

    // If real Gemini API key is configured, invoke the official @google/genai SDK
    if (apiKey && apiKey.length > 5) {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        // Convert conversation history to Gemini contents format
        const contents = sanitizedMessages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Request timed out')), 8000)
        );

        const response = await Promise.race([
          ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents,
            config: {
              systemInstruction: generateSystemPrompt(),
              temperature: 0.7,
              topP: 0.95,
            },
          }),
          timeoutPromise,
        ]);

        const replyText = response.text?.trim() || 'No response generated from the model.';

        let audioUrl: string | null = null;
        if (generateVoice) {
          audioUrl = await synthesizeSpeech(replyText, voice);
        }

        return res.json({
          reply: replyText,
          audio: audioUrl,
          voice,
          isDemoMode: false,
          model: 'gemini-3.8-flash',
        });
      } catch (err: any) {
        console.error('Gemini API synthesis error:', err);
        // Fallback gracefully with clear message
        const fallbackReply = generateKnowledgeBaseFallback(lastUserMessage.content);
        let audioUrl: string | null = null;
        if (generateVoice) {
          audioUrl = await synthesizeSpeech(fallbackReply, voice);
        }
        return res.json({
          reply: fallbackReply,
          audio: audioUrl,
          voice,
          isDemoMode: true,
          notice: `AI synthesis encountered an issue (${err?.message || 'API error'}). Displaying verified knowledge base answer.`,
        });
      }
    }

    // If no GEMINI_API_KEY is configured in environment, serve in clearly labeled demo mode
    const fallbackReply = generateKnowledgeBaseFallback(lastUserMessage.content);
    return res.json({
      reply: fallbackReply,
      audio: null,
      voice,
      isDemoMode: true,
      notice: 'Demo Mode: Running on ASPIRE WORK verified knowledge base. Add GEMINI_API_KEY in server secrets for unrestricted neural intelligence.',
    });
  });

  // Integration with Vite
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ASPIRE WORK Executive Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
