'use client';

import { RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CookingGuide } from '@/lib/cookingGuide';

type AnimatedCookingGuideProps = {
  guide: CookingGuide;
  stepText: string;
  isSpeaking: boolean;
  speakingText: string;
  speakingCharIndex: number;
  isSpeechEnabled: boolean;
  isComplete?: boolean;
  onSpeak: () => void;
};

const normalizeForSync = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const ESTIMATED_CHARS_PER_SECOND = 13;

export default function AnimatedCookingGuide({
  guide,
  stepText,
  isSpeaking,
  speakingText,
  speakingCharIndex,
  isSpeechEnabled,
  isComplete = false,
  onSpeak,
}: AnimatedCookingGuideProps) {
  const [visibleLength, setVisibleLength] = useState(stepText.length);
  const [imageSrc, setImageSrc] = useState(guide.imageSrc);
  const [showSpeechHint, setShowSpeechHint] = useState(false);
  const fallbackStartedAtRef = useRef<number | null>(null);
  const lastBoundaryAtRef = useRef(0);

  const syncsWithCurrentStep = useMemo(
    () => normalizeForSync(speakingText).startsWith(normalizeForSync(stepText).slice(0, 24)),
    [speakingText, stepText]
  );

  const displayedText = stepText.slice(0, Math.max(1, visibleLength));
  const remainingText = stepText.slice(Math.max(1, visibleLength));
  const isRevealing = visibleLength < stepText.length;

  useEffect(() => {
    setImageSrc(guide.imageSrc);
  }, [guide.imageSrc]);

  useEffect(() => {
    if (!isSpeaking || !syncsWithCurrentStep) return;

    if (speakingCharIndex > 0) {
      lastBoundaryAtRef.current = Date.now();
    }

    const spokenLength = speakingText.length || stepText.length;
    const syncedLength =
      spokenLength > 0
        ? Math.round((speakingCharIndex / spokenLength) * stepText.length)
        : speakingCharIndex;

    setVisibleLength(Math.min(Math.max(1, syncedLength + 1), stepText.length));
  }, [isSpeaking, speakingCharIndex, speakingText.length, stepText.length, syncsWithCurrentStep]);

  useEffect(() => {
    if (!isSpeaking || !syncsWithCurrentStep) return;

    fallbackStartedAtRef.current = Date.now();
    lastBoundaryAtRef.current = speakingCharIndex > 0 ? Date.now() : 0;

    const estimatedDurationMs = Math.max(
      2200,
      (stepText.length / ESTIMATED_CHARS_PER_SECOND) * 1000
    );

    const intervalId = window.setInterval(() => {
      if (lastBoundaryAtRef.current && Date.now() - lastBoundaryAtRef.current < 900) {
        return;
      }

      const startedAt = fallbackStartedAtRef.current || Date.now();
      const progress = Math.min((Date.now() - startedAt) / estimatedDurationMs, 0.96);
      setVisibleLength((previous) =>
        Math.max(previous, Math.ceil(progress * stepText.length), 1)
      );
    }, 120);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isSpeaking, speakingCharIndex, stepText.length, syncsWithCurrentStep]);

  useEffect(() => {
    if (!isSpeaking) {
      fallbackStartedAtRef.current = null;
      lastBoundaryAtRef.current = 0;
      setVisibleLength(stepText.length);
    }
  }, [isSpeaking, stepText]);

  useEffect(() => {
    if (isSpeechEnabled) {
      setShowSpeechHint(false);
    }
  }, [isSpeechEnabled]);

  const handleSpeak = () => {
    if (!isSpeechEnabled) {
      setShowSpeechHint(true);
      return;
    }

    onSpeak();
    setShowSpeechHint(false);
  };

  return (
    <section className="mb-5 overflow-hidden rounded-xl border border-orange-100 bg-white shadow-sm">
      <div className="grid gap-0 md:grid-cols-[17rem_minmax(0,1fr)]">
        <div className="relative bg-[#fffdfa] p-3">
          <div className="relative flex aspect-[281/319] items-center justify-center overflow-hidden rounded-lg bg-[#fffdfa]">
            {isComplete ? (
              <img
                src="/fin_recette.png"
                alt="Recette terminée"
                className="h-full w-full object-contain"
                draggable={false}
              />
            ) : (
              <img
                src={imageSrc}
                alt={guide.imageAlt}
                className="h-full w-full object-contain"
                draggable={false}
                onError={() => {
                  if (imageSrc !== guide.fallbackImageSrc) {
                    setImageSrc(guide.fallbackImageSrc);
                  }
                }}
              />
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-between gap-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              {!isComplete && (
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                    {guide.action}
                  </span>
                </div>
              )}
              <h3 className="truncate text-lg font-bold text-gray-900">
                {isComplete ? 'Bravo' : guide.title}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSpeak}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-600 text-white shadow-sm transition-colors hover:bg-orange-700 focus-ring"
                aria-label="Repete l'etape"
                title="Répète l'étape"
              >
                {isSpeaking ? (
                  <Volume2 className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <RotateCcw className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
              {showSpeechHint && (
                <span className="flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                  <VolumeX className="h-3.5 w-3.5" />
                  Active le son pour lire
                </span>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <p className="min-h-[6rem] text-lg font-semibold leading-relaxed text-gray-900 sm:text-xl">
              <span>{displayedText}</span>
              {remainingText && (
                <span className="text-gray-400">{remainingText}</span>
              )}
              {isRevealing && (
                <span className="ml-1 inline-block h-5 w-0.5 translate-y-1 bg-orange-500" aria-hidden="true" />
              )}
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}
