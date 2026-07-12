'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface StepData {
  id: number;
  text: string;
  temperature?: number;
}

interface VoiceState {
  isListening: boolean;
  isSupported: boolean;
  lastCommand: string;
  isSpeaking: boolean;
  speakingText: string;
  speakingCharIndex: number;
}

const SPEECH_ENABLED_STORAGE_KEY = 'kitchenVoiceSpeechEnabled';
const USE_KOKORO_TTS = process.env.NEXT_PUBLIC_USE_KOKORO_TTS === 'true';
const NEXT_COMMAND_PATTERN = /\b(suiv\w*|prochain\w*|apres|apre|continu\w*|suite)\b/;
const PREVIOUS_COMMAND_PATTERN = /\b(preced\w*|president|retour|avant|revenir|revien\w*)\b/;
const FINISH_COMMAND_PATTERN = /\b(termin\w*|fini\w*|finir)\b|c.?est fini|j.?ai fini|j.?ai termine/;

const normalizeSpeechText = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const prepareSpeechText = (text: string): string =>
  text
    .replace(/\s+/g, ' ')
    .replace(/([.!?])\s+/g, '$1  ')
    .replace(/:\s+/g, ':  ')
    .replace(/,\s+/g, ', ')
    .trim();

const isLikelySpeechEcho = (recognizedText: string, spokenText: string): boolean => {
  if (!recognizedText || !spokenText) return false;

  const spokenStart = spokenText.slice(0, 48);

  return (
    (recognizedText.length > 12 && spokenText.includes(recognizedText)) ||
    (spokenStart.length > 24 && recognizedText.includes(spokenStart))
  );
};

const isKokoroVoice = (voice: SpeechSynthesisVoice): boolean => {
  const name = `${voice.name} ${voice.voiceURI}`.toLowerCase();
  return name.includes('kokoro');
};

const selectBestFrenchVoice = (
  voices: SpeechSynthesisVoice[],
  excludedVoiceNames = new Set<string>()
): SpeechSynthesisVoice | undefined => {
  const candidateVoices = voices.filter((voice) => {
    const name = `${voice.name} ${voice.voiceURI}`.toLowerCase();
    return (
      !excludedVoiceNames.has(voice.name) &&
      (voice.lang.toLowerCase().startsWith('fr') ||
        name.includes('kokoro') ||
        name.includes('francais') ||
        name.includes('français'))
    );
  });

  if (candidateVoices.length === 0) return undefined;

  const kokoroVoiceHints = [
    'kokoro',
    'neural kokoro',
    'kokoro fr',
    'kokoro français',
    'kokoro francais',
  ];

  const masculineVoiceHints = [
    'thomas',
    'paul',
    'henri',
    'antoine',
    'guillaume',
    'louis',
    'luc',
    'mathieu',
    'remy',
    'daniel',
    'google français',
    'google francais',
  ];

  const feminineVoiceHints = [
    'denise',
    'hortense',
    'audrey',
    'amelie',
    'amélie',
    'celine',
    'céline',
    'julie',
    'marie',
    'lea',
    'léa',
  ];

  const qualityVoiceHints = [
    'natural',
    'neural',
    'online',
    'microsoft',
    'google',
  ];

  return candidateVoices
    .map((voice) => {
      const name = `${voice.name} ${voice.voiceURI}`.toLowerCase();
      const kokoroScore = kokoroVoiceHints.reduce(
        (score, hint, index) => score + (name.includes(hint) ? 160 - index : 0),
        0
      );
      const exactFrenchScore = voice.lang.toLowerCase() === 'fr-fr' ? 20 : 0;
      const frenchScore = voice.lang.toLowerCase().startsWith('fr') ? 16 : 0;
      const masculineScore = masculineVoiceHints.reduce(
        (score, hint, index) => score + (name.includes(hint) ? 60 - index : 0),
        0
      );
      const qualityScore = qualityVoiceHints.reduce(
        (score, hint, index) => score + (name.includes(hint) ? 20 - index : 0),
        0
      );
      const femininePenalty = feminineVoiceHints.some((hint) => name.includes(hint)) ? 45 : 0;
      const localPenalty = voice.localService ? 0 : 4;

      return {
        voice,
        score:
          kokoroScore +
          exactFrenchScore +
          frenchScore +
          masculineScore +
          qualityScore +
          localPenalty -
          femininePenalty,
      };
    })
    .sort((a, b) => b.score - a.score)[0]?.voice;
};

export function useVoiceCooking(
  steps: StepData[],
  currentStep: number,
  onNext: () => void,
  onPrevious: () => void,
  onGoTo: (index: number) => void,
  getCoachLine?: () => string,
  getRecipeTimeLine?: () => string,
  onFinish?: () => void
) {
  const [voiceState, setVoiceState] = useState<VoiceState>({
    isListening: false,
    isSupported: false,
    lastCommand: '',
    isSpeaking: false,
    speakingText: '',
    speakingCharIndex: 0,
  });
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(true);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const preferredVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const failedVoiceNamesRef = useRef<Set<string>>(new Set());
  const isListeningRef = useRef(false);
  const ignoreRecognitionUntilRef = useRef(0);
  const lastSpokenTextRef = useRef('');
  const processCommandRef = useRef<(text: string) => boolean>(() => false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const audioProgressIntervalRef = useRef<number | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const ttsPrefetchAbortRef = useRef<AbortController | null>(null);
  const ttsAudioCacheRef = useRef<Map<string, Blob>>(new Map());
  const speechRunIdRef = useRef(0);

  const clearGeneratedAudio = useCallback((abortRequest = true) => {
    if (abortRequest) {
      ttsAbortRef.current?.abort();
      ttsAbortRef.current = null;
    }

    if (audioProgressIntervalRef.current !== null) {
      window.clearInterval(audioProgressIntervalRef.current);
      audioProgressIntervalRef.current = null;
    }

    audioRef.current?.pause();
    audioRef.current = null;

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const supported = Boolean(
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    ) && 'speechSynthesis' in window;

    const storedPreference = window.localStorage.getItem(SPEECH_ENABLED_STORAGE_KEY);
    if (storedPreference !== null) {
      setIsSpeechEnabled(storedPreference === 'true');
    }

    setVoiceState((previous) => ({ ...previous, isSupported: supported }));
    if (supported) {
      synthRef.current = window.speechSynthesis;
      const refreshVoices = () => {
        preferredVoiceRef.current =
          selectBestFrenchVoice(window.speechSynthesis.getVoices(), failedVoiceNamesRef.current) || null;
      };

      refreshVoices();
      window.speechSynthesis.onvoiceschanged = refreshVoices;
    }
  }, []);

  const setSpeechEnabled = useCallback((enabled: boolean) => {
    setIsSpeechEnabled(enabled);
    if (!enabled) {
      speechRunIdRef.current += 1;
      clearGeneratedAudio();
      synthRef.current?.cancel();
      setVoiceState((previous) => ({
        ...previous,
        isSpeaking: false,
        speakingText: '',
        speakingCharIndex: 0,
      }));
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SPEECH_ENABLED_STORAGE_KEY, String(enabled));
    }
  }, []);

  const speakWithNativeSpeechSynthesis = useCallback((spokenText: string, allowVoiceFallback = true) => {
    if (!synthRef.current) return;

    const currentRunId = speechRunIdRef.current;
    synthRef.current.cancel();

    const finishSpeech = () => {
      if (speechRunIdRef.current !== currentRunId) return;

      ignoreRecognitionUntilRef.current = Date.now() + 250;
      setVoiceState((previous) => ({
        ...previous,
        isSpeaking: false,
        speakingText: spokenText,
        speakingCharIndex: spokenText.length,
      }));
    };

    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.lang = 'fr-FR';
    utterance.rate = 0.88;
    utterance.pitch = 0.88;
    utterance.volume = 1;

    utterance.onstart = () => {
      if (speechRunIdRef.current !== currentRunId) return;

      ignoreRecognitionUntilRef.current = Date.now() + 300;
      setVoiceState((previous) => ({
        ...previous,
        isSpeaking: true,
        speakingText: spokenText,
        speakingCharIndex: 0,
      }));
    };
    utterance.onboundary = (event) => {
      if (speechRunIdRef.current !== currentRunId) return;
      if (typeof event.charIndex !== 'number') return;

      setVoiceState((previous) => ({
        ...previous,
        speakingText: spokenText,
        speakingCharIndex: Math.min(event.charIndex, spokenText.length),
      }));
    };
    utterance.onend = finishSpeech;
    utterance.onerror = () => {
      finishSpeech();

      if (allowVoiceFallback && utterance.voice && isKokoroVoice(utterance.voice)) {
        failedVoiceNamesRef.current.add(utterance.voice.name);
        preferredVoiceRef.current =
          selectBestFrenchVoice(synthRef.current?.getVoices() || [], failedVoiceNamesRef.current) || null;
        window.setTimeout(() => speakWithNativeSpeechSynthesis(spokenText, false), 150);
      }
    };

    const frVoice =
      preferredVoiceRef.current ||
      selectBestFrenchVoice(synthRef.current.getVoices(), failedVoiceNamesRef.current);
    if (frVoice) {
      utterance.voice = frVoice;
      preferredVoiceRef.current = frVoice;
    }

    synthRef.current.speak(utterance);
  }, []);

  const speak = useCallback((text: string, interrupt = true, allowVoiceFallback = true) => {
    if (!isSpeechEnabled) return;

    speechRunIdRef.current += 1;
    const currentRunId = speechRunIdRef.current;
    clearGeneratedAudio();
    const abortController = new AbortController();
    ttsAbortRef.current = abortController;
    synthRef.current?.cancel();

    const spokenText = prepareSpeechText(text);

    lastSpokenTextRef.current = normalizeSpeechText(spokenText);
    ignoreRecognitionUntilRef.current = Date.now() + 250;

    setVoiceState((previous) => ({
      ...previous,
      isSpeaking: false,
      speakingText: '',
      speakingCharIndex: 0,
    }));

    const fallbackToNative = () => {
      if (speechRunIdRef.current !== currentRunId) return;
      speakWithNativeSpeechSynthesis(spokenText, allowVoiceFallback);
    };

    if (!USE_KOKORO_TTS) {
      fallbackToNative();
      return;
    }

    void (async () => {
      try {
        let audioBlob = ttsAudioCacheRef.current.get(spokenText);

        if (!audioBlob) {
          const response = await fetch('/api/tts/step', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify({ text: spokenText }),
            signal: abortController.signal,
          });

          if (!response.ok) {
            fallbackToNative();
            return;
          }

          audioBlob = await response.blob();
          ttsAudioCacheRef.current.set(spokenText, audioBlob);
        }

        if (speechRunIdRef.current !== currentRunId) return;

        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audioUrlRef.current = audioUrl;

        const updateAudioProgress = () => {
          if (speechRunIdRef.current !== currentRunId) return;

          const fallbackDuration = Math.max(2.2, spokenText.length / 13);
          const duration =
            Number.isFinite(audio.duration) && audio.duration > 0
              ? audio.duration
              : fallbackDuration;
          const progress = Math.min(audio.currentTime / duration, 0.98);

          setVoiceState((previous) => ({
            ...previous,
            isSpeaking: true,
            speakingText: spokenText,
            speakingCharIndex: Math.min(
              spokenText.length,
              Math.max(0, Math.floor(progress * spokenText.length))
            ),
          }));
        };

        const startAudioProgress = () => {
          if (audioProgressIntervalRef.current !== null) return;

          updateAudioProgress();
          audioProgressIntervalRef.current = window.setInterval(updateAudioProgress, 90);
        };

        audio.onended = () => {
          clearGeneratedAudio(false);
          if (speechRunIdRef.current !== currentRunId) return;
          ignoreRecognitionUntilRef.current = Date.now() + 250;
          setVoiceState((previous) => ({
            ...previous,
            isSpeaking: false,
            speakingText: spokenText,
            speakingCharIndex: spokenText.length,
          }));
        };
        audio.onerror = () => {
          clearGeneratedAudio(false);
          fallbackToNative();
        };
        audio.onplaying = startAudioProgress;

        await audio.play();
      } catch (error) {
        if (abortController.signal.aborted) return;
        fallbackToNative();
      }
    })();
  }, [clearGeneratedAudio, isSpeechEnabled, speakWithNativeSpeechSynthesis]);

  useEffect(() => {
    if (!USE_KOKORO_TTS || !isSpeechEnabled || typeof window === 'undefined') return;

    const nextStepText = steps[currentStep + 1]?.text;
    if (!nextStepText) return;

    const spokenText = prepareSpeechText(nextStepText);
    if (!spokenText || ttsAudioCacheRef.current.has(spokenText)) return;

    ttsPrefetchAbortRef.current?.abort();
    const abortController = new AbortController();
    ttsPrefetchAbortRef.current = abortController;

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch('/api/tts/step', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify({ text: spokenText }),
            signal: abortController.signal,
          });

          if (!response.ok || abortController.signal.aborted) return;

          const audioBlob = await response.blob();
          ttsAudioCacheRef.current.set(spokenText, audioBlob);
        } catch {
          // Prefetch is best effort. Normal playback still has native fallback.
        }
      })();
    }, 600);

    return () => {
      window.clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [currentStep, isSpeechEnabled, steps]);

  useEffect(() => {
    return () => {
      speechRunIdRef.current += 1;
      ttsPrefetchAbortRef.current?.abort();
      clearGeneratedAudio();
      synthRef.current?.cancel();
    };
  }, [clearGeneratedAudio]);

  const processCommand = useCallback(
    (text: string) => {
      const normalized = normalizeSpeechText(text);
      const lastSpokenText = lastSpokenTextRef.current;
      const isNavigationCommand =
        NEXT_COMMAND_PATTERN.test(normalized) ||
        PREVIOUS_COMMAND_PATTERN.test(normalized) ||
        FINISH_COMMAND_PATTERN.test(normalized);

      if (
        !isNavigationCommand &&
        (Date.now() < ignoreRecognitionUntilRef.current ||
          isLikelySpeechEcho(normalized, lastSpokenText))
      ) {
        return false;
      }

      setVoiceState((previous) => ({ ...previous, lastCommand: text }));

      if (NEXT_COMMAND_PATTERN.test(normalized)) {
        onNext();
        return true;
      }

      if (PREVIOUS_COMMAND_PATTERN.test(normalized)) {
        onPrevious();
        return true;
      }

      if (FINISH_COMMAND_PATTERN.test(normalized)) {
        onFinish?.();
        return true;
      }

      if (/repete|redis|encore|recommence|lecture|lire|lis/.test(normalized)) {
        const step = steps[currentStep];
        if (step) {
          speak(step.text, true);
        }
        return true;
      }

      const gotoMatch = normalized.match(/etape\s+(\d+)/);
      if (gotoMatch) {
        const requestedStep = parseInt(gotoMatch[1], 10) - 1;
        if (requestedStep >= 0 && requestedStep < steps.length) {
          onGoTo(requestedStep);
        } else {
          speak(`Il n'y a pas d'étape ${parseInt(gotoMatch[1], 10)}`);
        }
        return true;
      }

      if (/duree|temps|minute|combien/.test(normalized)) {
        speak(getRecipeTimeLine?.() || 'Je n ai pas de temps total precise pour cette recette.', true);
        return true;
      }

      if (/quelle etape|ou en suis|etape combien/.test(normalized)) {
        speak(`Vous êtes à l'étape ${currentStep + 1} sur ${steps.length}`, true);
        return true;
      }

      if (/aide|help|commande|que dire|coach|conseil|astuce|guide/.test(normalized)) {
        speak(
          'Commandes disponibles : suivant, précédent, répète, terminer, aller à l\'étape 3, temps total, quelle étape',
          true
        );
        return true;
      }

      return false;
    },
    [currentStep, getRecipeTimeLine, onFinish, onGoTo, onNext, onPrevious, speak, steps]
  );

  useEffect(() => {
    processCommandRef.current = processCommand;
  }, [processCommand]);

  const startListening = useCallback(() => {
    if (!voiceState.isSupported || typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 5;

    recognition.onresult = (event: any) => {
      const results = Array.from(event.results) as any[];
      const last = results[results.length - 1];
      if (last?.isFinal) {
        for (let index = 0; index < last.length; index += 1) {
          if (processCommandRef.current(last[index].transcript)) {
            break;
          }
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') return;
      console.warn('Speech recognition error:', event.error);
    };

    recognition.onend = () => {
      if (isListeningRef.current) {
        window.setTimeout(() => {
          try {
            recognition.start();
          } catch {
            // Déjà démarré
          }
        }, 300);
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    isListeningRef.current = true;
    setVoiceState((previous) => ({ ...previous, isListening: true }));
  }, [voiceState.isSupported]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    speechRunIdRef.current += 1;
    clearGeneratedAudio();
    synthRef.current?.cancel();
    setVoiceState((previous) => ({
      ...previous,
      isListening: false,
      lastCommand: '',
      isSpeaking: false,
      speakingText: '',
      speakingCharIndex: 0,
    }));
  }, [clearGeneratedAudio]);

  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      recognitionRef.current?.stop();
      speechRunIdRef.current += 1;
      clearGeneratedAudio();
      synthRef.current?.cancel();
    };
  }, [clearGeneratedAudio]);

  return { voiceState, speak, startListening, stopListening, isSpeechEnabled, setSpeechEnabled };
}
