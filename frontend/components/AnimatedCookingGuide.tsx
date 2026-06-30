'use client';

import { Mic, MicOff, Play, Volume2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { CookingGuide } from '@/lib/cookingGuide';

type AnimatedCookingGuideProps = {
  guide: CookingGuide;
  stepText: string;
  isSpeaking: boolean;
  speakingText: string;
  speakingCharIndex: number;
  onSpeak: () => void;
};

const normalizeForSync = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export default function AnimatedCookingGuide({
  guide,
  stepText,
  isSpeaking,
  speakingText,
  speakingCharIndex,
  onSpeak,
}: AnimatedCookingGuideProps) {
  const [visibleLength, setVisibleLength] = useState(stepText.length);
  const [imageSrc, setImageSrc] = useState(guide.imageSrc);

  const statusLabel = isSpeaking ? 'Lecture en cours' : 'Pret pour l etape';
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
    setVisibleLength(Math.min(speakingCharIndex + 1, stepText.length));
  }, [isSpeaking, speakingCharIndex, stepText.length, syncsWithCurrentStep]);

  useEffect(() => {
    if (!isSpeaking) {
      setVisibleLength(stepText.length);
    }
  }, [isSpeaking, stepText]);

  const handleSpeak = () => {
    onSpeak();
  };

  return (
    <section className="mb-5 overflow-hidden rounded-xl border border-orange-100 bg-white shadow-sm">
      <div className="grid gap-0 md:grid-cols-[17rem_minmax(0,1fr)]">
        <div className="relative bg-[#fffdfa] p-3">
          <div className="relative aspect-[281/319] overflow-hidden rounded-lg bg-[#fffdfa]">
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
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-between gap-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-bold uppercase text-red-700">
                  <span className="h-2 w-2 rounded-full bg-red-600" aria-hidden="true" />
                  En direct
                </span>
                <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                  {guide.action}
                </span>
              </div>
              <h3 className="truncate text-lg font-bold text-gray-900">{guide.title}</h3>
            </div>

            <button
              type="button"
              onClick={handleSpeak}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-600 text-white shadow-sm transition-colors hover:bg-orange-700 focus-ring"
              aria-label="Lire l'etape"
              title="Lire l'etape"
            >
              {isSpeaking ? (
                <Volume2 className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Play className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
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

          <div className="flex items-center gap-2 text-gray-600">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-100">
              {isSpeaking ? (
                <Mic className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              ) : (
                <MicOff className="h-4 w-4" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-800">{statusLabel}</p>
              <p className="truncate text-xs text-gray-500">Le texte suit la lecture de l'etape</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
