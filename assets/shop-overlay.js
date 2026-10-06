import { lockScroll, unlockScroll } from '@theme/utilities';

/** @type {boolean} */
let initialized = false;

/** @type {number | null} */
let closeTimer = null;

/** @type {ResizeObserver | null} */
let headerStackObserver = null;

const FADE_MS = 320;

/**
 * @returns {HTMLElement | null}
 */
function getDrawer() {
  return document.querySelector('[data-shop-overlay]');
}

/**
 * @returns {HTMLElement | null}
 */
function getBackdrop() {
  return document.querySelector('[data-shop-overlay-backdrop]');
}

/**
 * @returns {number}
 */
function getHeaderStackBottom() {
  const headerSection = document.querySelector('.header-section');
  if (headerSection instanceof HTMLElement) {
    return Math.max(0, Math.round(headerSection.getBoundingClientRect().bottom));
  }

  const fallback = Number.parseFloat(getComputedStyle(document.body).getPropertyValue('--header-height'));
  return Number.isFinite(fallback) ? Math.max(0, Math.round(fallback)) : 0;
}

/**
 * @returns {number}
 */
function getPageScrollbarWidth() {
  const pageWrapper = document.querySelector('.page-wrapper');
  if (window.matchMedia('(min-width: 990px)').matches && pageWrapper instanceof HTMLElement) {
    return Math.max(0, pageWrapper.offsetWidth - pageWrapper.clientWidth);
  }
  return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
}

function syncOverlayTop() {
  const top = getHeaderStackBottom();
  document.body.style.setProperty('--shop-overlay-top', `${top}px`);
  document.body.style.setProperty('--page-scrollbar-width', `${getPageScrollbarWidth()}px`);
}

/**
 * @returns {boolean}
 */
function isOpen() {
  return Boolean(getDrawer()?.classList.contains('is-open'));
}

/**
 * @param {boolean} enabled
 */
function observeHeaderStack(enabled) {
  const headerSection = document.querySelector('.header-section');

  if (!enabled) {
    headerStackObserver?.disconnect();
    headerStackObserver = null;
    window.removeEventListener('resize', syncOverlayTop);
    window.removeEventListener('scroll', syncOverlayTop, true);
    return;
  }

  if (!headerStackObserver && headerSection instanceof HTMLElement) {
    headerStackObserver = new ResizeObserver(() => syncOverlayTop());
    headerStackObserver.observe(headerSection);
  }

  window.addEventListener('resize', syncOverlayTop);
  window.addEventListener('scroll', syncOverlayTop, true);
}

function closeSearchModal() {
  const searchModal = document.getElementById('search-modal');
  if (searchModal && typeof searchModal.closeDialog === 'function') {
    searchModal.closeDialog();
  }
}

/**
 * @param {boolean} open
 */
function setOpen(open) {
  const drawer = getDrawer();
  const backdrop = getBackdrop();
  if (!drawer) return;

  if (closeTimer != null) {
    window.clearTimeout(closeTimer);
    closeTimer = null;
  }

  document.querySelectorAll('[data-shop-overlay-trigger]').forEach((trigger) => {
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  if (open) {
    document.dispatchEvent(new CustomEvent('shop-overlay:open'));
    closeSearchModal();
    syncOverlayTop();
    observeHeaderStack(true);

    drawer.hidden = false;
    drawer.setAttribute('aria-hidden', 'false');
    lockScroll(drawer);
    if (backdrop) {
      backdrop.hidden = false;
      backdrop.setAttribute('aria-hidden', 'false');
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        drawer.classList.add('is-open');
        backdrop?.classList.add('is-visible');
      });
    });
    return;
  }

  drawer.classList.remove('is-open');
  drawer.setAttribute('aria-hidden', 'true');
  backdrop?.classList.remove('is-visible');
  backdrop?.setAttribute('aria-hidden', 'true');
  observeHeaderStack(false);
  unlockScroll(drawer);

  closeTimer = window.setTimeout(() => {
    drawer.hidden = true;
    if (backdrop) backdrop.hidden = true;
    closeTimer = null;
  }, FADE_MS);
}

function closeDrawer() {
  setOpen(false);
}

function toggleDrawer() {
  setOpen(!isOpen());
}

/**
 * @param {MouseEvent} event
 */
function handleDocumentClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const closeBtn = target.closest('[data-shop-overlay-close], [data-shop-overlay-backdrop]');
  if (closeBtn) {
    event.preventDefault();
    closeDrawer();
    return;
  }

  if (target.closest('.shop-overlay__link')) return;

  const trigger = target.closest('[data-shop-overlay-trigger]');
  if (trigger) {
    event.preventDefault();
    event.stopPropagation();
    toggleDrawer();
    return;
  }

  if (isOpen() && !target.closest('[data-shop-overlay]')) {
    closeDrawer();
  }
}

/**
 * @param {KeyboardEvent} event
 */
function handleKeydown(event) {
  if (event.key === 'Escape' && isOpen()) closeDrawer();
}

function init() {
  if (initialized || !getDrawer()) return;
  initialized = true;

  syncOverlayTop();
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('header-product-search:open', () => {
    if (isOpen()) closeDrawer();
  });

  const searchModal = document.getElementById('search-modal');
  searchModal?.addEventListener('dialog:open', () => {
    if (isOpen()) closeDrawer();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}

document.addEventListener('shopify:section:load', init);
