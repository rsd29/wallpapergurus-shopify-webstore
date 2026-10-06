const EAGER_COUNT = 12;
const HIGH_PRIORITY_COUNT = 4;
const PREFETCH_COUNT = 8;
const PREFETCH_MARGIN = '1200px 0px';

/** @type {IntersectionObserver | null} */
let imageObserver = null;

/**
 * @returns {IntersectionObserver}
 */
function getImageObserver() {
  if (imageObserver) return imageObserver;

  imageObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || !(entry.target instanceof HTMLImageElement)) continue;
        const img = entry.target;
        if (img.loading === 'lazy') img.loading = 'eager';
        img.classList.toggle('is-loaded', img.complete);
        imageObserver?.unobserve(img);
      }
    },
    { rootMargin: PREFETCH_MARGIN, threshold: 0.01 }
  );

  return imageObserver;
}

/**
 * @param {ParentNode} [root]
 */
export function prioritizeProductCardImages(root = document) {
  const grids = root.querySelectorAll('.product-grid, .resource-list, [data-testid="resource-list-grid"]');
  const scopedGrids = grids.length > 0 ? grids : [root];

  for (const grid of scopedGrids) {
    const items = grid.querySelectorAll('.product-grid__item, .resource-list__item');
    items.forEach((item, index) => {
      const images = item.querySelectorAll('.card-gallery .product-media__image');
      images.forEach((img, imageIndex) => {
        if (!(img instanceof HTMLImageElement)) return;
        if (img.complete) img.classList.add('is-loaded');

        if (imageIndex === 0 && index < EAGER_COUNT) {
          img.loading = 'eager';
          if (index < HIGH_PRIORITY_COUNT) img.fetchPriority = 'high';
        }

        getImageObserver().observe(img);
      });
    });
  }
}

/**
 * @param {ParentNode} [root]
 */
export function observeCardImages(root = document) {
  const images = root.querySelectorAll('.card-gallery .product-media__image');
  for (const img of images) {
    if (!(img instanceof HTMLImageElement)) continue;
    if (img.complete) img.classList.add('is-loaded');
    getImageObserver().observe(img);
  }
}

/**
 * @param {string} html
 * @param {number} [limit]
 */
export function prefetchCardImagesFromHTML(html, limit = PREFETCH_COUNT) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const images = [...doc.querySelectorAll('.card-gallery .product-media__image')].slice(0, limit);

  for (const img of images) {
    if (!(img instanceof HTMLImageElement)) continue;
    const src = img.getAttribute('src');
    if (!src) continue;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;
    const srcset = img.getAttribute('srcset');
    const sizes = img.getAttribute('sizes');
    if (srcset) link.setAttribute('imagesrcset', srcset);
    if (sizes) link.setAttribute('imagesizes', sizes);
    document.head.appendChild(link);
  }
}

let initialized = false;

function initCardImagePriority() {
  if (initialized) return;
  initialized = true;
  prioritizeProductCardImages();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCardImagePriority, { once: true });
} else {
  initCardImagePriority();
}
