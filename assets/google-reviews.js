const DRAG_THRESHOLD = 6;

class GoogleReviews extends HTMLElement {
  /** @type {Array<RowState>} */
  #rows = [];
  #raf = 0;
  #last = 0;
  #resizeObserver = null;
  #reducedMotion = false;
  #designMode = false;
  #paused = false;
  #dragging = false;
  #lastWidth = 0;

  connectedCallback() {
    this.#reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.#designMode = Boolean(window.Shopify?.designMode);

    this.#bindUi();
    this.#setupRows();
    this.#measureOverflow();

    if (!this.#reducedMotion && !this.#designMode) {
      this.#last = performance.now();
      this.#raf = requestAnimationFrame(this.#tick);
    }

    const stage = this.querySelector('[data-review-stage]');
    this.#resizeObserver = new ResizeObserver(() => {
      const width = Math.round(stage instanceof HTMLElement ? stage.clientWidth : this.clientWidth);
      if (width === this.#lastWidth) return;
      this.#lastWidth = width;
      this.#setupRows();
      this.#measureOverflow();
    });
    this.#resizeObserver.observe(stage instanceof HTMLElement ? stage : this);
    this.#lastWidth = Math.round(stage instanceof HTMLElement ? stage.clientWidth : this.clientWidth);
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.#raf);
    this.#resizeObserver?.disconnect();
  }

  #bindUi() {
    const stage = this.querySelector('[data-review-stage]');

    this.addEventListener('click', (event) => {
      if (this.#dragging) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      const button = event.target instanceof Element ? event.target.closest('[data-review-more]') : null;
      if (!(button instanceof HTMLButtonElement)) return;

      const card = button.closest('[data-review]');
      if (!(card instanceof HTMLElement) || card.hasAttribute('data-clone')) return;

      const expanded = card.classList.toggle('is-expanded');
      button.textContent = expanded ? 'Less' : 'More';
      button.setAttribute('aria-expanded', String(expanded));
      this.#paused = this.#hasExpanded();
    });

    if (stage instanceof HTMLElement) {
      stage.addEventListener('pointerenter', () => {
        this.#paused = true;
      });
      stage.addEventListener('pointerleave', () => {
        this.#paused = this.#hasExpanded();
      });
    }
  }

  #hasExpanded() {
    return this.querySelectorAll('[data-review].is-expanded:not([data-clone])').length > 0;
  }

  #setupRows() {
    const previousOffsets = this.#rows.map((row) => row.offset);
    this.#rows = [];

    this.querySelectorAll('[data-review-row]').forEach((row, index) => {
      if (!(row instanceof HTMLElement)) return;
      const lane = row.querySelector('[data-review-lane]');
      if (!(lane instanceof HTMLElement)) return;

      this.#restoreOriginals(lane);
      if (!this.#reducedMotion && !this.#designMode) this.#fillLane(lane, row);

      const state = {
        row,
        lane,
        offset: previousOffsets[index] ?? 0,
        speed: Number(row.dataset.speed) || 0.04,
        direction: row.dataset.direction === 'right' ? -1 : 1,
        loopWidth: Math.max(lane.scrollWidth / 2, 1),
      };

      this.#wrapOffset(state);
      this.#apply(state);
      this.#bindDrag(row);
      this.#rows.push(state);
    });
  }

  /**
   * @param {HTMLElement} lane
   */
  #restoreOriginals(lane) {
    lane.querySelectorAll('[data-clone]').forEach((node) => node.remove());
    lane.querySelectorAll('[data-review]').forEach((card) => {
      card.removeAttribute('aria-hidden');
      if ('inert' in card) card.inert = false;
    });
  }

  /**
   * @param {HTMLElement} lane
   * @param {HTMLElement} row
   */
  #fillLane(lane, row) {
    const originals = [...lane.querySelectorAll('[data-review]:not([data-clone])')];
    if (originals.length === 0) return;

    const setWidth = this.#setWidth(lane);
    if (setWidth <= 0) return;

    const viewport = Math.max(row.clientWidth, 320);
    let width = setWidth;
    let copies = 1;

    while (width < viewport * 2 && copies < 8) {
      originals.forEach((card) => lane.append(this.#cloneCard(card)));
      width += setWidth;
      copies += 1;
    }

    [...lane.children].forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      lane.append(this.#cloneCard(node));
    });
  }

  /**
   * @param {Element} card
   */
  #cloneCard(card) {
    const clone = card.cloneNode(true);
    if (clone instanceof HTMLElement) {
      clone.setAttribute('data-clone', '');
      clone.setAttribute('aria-hidden', 'true');
      clone.removeAttribute('data-shopify-editor-block');
      if ('inert' in clone) clone.inert = true;
    }
    return clone;
  }

  /**
   * @param {HTMLElement} lane
   */
  #setWidth(lane) {
    const cards = [...lane.querySelectorAll('[data-review]:not([data-clone])')];
    const first = cards[0];
    const last = cards[cards.length - 1];
    if (!(first instanceof HTMLElement) || !(last instanceof HTMLElement)) return 0;
    const gap = Number.parseFloat(getComputedStyle(lane).gap) || 0;
    return last.offsetLeft + last.offsetWidth - first.offsetLeft + gap;
  }

  #measureOverflow() {
    const fontsReady = document.fonts?.ready ?? Promise.resolve();
    fontsReady.then(() => {
      requestAnimationFrame(() => {
        this.querySelectorAll('[data-review]:not([data-clone])').forEach((card) => {
          if (!(card instanceof HTMLElement)) return;
          const text = card.querySelector('[data-review-text]');
          const button = card.querySelector('[data-review-more]');
          if (!(text instanceof HTMLElement) || !(button instanceof HTMLButtonElement)) return;
          button.hidden = text.scrollHeight <= text.clientHeight + 8;
        });
      });
    });
  }

  /**
   * @param {HTMLElement} row
   */
  #bindDrag(row) {
    if (row.dataset.dragBound === 'true') return;
    row.dataset.dragBound = 'true';

    const stage = this.querySelector('[data-review-stage]');
    if (!(stage instanceof HTMLElement)) return;

    row.addEventListener('pointerdown', (event) => {
      if (this.#reducedMotion) return;
      if (event.target instanceof Element && event.target.closest('a, button')) return;
      const state = this.#stateFor(row);
      if (!state) return;
      state.pointerId = event.pointerId;
      state.startX = event.clientX;
      state.startOffset = state.offset;
      state.moved = false;
    });

    row.addEventListener('pointermove', (event) => {
      const state = this.#stateFor(row);
      if (!state || state.pointerId !== event.pointerId) return;
      const dx = event.clientX - state.startX;
      if (!state.moved && Math.abs(dx) < DRAG_THRESHOLD) return;
      if (!state.moved) {
        state.moved = true;
        this.#dragging = true;
        stage.classList.add('is-dragging');
        row.setPointerCapture(event.pointerId);
      }
      state.offset = state.startOffset - dx;
      this.#wrapOffset(state);
      this.#apply(state);
    });

    const endDrag = (event) => {
      const state = this.#stateFor(row);
      if (!state || state.pointerId !== event.pointerId) return;
      state.pointerId = null;
      if (state.moved) {
        window.setTimeout(() => {
          this.#dragging = false;
        }, 0);
      }
      state.moved = false;
      stage.classList.remove('is-dragging');
    };

    row.addEventListener('pointerup', endDrag);
    row.addEventListener('pointercancel', endDrag);
  }

  /**
   * @param {HTMLElement} row
   */
  #stateFor(row) {
    return this.#rows.find((state) => state.row === row) ?? null;
  }

  /**
   * @param {number} now
   */
  #tick = (now) => {
    const dt = Math.min(32, now - this.#last);
    this.#last = now;

    if (!this.#paused && !this.#dragging) {
      this.#rows.forEach((state) => {
        state.offset += state.speed * dt * state.direction;
        this.#wrapOffset(state);
        this.#apply(state);
      });
    }

    this.#raf = requestAnimationFrame(this.#tick);
  };

  /**
   * @param {RowState} state
   */
  #wrapOffset(state) {
    const loop = state.loopWidth;
    if (loop <= 0) return;
    state.offset = ((state.offset % loop) + loop) % loop;
  }

  /**
   * @param {RowState} state
   */
  #apply(state) {
    state.lane.style.transform = `translate3d(${-state.offset}px, 0, 0)`;
  }
}

/**
 * @typedef {object} RowState
 * @property {HTMLElement} row
 * @property {HTMLElement} lane
 * @property {number} offset
 * @property {number} speed
 * @property {number} direction
 * @property {number} loopWidth
 * @property {number} [pointerId]
 * @property {number} [startX]
 * @property {number} [startOffset]
 * @property {boolean} [moved]
 */

if (!customElements.get('google-reviews')) {
  customElements.define('google-reviews', GoogleReviews);
}
