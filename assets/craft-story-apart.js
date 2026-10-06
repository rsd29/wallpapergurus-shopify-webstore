const root = document.querySelector('[data-apart-points]');

if (root) {
  const panels = [...root.querySelectorAll('details')];
  const hoverMedia = window.matchMedia('(hover: hover) and (min-width: 750px)');

  /**
   * @param {HTMLDetailsElement} target
   */
  function openPanel(target) {
    for (const panel of panels) {
      panel.open = panel === target;
    }
  }

  function bindHover() {
    for (const panel of panels) {
      panel.addEventListener('pointerenter', onPointerEnter);
    }
  }

  function unbindHover() {
    for (const panel of panels) {
      panel.removeEventListener('pointerenter', onPointerEnter);
    }
  }

  /**
   * @param {PointerEvent} event
   */
  function onPointerEnter(event) {
    const panel = event.currentTarget;
    if (panel instanceof HTMLDetailsElement) openPanel(panel);
  }

  root.addEventListener('toggle', (event) => {
    const panel = event.target;
    if (!(panel instanceof HTMLDetailsElement) || !panel.open) return;

    for (const other of panels) {
      if (other !== panel) other.open = false;
    }
  });

  if (hoverMedia.matches) bindHover();
  hoverMedia.addEventListener('change', (event) => {
    if (event.matches) bindHover();
    else unbindHover();
  });

  requestAnimationFrame(() => {
    root.setAttribute('data-apart-ready', '');
  });
}
