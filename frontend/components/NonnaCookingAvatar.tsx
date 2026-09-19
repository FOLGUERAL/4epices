'use client';

import { useEffect, useRef, useState } from 'react';

export type NonnaState = 'idle' | 'speaking' | 'celebrating';

type NonnaCookingAvatarProps = {
  state: NonnaState;
  caption?: string;
  className?: string;
};

const NONNA_FRAMES: Record<NonnaState, { src: string; video?: string; label: string }> = {
  idle: {
    src: '/images/nonna-idle.webp',
    video: '/images/lanonna_repos.mp4',
    label: 'La nonna vous écoute',
  },
  speaking: {
    src: '/images/nonna-speaking.webp',
    video: '/images/lanonna_parole.mp4',
    label: 'La nonna vous explique l\'étape',
  },
  celebrating: {
    src: '/images/nonna-celebrating.webp',
    label: 'La nonna vous félicite',
  },
};

const NONNA_STATES = Object.keys(NONNA_FRAMES) as NonnaState[];

export default function NonnaCookingAvatar({
  state,
  caption,
  className = '',
}: NonnaCookingAvatarProps) {
  const [videosDisabled, setVideosDisabled] = useState(false);
  const videoRefs = useRef<Partial<Record<NonnaState, HTMLVideoElement | null>>>({});

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setVideosDisabled(query.matches);

    update();
    query.addEventListener('change', update);

    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    NONNA_STATES.forEach((frame) => {
      const video = videoRefs.current[frame];
      if (!video) return;

      if (frame === state && !videosDisabled) {
        video.currentTime = 0;
        void video.play().catch(() => setVideosDisabled(true));
      } else {
        video.pause();
      }
    });
  }, [state, videosDisabled]);

  const usesVideo = Boolean(NONNA_FRAMES[state].video) && !videosDisabled;
  const frameClassName = (frame: NonnaState) =>
    `absolute inset-0 h-full w-full object-cover object-[50%_12%] transition-opacity duration-300 motion-reduce:transition-none ${
      frame === state ? 'opacity-100' : 'opacity-0'
    }`;

  return (
    <div
      role="img"
      aria-label={NONNA_FRAMES[state].label}
      className={`relative overflow-hidden rounded-lg bg-[#fdf3e3] ${className}`}
    >
      <div
        className={`absolute inset-0 ${
          usesVideo
            ? ''
            : state === 'speaking'
              ? 'motion-safe:animate-[nonna-speak_0.9s_ease-in-out_infinite]'
              : 'motion-safe:animate-[nonna-breathe_5s_ease-in-out_infinite]'
        }`}
      >
        {NONNA_STATES.map((frame) => {
          const { src, video } = NONNA_FRAMES[frame];

          return video && !videosDisabled ? (
            <video
              key={frame}
              ref={(element) => {
                videoRefs.current[frame] = element;
              }}
              src={video}
              poster={src}
              muted
              loop
              playsInline
              preload="auto"
              aria-hidden="true"
              tabIndex={-1}
              onError={() => setVideosDisabled(true)}
              className={frameClassName(frame)}
            />
          ) : (
            <img
              key={frame}
              src={src}
              alt=""
              aria-hidden="true"
              draggable={false}
              className={frameClassName(frame)}
            />
          );
        })}
      </div>

      {caption && (
        <p
          role="status"
          className="absolute inset-x-2 top-2 rounded-xl bg-white/95 px-3 py-2 text-center text-sm font-semibold leading-snug text-orange-800 shadow-md motion-safe:animate-fade-in"
        >
          {caption}
        </p>
      )}

      {state === 'speaking' && (
        <span
          className="absolute bottom-2 left-2 flex h-6 items-end gap-0.5 rounded-full bg-white/90 px-2 py-1 shadow"
          aria-hidden="true"
        >
          {[0, 1, 2].map((bar) => (
            <span
              key={bar}
              className="h-full w-1 origin-bottom rounded-full bg-orange-500 motion-safe:animate-[nonna-bars_0.7s_ease-in-out_infinite]"
              style={{ animationDelay: `${bar * 0.15}s` }}
            />
          ))}
        </span>
      )}
    </div>
  );
}
