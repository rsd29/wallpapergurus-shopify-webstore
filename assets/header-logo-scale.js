import { getScrollContainer, getScrollTop, scrollContainerMediaQuery } from '@theme/scroll-container';

const SCROLL_RANGE = 280;
const PROGRESS_PROPERTY = '--header-logo-progress';

/** @type {EventTarget[]} */
let scrollTargets = [];
let rafId = null;

/**
 * Ease-out so the logo stays larger near the top, then settles.
 * @param {number} value
 */
function easeOut(value) {
  return 1 - (1 - value) ** 2;
}

function currentScrollTop() {
  const scrollingElement = document.scrollingElement ?? document.documentElement;
  return Math.max(getScrollTop(), scrollingElement.scrollTop, window.scrollY);
}

/** @type {number} */
let nudgeX = 0;

function alignLogo() {
  const row = document.querySelector('.header__row--top');
  const logo = document.querySelector('a.header-logo');
  if (!row || !logo) return;

  const rowRect = row.getBoundingClientRect();
  const logoRect = logo.getBoundingClientRect();
  const layoutCenter = logoRect.left + logoRect.width / 2 - nudgeX;
  const next = rowRect.left + rowRect.width / 2 - layoutCenter;
  if (Math.abs(next - nudgeX) < 0.5) return;

  nudgeX = next;
  document.documentElement.style.setProperty('--header-logo-nudge-x', `${nudgeX.toFixed(2)}px`);
}

function logoScalesOnScroll() {
  return document.querySelector('a.header-logo[data-header-logo-scale]') != null;
}

function updateLogoScale() {
  if (!logoScalesOnScroll()) return;

  const progress = Math.min(1, Math.max(0, currentScrollTop() / SCROLL_RANGE));
  document.documentElement.style.setProperty(PROGRESS_PROPERTY, easeOut(progress).toFixed(4));
  alignLogo();
}

function onScroll() {
  if (rafId !== null) return;

  rafId = requestAnimationFrame(() => {
    rafId = null;
    updateLogoScale();
  });
}

function bindScrollTargets() {
  for (const target of scrollTargets) {
    target.removeEventListener('scroll', onScroll);
  }

  const uniqueTargets = new Set([getScrollContainer(), document, window]);
  scrollTargets = [...uniqueTargets];

  for (const target of scrollTargets) {
    target.addEventListener('scroll', onScroll, { passive: true });
  }

  updateLogoScale();
}

function initHeaderLogoScale() {
  if (logoScalesOnScroll()) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.documentElement.style.setProperty(PROGRESS_PROPERTY, '0.45');
    } else {
      bindScrollTargets();
      scrollContainerMediaQuery.addEventListener('change', bindScrollTargets);
    }
  }

  alignLogo();
  window.addEventListener('resize', alignLogo);
  document.fonts?.ready.then(alignLogo);

  const row = document.querySelector('.header__row--top');
  if (row) {
    const observer = new ResizeObserver(alignLogo);
    observer.observe(row);

    for (const element of row.querySelectorAll('.header__column, a.header-logo, .header-contact')) {
      observer.observe(element);
    }
  }

  const header = document.querySelector('#header-component');
  if (header) {
    new MutationObserver(alignLogo).observe(header, {
      attributes: true,
      attributeFilter: ['data-menu-style'],
    });
  }
}

initHeaderLogoScale();
