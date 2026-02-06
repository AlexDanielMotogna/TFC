'use client';

import { useEffect, useRef } from 'react';
import { useVideoStore } from '@/lib/stores/videoStore';

const MIN_DURATION = 8000; // 8 seconds for testing (will be 3000 in production)

/**
 * GlobalFightVideo - Global video overlay shown when joining a fight
 * Plays independently of page transitions and state changes
 * Enforces minimum duration before closing
 */
export function GlobalFightVideo() {
  const { isPlaying, stopVideo } = useVideoStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const startTimeRef = useRef<number>(0);
  const hasEndedRef = useRef(false);

  useEffect(() => {
    if (isPlaying && videoRef.current) {
      const video = videoRef.current;

      // Reset state and record start time
      hasEndedRef.current = false;
      startTimeRef.current = Date.now();
      video.currentTime = 0;

      console.log('[GlobalFightVideo] Starting video playback');

      // Play the video
      const playPromise = video.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('[GlobalFightVideo] Video playing, duration:', video.duration);
          })
          .catch((error) => {
            console.error('[GlobalFightVideo] Video autoplay failed:', error);
            // If autoplay fails, still wait minimum duration then close
            setTimeout(() => {
              if (!hasEndedRef.current) {
                hasEndedRef.current = true;
                stopVideo();
              }
            }, MIN_DURATION);
          });
      }
    }
  }, [isPlaying, stopVideo]);

  // Handle video end - enforce minimum duration
  const handleVideoEnd = () => {
    if (hasEndedRef.current) {
      console.log('[GlobalFightVideo] Video already ended, skipping duplicate call');
      return;
    }

    const elapsed = Date.now() - startTimeRef.current;
    const remaining = Math.max(0, MIN_DURATION - elapsed);

    console.log(`[GlobalFightVideo] Video ended after ${elapsed}ms, waiting ${remaining}ms more`);

    setTimeout(() => {
      if (!hasEndedRef.current) {
        hasEndedRef.current = true;
        console.log('[GlobalFightVideo] Closing video overlay');
        stopVideo();
      }
    }, remaining);
  };

  // Handle video error - close after minimum duration
  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    console.error('[GlobalFightVideo] Video error:', e);

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

  if (!isPlaying) return null;

  return (
    <>
      {/* Backdrop - z-index 9998 */}
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[9998]" />

      {/* Modal - z-index 9999 */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
        <div className="relative bg-surface-900 rounded-xl shadow-2xl max-w-4xl w-full overflow-hidden border border-surface-800 pointer-events-auto">
          {/* Video */}
          <video
            ref={videoRef}
            onEnded={handleVideoEnd}
            onError={handleVideoError}
            className="w-full h-auto"
            playsInline
            muted={false}
            preload="auto"
            controls={false}
          >
            <source src="/Video/Fight_intro_video.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
      </div>
    </>
  );
}
