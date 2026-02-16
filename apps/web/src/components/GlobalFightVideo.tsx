'use client';

import { useEffect, useRef, useState } from 'react';
import { useVideoStore } from '@/lib/stores/videoStore';
import { Spinner } from './Spinner';

const MIN_DURATION = 5000; // Match video duration (5 seconds)
const VIDEO_SRC = '/Video/Fight_intro_video.webm';

// Module-level blob cache — survives component remounts and SPA navigations.
// The 1.8MB video is fetched once and reused for every fight.
let cachedBlobUrl: string | null = null;
let fetchPromise: Promise<string> | null = null;

function prefetchVideo(): Promise<string> {
  if (cachedBlobUrl) return Promise.resolve(cachedBlobUrl);
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch(VIDEO_SRC)
    .then(res => res.blob())
    .then(blob => {
      cachedBlobUrl = URL.createObjectURL(blob);
      console.log('[GlobalFightVideo] Video prefetched into blob');
      return cachedBlobUrl;
    })
    .catch(err => {
      console.warn('[GlobalFightVideo] Prefetch failed, falling back to URL:', err);
      fetchPromise = null;
      return VIDEO_SRC; // fallback to network URL
    });

  return fetchPromise;
}

/**
 * GlobalFightVideo - Global video overlay shown when joining a fight
 *
 * On mount, the video is fetched via JS fetch() into a Blob URL (module-level
 * cache). This guarantees the 1.8MB file is fully in memory before playback.
 * When startVideo() is called, playback is instant.
 *
 * The video element is ALWAYS rendered (hidden via CSS when not playing)
 * so the blob src is ready immediately when needed.
 *
 * The video starts MUTED to bypass browser autoplay policy (which blocks
 * unmuted autoplay from non-user-gesture contexts like WebSocket handlers).
 * It unmutes immediately after play() succeeds.
 */
export function GlobalFightVideo() {
  const { isPlaying, stopVideo } = useVideoStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const startTimeRef = useRef<number>(0);
  const hasEndedRef = useRef(false);
  const [blobSrc, setBlobSrc] = useState<string | null>(cachedBlobUrl);
  const [isBuffering, setIsBuffering] = useState(true);

  // Prefetch video into blob on mount
  useEffect(() => {
    prefetchVideo().then(url => setBlobSrc(url));
  }, []);

  // Track when video has enough data to play through
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const markReady = () => setIsBuffering(false);

    if (video.readyState >= 3) {
      setIsBuffering(false);
    }

    video.addEventListener('canplaythrough', markReady);
    return () => video.removeEventListener('canplaythrough', markReady);
  }, [blobSrc]); // re-run when blob src changes

  // Start playback when isPlaying becomes true
  useEffect(() => {
    if (!isPlaying || !videoRef.current || !blobSrc) return;

    const video = videoRef.current;
    hasEndedRef.current = false;
    startTimeRef.current = Date.now();
    video.currentTime = 0;

    // Start muted to guarantee autoplay works (browser policy blocks
    // unmuted autoplay from non-user-gesture contexts like WebSocket events).
    video.muted = true;

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          // Unmute after play starts
          video.muted = false;
          console.log('[GlobalFightVideo] Playing, duration:', video.duration);
        })
        .catch((err) => {
          console.warn('[GlobalFightVideo] Play failed:', err);
          setTimeout(() => {
            if (!hasEndedRef.current) {
              hasEndedRef.current = true;
              stopVideo();
            }
          }, MIN_DURATION);
        });
    }
  }, [isPlaying, stopVideo, blobSrc]);

  // Pause and re-mute video when overlay closes
  useEffect(() => {
    if (!isPlaying && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.muted = true;

      // Force TradingView chart to re-render
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
      });
    }
  }, [isPlaying]);

  // Enforce minimum duration on video end
  const handleVideoEnd = () => {
    if (hasEndedRef.current) return;

    const elapsed = Date.now() - startTimeRef.current;
    const remaining = Math.max(0, MIN_DURATION - elapsed);

    setTimeout(() => {
      if (!hasEndedRef.current) {
        hasEndedRef.current = true;
        stopVideo();
      }
    }, remaining);
  };

  // Handle video error — still wait minimum duration
  const handleVideoError = () => {
    if (hasEndedRef.current) return;

    const elapsed = Date.now() - startTimeRef.current;
    const remaining = Math.max(0, MIN_DURATION - elapsed);

    setTimeout(() => {
      if (!hasEndedRef.current) {
        hasEndedRef.current = true;
        stopVideo();
      }
    }, remaining);
  };

  return (
    <>
      {/* Backdrop + modal — only visible when playing */}
      {isPlaying && (
        <>
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[9998]" />
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="relative bg-surface-900 rounded-xl shadow-2xl max-w-4xl w-full overflow-hidden border border-surface-800" />
          </div>
        </>
      )}

      {/*
        Single video element — ALWAYS in DOM with blob src.
        When playing: positioned centered over the modal.
        When not playing: hidden off-screen (1x1px, invisible).
      */}
      {blobSrc && (
        <video
          ref={videoRef}
          onEnded={handleVideoEnd}
          onError={handleVideoError}
          className={
            isPlaying
              ? 'fixed z-[10000] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-4xl w-[calc(100%-2rem)] rounded-xl'
              : 'fixed w-px h-px opacity-0 pointer-events-none -z-50 top-0 left-0'
          }
          playsInline
          muted
          preload="auto"
          controls={false}
          src={blobSrc}
        />
      )}

      {/* Buffering spinner — shows inside modal when video isn't ready */}
      {isPlaying && isBuffering && (
        <div className="fixed z-[10001] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="flex flex-col items-center gap-3">
            <Spinner size="lg" />
            <span className="text-surface-400 text-sm font-medium">Get ready to fight...</span>
          </div>
        </div>
      )}
    </>
  );
}
