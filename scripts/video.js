import { VIDEO_EMBED_URL, VIDEO_THUMBNAILS } from './video-config.js';

const MIN_THUMB_WIDTH = 200;

/**
 * Probe thumbnail candidates in order. Resolves with the first URL whose
 * image loads at a real size, or null when every candidate fails.
 */
function findThumbnail(candidates) {
  return new Promise((resolve) => {
    const tryAt = (idx) => {
      if (idx >= candidates.length) {
        resolve(null);
        return;
      }
      const probe = new Image();
      probe.decoding = 'async';
      probe.onload = () => {
        if (probe.naturalWidth >= MIN_THUMB_WIDTH) resolve(candidates[idx]);
        else tryAt(idx + 1);
      };
      probe.onerror = () => tryAt(idx + 1);
      probe.src = candidates[idx];
    };
    tryAt(0);
  });
}

/**
 * Click-to-load YouTube facade: no YouTube frame or script is requested
 * until the visitor presses the play button.
 */
export function initVideoFacade() {
  const frame = document.getElementById('video-frame');
  const facade = document.getElementById('video-facade');
  const thumb = document.getElementById('video-thumb');
  const playBtn = document.getElementById('video-play');
  if (!frame || !facade || !thumb || !playBtn) return;

  let thumbRequested = false;
  const loadThumbnail = async () => {
    if (thumbRequested) return;
    thumbRequested = true;
    const url = await findThumbnail(VIDEO_THUMBNAILS);
    if (!url) {
      // Keep the hero-angle fallback layer visible behind the play button.
      facade.classList.add('is-fallback');
      return;
    }
    thumb.src = url;
    thumb.hidden = false;
    facade.classList.add('has-thumb');
  };

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        io.disconnect();
        loadThumbnail();
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(frame);
  } else {
    loadThumbnail();
  }

  playBtn.addEventListener(
    'click',
    () => {
      const iframe = document.createElement('iframe');
      iframe.className = 'video-iframe';
      iframe.src = VIDEO_EMBED_URL;
      iframe.title = 'Video proses memasak kalio ayam';
      iframe.width = '1280';
      iframe.height = '720';
      iframe.allow =
        'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      facade.replaceWith(iframe);
      frame.classList.add('is-playing');
      iframe.focus();
    },
    { once: true },
  );
}
