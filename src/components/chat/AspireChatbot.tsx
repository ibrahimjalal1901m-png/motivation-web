import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  X,
  Minus,
  Send,
  Trash2,
  RotateCcw,
  Bot,
  User,
  Copy,
  Check,
  ChevronDown,
  Info,
  Flame,
  AlertCircle,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Square,
  Play,
  Pause,
  Sliders,
  Settings,
  Radio,
} from 'lucide-react';
import { MarkdownContent } from './MarkdownContent';
import { soundFx } from '../../utils/audio';
import { voiceService, VoiceSettings, DEFAULT_VOICE_SETTINGS } from '../../utils/voiceService';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  audioUrl?: string | null;
  isDemoNotice?: string;
}

const STORAGE_KEY = 'aspire_ai_chat_v3';

const SUGGESTED_PROMPTS = [
  "Give me today's motivation.",
  "What is the first pillar of ASPIRE WORK?",
  "How can I build unbreakable discipline?",
  "Share a directive from the Quotes Vault.",
  "What is the daily discipline checklist?",
  "What are the 5 Sovereign Brand Codes?",
];

const INITIAL_WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome-msg',
  role: 'assistant',
  content: `**Greetings, Operator.** I am **Aspire AI**, your high-performance motivational voice counselor.

I am synchronized with the entire **ASPIRE WORK** doctrine:
• The **6 Motivation Pillars** & execution blueprints
• The **18 verified Directives** & Quotes Vault
• The **Daily Discipline Protocol** & accountability metrics
• Our core brand manifesto and official media channels

Ask any question by **typing** or **speaking via the microphone**. I will answer and speak with an executive baritone voice. What objective are we conquering today?`,
  timestamp: Date.now(),
};

export const AspireChatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // LocalStorage fallback
    }
    return [INITIAL_WELCOME_MESSAGE];
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [hasPromptHint, setHasPromptHint] = useState(true);

  // Voice playback & recognition states
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(() => voiceService.getSettings());
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSpeakingId, setCurrentSpeakingId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [speechError, setSpeechError] = useState<string | null>(null);

  const [serverStatus, setServerStatus] = useState<{
    hasApiKey: boolean;
    model: string;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync Voice Service state listeners
  useEffect(() => {
    voiceService.registerStateListener((state) => {
      setIsSpeaking(state.isSpeaking);
      setIsPaused(state.isPaused);
      setCurrentSpeakingId(state.currentMessageId);
    });

    voiceService.registerRecognitionListener((listening, interim, error) => {
      setIsListening(listening);
      setInterimTranscript(interim);
      if (error) {
        setSpeechError(error);
        setTimeout(() => setSpeechError(null), 6000);
      }
    });

    // Check server status
    fetch('/api/status')
      .then((res) => res.json())
      .then((data) => {
        setServerStatus({
          hasApiKey: Boolean(data.hasApiKey),
          model: data.model || 'gemini-3.8-flash',
        });
      })
      .catch(() => {
        setServerStatus({
          hasApiKey: false,
          model: 'gemini-3.8-flash',
        });
      });

    return () => {
      voiceService.stop();
      voiceService.stopSpeechRecognition();
    };
  }, []);

  // Save conversation history to LocalStorage
  useEffect(() => {
    try {
      const trimmed = messages.slice(-25);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // ignore
    }
  }, [messages]);

  // Auto-scroll to bottom on new messages
  const scrollToBottom = useCallback((smooth = true) => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 160;
      if (isNearBottom || messages.length <= 2) {
        messagesEndRef.current?.scrollIntoView({
          behavior: smooth ? 'smooth' : 'auto',
        });
      }
    }
  }, [messages.length]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isLoading, isOpen, isMinimized, scrollToBottom]);

  // Focus textarea when opened
  useEffect(() => {
    if (isOpen && !isMinimized) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isMinimized]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  // Submit question and auto-speak answer
  const handleSendMessage = async (userPrompt?: string) => {
    const textToSend = (userPrompt || input).trim();
    if (!textToSend || isLoading) return;

    soundFx.playClick();
    setHasPromptHint(false);
    voiceService.stopSpeechRecognition();
    voiceService.stop();

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      role: 'user',
      content: textToSend,
      timestamp: Date.now(),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsLoading(true);

    try {
      const payloadMessages = newHistory.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: payloadMessages,
          generateVoice: voiceSettings.autoSpeak,
          voice: voiceSettings.voiceName === 'browser' ? 'Charon' : voiceSettings.voiceName,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server returned error status ${res.status}`);
      }

      const data = await res.json();
      const assistantMessageId = `assistant-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: data.reply || 'No response returned.',
        timestamp: Date.now(),
        audioUrl: data.audio || null,
        isDemoNotice: data.notice,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      soundFx.playChime();

      // Automatically speak answer if autoSpeak is enabled
      if (voiceSettings.autoSpeak) {
        setTimeout(() => {
          voiceService.speakMessage(
            assistantMessageId,
            assistantMessage.content,
            assistantMessage.audioUrl
          );
        }, 150);
      }
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `**Transmission Error:** ${err.message || 'Unable to connect to ASPIRE AI'}.\n\nPlease verify your connection and try again.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Toggle Voice Input / Microphone
  const handleToggleMicrophone = () => {
    soundFx.playClick();
    if (isListening) {
      voiceService.stopSpeechRecognition();
    } else {
      setSpeechError(null);
      voiceService.stop(); // Stop any speaking audio while listening
      voiceService.startSpeechRecognition(
        (finalText) => {
          setInput(finalText);
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
          }
        },
        (interim) => {
          setInterimTranscript(interim);
        }
      );
    }
  };

  // Toggle Auto-Speak mute
  const handleToggleAutoSpeak = () => {
    soundFx.playClick();
    const updated = voiceService.saveSettings({ autoSpeak: !voiceSettings.autoSpeak });
    setVoiceSettings(updated);
    if (!updated.autoSpeak) {
      voiceService.stop();
    }
  };

  // Play / Pause / Replay individual message
  const handlePlayMessage = (message: ChatMessage) => {
    soundFx.playClick();
    if (currentSpeakingId === message.id) {
      if (isSpeaking && !isPaused) {
        voiceService.pause();
      } else if (isPaused) {
        voiceService.resume();
      } else {
        voiceService.speakMessage(message.id, message.content, message.audioUrl);
      }
    } else {
      voiceService.speakMessage(message.id, message.content, message.audioUrl);
    }
  };

  const handleStopSpeaking = () => {
    soundFx.playClick();
    voiceService.stop();
  };

  const handleClearChat = () => {
    soundFx.playClick();
    voiceService.stop();
    setMessages([INITIAL_WELCOME_MESSAGE]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setShowClearConfirm(false);
  };

  const handleCopy = (text: string, id: string) => {
    soundFx.playClick();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const updateSetting = <K extends keyof VoiceSettings>(key: K, val: VoiceSettings[K]) => {
    soundFx.playClick();
    const updated = voiceService.saveSettings({ [key]: val });
    setVoiceSettings(updated);
  };

  return (
    <>
      {/* Floating Gold Launcher Button at bottom-right */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {/* Tooltip speech hint */}
        {!isOpen && hasPromptHint && (
          <div className="mb-3 animate-bounce hidden sm:flex items-center gap-2 bg-[#121215]/95 border border-[#D4AF37]/50 text-white text-xs px-3.5 py-2 rounded-xl shadow-[0_4px_20px_rgba(212,175,55,0.25)] backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-[#FFE08A] animate-ping" />
            <span className="font-mono text-zinc-300">
              Ask in Voice: <strong className="text-[#FFE08A]">Aspire AI</strong>
            </span>
            <button
              onClick={() => setHasPromptHint(false)}
              className="text-zinc-500 hover:text-zinc-300 ml-1 cursor-pointer"
              aria-label="Dismiss prompt hint"
            >
              ×
            </button>
          </div>
        )}

        <button
          onClick={() => {
            soundFx.playClick();
            setIsOpen((prev) => !prev);
            setIsMinimized(false);
            setHasPromptHint(false);
          }}
          aria-label={isOpen ? 'Close Aspire AI voice assistant' : 'Open Aspire AI voice assistant'}
          className="group relative flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-[#1e1c15] via-[#101013] to-[#050505] border-2 border-[#D4AF37]/80 text-[#FFE08A] shadow-[0_0_25px_rgba(212,175,55,0.35)] hover:shadow-[0_0_40px_rgba(212,175,55,0.65)] hover:border-[#FFE08A] transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
        >
          {/* Animated Gold Ring Aura */}
          <span className="absolute inset-0 rounded-full border border-[#D4AF37]/30 animate-ping opacity-40 pointer-events-none" />

          {isOpen ? (
            <X className="w-6 h-6 text-[#FFE08A] transition-transform duration-200 group-hover:rotate-90" />
          ) : (
            <>
              <Sparkles className="w-7 h-7 text-[#FFE08A] group-hover:scale-110 transition-transform duration-300" />
              {/* Online status indicator properly positioned at top-right corner of the button */}
              <span
                className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 flex h-3.5 w-3.5 pointer-events-none"
                title="Aspire AI Online & Ready"
                aria-hidden="true"
              >
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-400 border-2 border-[#0B0B0E] shadow-[0_0_8px_#34d399]" />
              </span>
            </>
          )}
        </button>
      </div>

      {/* Modern Black-and-Gold Voice Chatbot Window */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Aspire AI Voice Chatbot"
          className={`fixed z-50 transition-all duration-300 ease-out flex flex-col bg-[#0B0B0E]/95 backdrop-blur-2xl border border-[#D4AF37]/35 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_40px_rgba(212,175,55,0.2)] ${
            isMinimized
              ? 'bottom-24 right-6 w-72 sm:w-80 h-16 rounded-2xl overflow-hidden'
              : 'bottom-24 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-[430px] max-w-[430px] h-[610px] max-h-[84vh] rounded-2xl'
          }`}
        >
          {/* Top Header Bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#141418] via-[#101014] to-[#141418] border-b border-white/[0.08] select-none shrink-0">
            <div className="flex items-center gap-3">
              {/* Luxury Gold Avatar with Live Voice Aura */}
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-[#FFE08A]/20 via-[#D4AF37]/10 to-transparent border border-[#D4AF37]/40 flex items-center justify-center shadow-inner">
                <Flame className="w-5 h-5 text-[#FFE08A]" />
                {isSpeaking && (
                  <span className="absolute -inset-1 rounded-xl border border-[#FFE08A] animate-ping opacity-60 pointer-events-none" />
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border border-[#080808] rounded-full shadow-[0_0_6px_#34d399]" />
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-semibold tracking-wide text-white font-mono">
                    ASPIRE AI
                  </h3>
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 bg-[#D4AF37]/15 text-[#FFE08A] border border-[#D4AF37]/30 rounded">
                    Voice • {voiceSettings.voiceName}
                  </span>
                </div>
                {/* Active audio visualizer state in header */}
                {isSpeaking ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-[#FFE08A] font-mono">
                    <span className="flex items-center gap-0.5 h-3">
                      <span className="w-0.5 h-full bg-[#FFE08A] animate-[pulse_0.6s_ease-in-out_infinite]" />
                      <span className="w-0.5 h-2 bg-[#D4AF37] animate-[pulse_0.4s_ease-in-out_infinite]" />
                      <span className="w-0.5 h-3 bg-[#FFE08A] animate-[pulse_0.7s_ease-in-out_infinite]" />
                    </span>
                    <span>Speaking Audio...</span>
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-400 flex items-center gap-1.5 font-sans">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    Deep Baritone Counsel Active
                  </p>
                )}
              </div>
            </div>

            {/* Header Controls */}
            <div className="flex items-center gap-1">
              {/* Quick Stop Speaking Button when playing */}
              {isSpeaking && (
                <button
                  onClick={handleStopSpeaking}
                  title="Stop speaking"
                  className="p-1.5 text-[#FFE08A] bg-[#D4AF37]/20 border border-[#D4AF37]/40 rounded-lg hover:bg-[#D4AF37]/30 transition-colors cursor-pointer"
                  aria-label="Stop audio"
                >
                  <Square className="w-3.5 h-3.5 fill-[#FFE08A]" />
                </button>
              )}

              {/* Toggle Voice Output Mute */}
              <button
                onClick={handleToggleAutoSpeak}
                title={voiceSettings.autoSpeak ? 'Mute voice responses' : 'Enable voice responses'}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  voiceSettings.autoSpeak
                    ? 'text-[#FFE08A] hover:bg-white/5'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                }`}
                aria-label={voiceSettings.autoSpeak ? 'Mute voice' : 'Unmute voice'}
              >
                {voiceSettings.autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              {/* Voice Preferences / Settings button */}
              <button
                onClick={() => {
                  soundFx.playClick();
                  setShowSettings((prev) => !prev);
                }}
                title="Voice & Speech Settings"
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  showSettings ? 'text-[#FFE08A] bg-white/10' : 'text-zinc-400 hover:text-[#FFE08A] hover:bg-white/5'
                }`}
                aria-label="Voice settings"
              >
                <Sliders className="w-4 h-4" />
              </button>

              {/* Reset conversation button */}
              <button
                onClick={() => {
                  soundFx.playClick();
                  setShowClearConfirm(true);
                }}
                title="Reset conversation"
                className="p-1.5 text-zinc-400 hover:text-[#FFE08A] hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                aria-label="Clear chat"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Minimize button */}
              <button
                onClick={() => {
                  soundFx.playClick();
                  setIsMinimized((prev) => !prev);
                }}
                title={isMinimized ? 'Expand' : 'Minimize'}
                className="p-1.5 text-zinc-400 hover:text-[#FFE08A] hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                aria-label={isMinimized ? 'Expand' : 'Minimize'}
              >
                <Minus className="w-4 h-4" />
              </button>

              {/* Close button */}
              <button
                onClick={() => {
                  soundFx.playClick();
                  voiceService.stop();
                  setIsOpen(false);
                }}
                title="Close chat"
                className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Voice Settings Drawer */}
              {showSettings && (
                <div className="p-3.5 bg-[#121217] border-b border-[#D4AF37]/30 text-xs text-zinc-200 animate-fadeIn space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[#FFE08A] font-semibold uppercase tracking-wider flex items-center gap-1.5">
                      <Settings className="w-3.5 h-3.5" />
                      Executive Voice Architecture
                    </span>
                    <button
                      onClick={() => setShowSettings(false)}
                      className="text-zinc-500 hover:text-zinc-300 text-xs cursor-pointer"
                    >
                      Done
                    </button>
                  </div>

                  {/* Voice Persona Selection */}
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1 font-mono">Neural Voice Model:</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'Charon', label: 'Charon (Deep Baritone)' },
                        { id: 'Fenrir', label: 'Fenrir (Gritty Alpha)' },
                        { id: 'Puck', label: 'Puck (Direct Focused)' },
                        { id: 'browser', label: 'Browser Native TTS' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => updateSetting('voiceName', item.id as any)}
                          className={`px-2.5 py-1.5 rounded text-[11px] font-mono text-left transition-colors cursor-pointer border ${
                            voiceSettings.voiceName === item.id
                              ? 'bg-[#D4AF37]/20 border-[#FFE08A] text-[#FFE08A]'
                              : 'bg-black/40 border-white/5 text-zinc-400 hover:border-white/20'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Speed & Volume Controls */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-[11px] text-zinc-400 block mb-1 font-mono">
                        Pace: {voiceSettings.speed}x
                      </label>
                      <div className="flex gap-1">
                        {[0.8, 1.0, 1.2].map((spd) => (
                          <button
                            key={spd}
                            onClick={() => updateSetting('speed', spd)}
                            className={`flex-1 py-1 rounded text-[10px] font-mono transition-colors cursor-pointer border ${
                              voiceSettings.speed === spd
                                ? 'bg-[#D4AF37]/25 border-[#FFE08A] text-[#FFE08A]'
                                : 'bg-black/40 border-white/5 text-zinc-400 hover:border-white/20'
                            }`}
                          >
                            {spd === 0.8 ? '0.8x' : spd === 1.0 ? '1.0x' : '1.2x'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-zinc-400 block mb-1 font-mono">
                        Auto-Speak Audio:
                      </label>
                      <button
                        onClick={handleToggleAutoSpeak}
                        className={`w-full py-1 rounded text-[10px] font-mono transition-colors cursor-pointer border ${
                          voiceSettings.autoSpeak
                            ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                            : 'bg-zinc-900 border-zinc-700 text-zinc-400'
                        }`}
                      >
                        {voiceSettings.autoSpeak ? 'Enabled (Default)' : 'Muted'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Clear chat confirmation dialog */}
              {showClearConfirm && (
                <div className="px-4 py-2.5 bg-[#1B1710] border-b border-[#D4AF37]/30 flex items-center justify-between text-xs text-zinc-200 animate-fadeIn">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-[#FFE08A]" />
                    <span>Clear conversation history?</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleClearChat}
                      className="px-2.5 py-1 bg-red-950/80 hover:bg-red-900 border border-red-500/40 text-red-200 rounded font-mono text-[11px] transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded font-mono text-[11px] transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Speech recognition error banner */}
              {speechError && (
                <div className="px-3.5 py-2 bg-amber-950/70 border-b border-amber-500/30 text-amber-200 text-xs flex items-center justify-between animate-fadeIn">
                  <span className="flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{speechError}</span>
                  </span>
                  <button
                    onClick={() => setSpeechError(null)}
                    className="text-amber-400 hover:text-white cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Messages History */}
              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
              >
                {messages.map((message) => {
                  const isUser = message.role === 'user';
                  const isThisSpeaking = currentSpeakingId === message.id && isSpeaking;

                  return (
                    <div
                      key={message.id}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} group`}
                    >
                      <div className="flex items-center gap-2 mb-1 px-1">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase">
                          {isUser ? 'You' : 'Aspire AI'}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-600">
                          {new Date(message.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>

                        {/* Speaking equalizer badge */}
                        {!isUser && isThisSpeaking && (
                          <span className="flex items-center gap-1 px-1.5 py-0.2 bg-[#D4AF37]/20 border border-[#D4AF37]/50 rounded text-[9px] font-mono text-[#FFE08A]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FFE08A] animate-ping" />
                            Playing Voice
                          </span>
                        )}
                      </div>

                      <div
                        className={`relative group/msg transition-all duration-200 ${
                          isUser
                            ? 'bg-[#D4AF37]/15 border border-[#D4AF37]/35 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] shadow-sm'
                            : `bg-[#141418] border text-zinc-200 rounded-2xl rounded-tl-sm px-4 py-3.5 max-w-[92%] shadow-md ${
                                isThisSpeaking
                                  ? 'border-[#FFE08A] shadow-[0_0_20px_rgba(212,175,55,0.25)] ring-1 ring-[#FFE08A]/50'
                                  : 'border-white/[0.08]'
                              }`
                        }`}
                      >
                        {isUser ? (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                        ) : (
                          <div>
                            <MarkdownContent content={message.content} />

                            {message.isDemoNotice && (
                              <div className="mt-2.5 pt-2 border-t border-white/[0.06] flex items-center gap-1.5 text-[11px] text-amber-300/80 font-mono">
                                <Info className="w-3 h-3 shrink-0" />
                                <span>{message.isDemoNotice}</span>
                              </div>
                            )}

                            {/* Spoken Audio Player Bar */}
                            <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-400">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handlePlayMessage(message)}
                                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border transition-all cursor-pointer ${
                                    isThisSpeaking
                                      ? 'bg-[#D4AF37]/20 border-[#FFE08A] text-[#FFE08A]'
                                      : 'bg-black/40 border-white/10 hover:border-[#D4AF37]/50 text-zinc-300 hover:text-[#FFE08A]'
                                  }`}
                                  title={isThisSpeaking ? 'Pause/Stop Voice' : 'Listen in Natural Baritone Voice'}
                                >
                                  {isThisSpeaking ? (
                                    <>
                                      <Pause className="w-3 h-3 text-[#FFE08A]" />
                                      <span>Pause Voice</span>
                                    </>
                                  ) : (
                                    <>
                                      <Play className="w-3 h-3 text-[#FFE08A] fill-[#FFE08A]" />
                                      <span>Listen in Voice</span>
                                    </>
                                  )}
                                </button>

                                {isThisSpeaking && (
                                  <button
                                    onClick={handleStopSpeaking}
                                    className="p-1 text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
                                    title="Stop speech"
                                  >
                                    <Square className="w-3 h-3" />
                                  </button>
                                )}
                              </div>

                              <div className="flex items-center gap-1">
                                <span className="text-[10px] font-mono text-zinc-500">
                                  {message.audioUrl ? 'Neural Baritone' : 'English TTS'}
                                </span>

                                {/* Copy message button */}
                                <button
                                  onClick={() => handleCopy(message.content, message.id)}
                                  className="p-1 text-zinc-500 hover:text-[#FFE08A] rounded hover:bg-white/5 transition-colors cursor-pointer ml-1"
                                  title="Copy text"
                                  aria-label="Copy message text"
                                >
                                  {copiedId === message.id ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Animated Typing & Voice Synthesis Indicator */}
                {isLoading && (
                  <div className="flex flex-col items-start">
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase">Aspire AI</span>
                      <span className="text-[10px] font-mono text-[#FFE08A] animate-pulse">
                        synthesizing counsel & voice...
                      </span>
                    </div>
                    <div className="bg-[#141418] border border-white/[0.08] rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#FFE08A] animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-2 h-2 rounded-full bg-[#8C6D1F] animate-bounce" />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Live Microphone Recording Indicator Banner */}
              {isListening && (
                <div className="px-4 py-3 bg-[#1A150D] border-t border-[#D4AF37]/50 flex items-center justify-between animate-fadeIn text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                    </span>
                    <div>
                      <p className="font-mono text-[#FFE08A] font-semibold text-xs">
                        Listening... Speak your question aloud
                      </p>
                      {interimTranscript && (
                        <p className="text-zinc-300 italic text-[11px] truncate max-w-[240px]">
                          "{interimTranscript}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSendMessage()}
                      className="px-2.5 py-1 bg-[#D4AF37] hover:bg-[#FFE08A] text-black font-semibold rounded text-[11px] font-mono transition-colors cursor-pointer"
                    >
                      Send Spoken
                    </button>
                    <button
                      onClick={() => voiceService.stopSpeechRecognition()}
                      className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[11px] font-mono transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Strategic Prompt Chips */}
              <div className="px-3 py-2 border-t border-white/[0.06] bg-[#0E0E12]/80">
                <div className="flex items-center justify-between mb-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-[#FFE08A]" />
                    <span>Quick Directives</span>
                  </span>
                  <span className="text-zinc-600">Auto-Voice Enabled</span>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                  {SUGGESTED_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      disabled={isLoading}
                      onClick={() => handleSendMessage(prompt)}
                      className="shrink-0 px-2.5 py-1 rounded-full bg-[#16161B] hover:bg-[#D4AF37]/20 border border-white/[0.08] hover:border-[#D4AF37]/50 text-zinc-300 hover:text-[#FFE08A] text-[11px] transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message & Voice Input Bar */}
              <div className="p-3 bg-gradient-to-t from-[#0E0E12] to-[#121216] border-t border-white/[0.08] shrink-0">
                <div className="relative flex items-end gap-2 bg-[#08080A] border border-white/[0.12] focus-within:border-[#D4AF37]/80 rounded-xl p-2 transition-colors">
                  {/* Microphone Voice Input Button */}
                  <button
                    onClick={handleToggleMicrophone}
                    disabled={isLoading}
                    title={isListening ? 'Stop recording voice' : 'Ask question by speaking (Microphone)'}
                    className={`p-2 rounded-lg transition-all cursor-pointer shrink-0 ${
                      isListening
                        ? 'bg-red-500/20 border border-red-500/60 text-red-400 animate-pulse'
                        : 'bg-[#151518] hover:bg-[#D4AF37]/20 border border-white/10 text-zinc-400 hover:text-[#FFE08A]'
                    }`}
                    aria-label={isListening ? 'Stop recording' : 'Start voice input'}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                    placeholder={isListening ? 'Listening to your voice...' : 'Type or speak a question...'}
                    className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 resize-none outline-none max-h-28 py-1 px-1 font-sans"
                  />

                  {/* Send Button */}
                  <button
                    onClick={() => handleSendMessage()}
                    disabled={!input.trim() || isLoading}
                    aria-label="Send message"
                    className="p-2 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#FFE08A] text-black font-semibold hover:brightness-110 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shrink-0 shadow-[0_0_12px_rgba(212,175,55,0.3)]"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>

                {/* Footer notes & voice indicator */}
                <div className="flex items-center justify-between mt-2 px-1 text-[10px] text-zinc-500 font-mono">
                  <span className="flex items-center gap-1">
                    <Radio className="w-3 h-3 text-[#FFE08A]" />
                    <span>Speaks in Charon Baritone</span>
                  </span>
                  <span>Enter ↵ to send • Mic for voice</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};
