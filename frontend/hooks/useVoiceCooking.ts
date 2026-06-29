'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface StepData {
  id: number;
  text: string;
  duration?: number;
  temperature?: number;
}

interface VoiceState {
  isListening: boolean;
  isSupported: boolean;
  lastCommand: string;
  isSpeaking: boolean;
}

export function useVoiceCooking(
  steps: StepData[],
  currentStep: number,
  onNext: () => void,
  onPrevious: () => void,
  onGoTo: (index: number) => void
) {
  const [voiceState, setVoiceState] = useState<VoiceState>({
    isListening: false,
    isSupported: false,
    lastCommand: '',
    isSpeaking: false,
  });

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const isListeningRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const supported = Boolean(
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    ) && 'speechSynthesis' in window;

    setVoiceState((previous) => ({ ...previous, isSupported: supported }));
    if (supported) {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  const speak = useCallback((text: string, interrupt = false) => {
    if (!synthRef.current) return;

    if (interrupt) {
      synthRef.current.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 0.92;
    utterance.pitch = 1;

    utterance.onstart = () => setVoiceState((previous) => ({ ...previous, isSpeaking: true }));
    utterance.onend = () => setVoiceState((previous) => ({ ...previous, isSpeaking: false }));

    const voices = synthRef.current.getVoices();
    const frVoice = voices.find((voice) => voice.lang === 'fr-FR') || voices.find((voice) => voice.lang.startsWith('fr'));
    if (frVoice) {
      utterance.voice = frVoice;
    }

    synthRef.current.speak(utterance);
  }, []);

  const processCommand = useCallback(
    (text: string) => {
      const normalized = text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      setVoiceState((previous) => ({ ...previous, lastCommand: text }));

      if (/suivant|prochain|apres|continuer|suite/.test(normalized)) {
        onNext();
        return true;
      }

      if (/precedent|retour|avant|revenir/.test(normalized)) {
        onPrevious();
        return true;
      }

      if (/repete|redis|encore|recommence/.test(normalized)) {
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
          speak(`Étape ${requestedStep + 1}. ${steps[requestedStep].text}`, true);
        } else {
          speak(`Il n'y a pas d'étape ${parseInt(gotoMatch[1], 10)}`);
        }
        return true;
      }

      if (/temperature|degre|four|chaud/.test(normalized)) {
        const step = steps[currentStep];
        speak(
          step?.temperature
            ? `Le four doit être à ${step.temperature} degrés`
            : 'Pas de température spécifiée pour cette étape',
          true
        );
        return true;
      }

      if (/duree|temps|minute|combien/.test(normalized)) {
        const step = steps[currentStep];
        speak(
          step?.duration
            ? `Cette étape dure ${step.duration} minute${step.duration > 1 ? 's' : ''}`
            : 'Pas de durée spécifiée pour cette étape',
          true
        );
        return true;
      }

      if (/quelle etape|ou en suis|etape combien/.test(normalized)) {
        speak(`Vous êtes à l'étape ${currentStep + 1} sur ${steps.length}`, true);
        return true;
      }

      if (/aide|help|commande|que dire/.test(normalized)) {
        speak(
          'Commandes disponibles : suivant, précédent, répète, aller à l\'étape 3, température, durée, quelle étape',
          true
        );
        return true;
      }

      return false;
    },
    [currentStep, onGoTo, onNext, onPrevious, speak, steps]
  );

  const startListening = useCallback(() => {
    if (!voiceState.isSupported || typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;

    recognition.onresult = (event: any) => {
      const results = Array.from(event.results) as any[];
      const last = results[results.length - 1];
      if (last?.isFinal) {
        for (let index = 0; index < last.length; index += 1) {
          if (processCommand(last[index].transcript)) {
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
    speak('Mode mains libres activé. Je vous écoute.', true);
  }, [processCommand, speak, voiceState.isSupported]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    synthRef.current?.cancel();
    setVoiceState((previous) => ({
      ...previous,
      isListening: false,
      lastCommand: '',
    }));
  }, []);

  useEffect(() => {
    if (voiceState.isListening && steps[currentStep]) {
      speak(steps[currentStep].text, true);
    }
  }, [currentStep, speak, steps, voiceState.isListening]);

  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      recognitionRef.current?.stop();
      synthRef.current?.cancel();
    };
  }, []);

  return { voiceState, speak, startListening, stopListening };
}
