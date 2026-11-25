// Single source of truth for the cooking video. Every URL is derived from VIDEO_ID.
export const VIDEO_ID = 'exCLA47ZEFw';

export const VIDEO_WATCH_URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`;

export const VIDEO_EMBED_URL =
  `https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;

// Tried in order; YouTube may answer a missing size with a 120x90 placeholder (HTTP 200 or 404).
export const VIDEO_THUMBNAILS = ['maxresdefault', 'sddefault', 'hqdefault'].map(
  (size) => `https://i.ytimg.com/vi/${VIDEO_ID}/${size}.jpg`,
);
