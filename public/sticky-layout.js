const STICKY_HEADER_SCROLL_THRESHOLD = 72;
const STICKY_HEADER_HEIGHT_PROPERTY = '--page-header-sticky-height';
const EXCLUDED_STICKY_VIEW_IDS = new Set([
  'access-denied',
  'buat-nota-dinas',
  'kirim-surat-penawaran',
  'kirim-surat-konfirmasi',
]);

export function initialiseStickyLayout(views) {
  const eligibleViews = [...views].filter((view) => !EXCLUDED_STICKY_VIEW_IDS.has(view.id));
  const headers = new Map();
  let activeTableWrap = null;
  let overlay = null;
  let overlayTable = null;
  let overlayHead = null;
  let scrollFrame = null;
  let measureOverlay = true;

  eligibleViews.forEach((view) => {
    const header = view.querySelector(':scope > .page-header, :scope > .panel-heading');
    if (header) {
      header.classList.add('view-sticky-header');
      headers.set(view, header);
    }
  });

  const activeView = () => eligibleViews.find((view) => !view.hidden) || null;

  const removeOverlay = () => {
    overlay?.remove();
    overlay = null;
    overlayTable = null;
    overlayHead = null;
    activeTableWrap = null;
  };

  const setStyle = (element, property, value) => {
    if (element.style[property] !== value) element.style[property] = value;
  };

  const stripIds = (node) => {
    if (node.id) node.removeAttribute('id');
    node.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
  };

  const createOverlay = (tableWrap, table) => {
    removeOverlay();
    overlay = document.createElement('div');
    overlay.className = 'sticky-table-header-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlayTable = table.cloneNode(false);
    overlayTable.removeAttribute('id');
    overlayHead = table.tHead.cloneNode(true);
    stripIds(overlayHead);
    overlayTable.append(overlayHead);
    overlay.append(overlayTable);
    overlay.addEventListener('click', (event) => {
      const clickedHeader = event.target.closest('th[data-sort-key]');
      if (!clickedHeader || !activeTableWrap) return;
      const sourceHeader = [...activeTableWrap.querySelectorAll('thead th[data-sort-key]')]
        .find((header) => header.dataset.sortKey === clickedHeader.dataset.sortKey);
      sourceHeader?.click();
    });
    document.body.append(overlay);
    activeTableWrap = tableWrap;
  };

  const copyHeaderContent = (table) => {
    if (!overlay || !table.tHead) return;
    const nextHead = table.tHead.cloneNode(true);
    stripIds(nextHead);
    overlayHead.replaceWith(nextHead);
    overlayHead = nextHead;
  };

  const setStickyHeaderHeight = (header) => {
    const root = document.documentElement;
    const rect = header?.getBoundingClientRect();
    const height = header?.classList.contains('is-compact') && Math.abs(rect.top) <= 1
      ? `${Math.ceil(rect.height)}px`
      : '0px';
    if (root.style.getPropertyValue(STICKY_HEADER_HEIGHT_PROPERTY) !== height) {
      root.style.setProperty(STICKY_HEADER_HEIGHT_PROPERTY, height);
    }
    return Number.parseFloat(height) || 0;
  };

  const updateOverlay = (tableWrap, table, top, headHeight, measure) => {
    const isNewTable = activeTableWrap !== tableWrap || !overlay;
    if (isNewTable) createOverlay(tableWrap, table);
    else if (overlayTable.className !== table.className) overlayTable.className = table.className;

    const wrapRect = tableWrap.getBoundingClientRect();
    const left = wrapRect.left + tableWrap.clientLeft;
    const width = tableWrap.clientWidth;
    setStyle(overlay, 'left', `${left}px`);
    setStyle(overlay, 'top', `${top}px`);
    setStyle(overlay, 'width', `${width}px`);
    setStyle(overlay, 'height', `${headHeight}px`);
    setStyle(overlayTable, 'transform', `translateX(-${tableWrap.scrollLeft}px)`);

    if (isNewTable || measure) {
      const tableWidth = Math.max(table.getBoundingClientRect().width, table.scrollWidth);
      setStyle(overlayTable, 'width', `${tableWidth}px`);
      setStyle(overlayTable, 'minWidth', `${tableWidth}px`);

      const sourceHeaders = table.tHead.querySelectorAll('th');
      const overlayHeaders = overlayHead.querySelectorAll('th');
      sourceHeaders.forEach((sourceHeader, index) => {
        if (overlayHeaders[index]) {
          setStyle(overlayHeaders[index], 'width', `${sourceHeader.getBoundingClientRect().width}px`);
        }
      });
    }
  };

  const update = () => {
    const shouldMeasureOverlay = measureOverlay;
    measureOverlay = false;
    const view = activeView();
    const activeHeader = view ? headers.get(view) : null;
    const compact = window.scrollY > STICKY_HEADER_SCROLL_THRESHOLD;
    headers.forEach((header, owner) => {
      const shouldCompact = owner === view && compact;
      if (header.classList.contains('is-compact') !== shouldCompact) {
        header.classList.toggle('is-compact', shouldCompact);
      }
    });

    const headerHeight = setStickyHeaderHeight(activeHeader);
    if (!view || EXCLUDED_STICKY_VIEW_IDS.has(view.id)) {
      removeOverlay();
      return;
    }

    let candidate = null;
    let candidateTable = null;
    let candidateHeadHeight = 0;
    view.querySelectorAll('.table-wrap').forEach((tableWrap) => {
      const table = tableWrap.querySelector('table');
      const head = table?.tHead;
      if (!table || !head || !tableWrap.clientWidth) return;

      const headRect = head.getBoundingClientRect();
      const tableRect = table.getBoundingClientRect();
      if (headRect.top < headerHeight && tableRect.bottom > headerHeight + headRect.height) {
        candidate = tableWrap;
        candidateTable = table;
        candidateHeadHeight = headRect.height;
      }
    });

    if (candidate) updateOverlay(candidate, candidateTable, headerHeight, candidateHeadHeight, shouldMeasureOverlay);
    else removeOverlay();
  };

  const scheduleUpdate = (measure = false) => {
    measureOverlay ||= measure;
    if (scrollFrame !== null) return;
    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = null;
      update();
    });
  };

  const resizeObserver = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => scheduleUpdate(true))
    : null;
  eligibleViews.forEach((view) => {
    if (resizeObserver) {
      const header = headers.get(view);
      if (header) resizeObserver.observe(header);
      view.querySelectorAll('.table-wrap').forEach((tableWrap) => resizeObserver.observe(tableWrap));
    }
  });

  const mutationObserver = typeof MutationObserver === 'function'
    ? new MutationObserver((records) => {
      if (overlay && activeTableWrap && records.some((record) => (
        record.target === activeTableWrap
        || activeTableWrap.contains(record.target)
      ))) {
        const table = activeTableWrap.querySelector('table');
        if (table) copyHeaderContent(table);
      }
      if (resizeObserver) {
        records.forEach((record) => {
          record.addedNodes.forEach((node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            if (node.matches?.('.table-wrap')) resizeObserver.observe(node);
            node.querySelectorAll?.('.table-wrap').forEach((tableWrap) => resizeObserver.observe(tableWrap));
          });
        });
      }
      scheduleUpdate(true);
    })
    : null;
  eligibleViews.forEach((view) => mutationObserver?.observe(view, {
    attributes: true,
    childList: true,
    subtree: true,
  }));

  const handleResize = () => scheduleUpdate(true);
  const handleScroll = () => scheduleUpdate();
  const handleHashChange = () => scheduleUpdate(true);
  window.addEventListener('scroll', handleScroll, { passive: true });
  document.addEventListener('scroll', handleScroll, true);
  window.addEventListener('resize', handleResize, { passive: true });
  window.addEventListener('hashchange', handleHashChange);
  update();

  return {
    refresh: () => scheduleUpdate(true),
    destroy() {
      if (scrollFrame !== null) window.cancelAnimationFrame(scrollFrame);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('hashchange', handleHashChange);
      eligibleViews.forEach((view) => headers.get(view)?.classList.remove('view-sticky-header', 'is-compact'));
      document.documentElement.style.removeProperty(STICKY_HEADER_HEIGHT_PROPERTY);
      removeOverlay();
    },
  };
}
