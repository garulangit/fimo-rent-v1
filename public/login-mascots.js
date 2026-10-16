const stage = document.querySelector('[data-mascot-stage]');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#password');
const toggleButton = document.querySelector('#togglePassword');

if (stage && emailInput && passwordInput && toggleButton) {
  const abort = new AbortController();
  const { signal } = abort;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mascots = Array.from(stage.querySelectorAll('[data-mascot]'), (element, index) => {
    const mascot = {
      element,
      attentive: element.hasAttribute('data-attentive'),
      mouth: element.querySelector('.mascot__mouth'),
      eyes: [],
    };
    mascot.eyes = Array.from(element.querySelectorAll('.eye'), (node) => {
      const sclera = node.querySelector('.eye__sclera');
      const pupil = node.querySelector('.eye__pupil');
      const scleraRadius = Number.parseFloat(sclera.getAttribute('r'));
      const pupilRadius = Number.parseFloat(pupil.firstElementChild.getAttribute('r'));
      return {
        mascot,
        node,
        sclera,
        pupil,
        maxOffset: scleraRadius - pupilRadius - 0.9,
        smoothing: 70 + index * 14,
        centerX: 0,
        centerY: 0,
        x: 0,
        y: 0,
        targetX: 0,
        targetY: 0,
      };
    });
    return mascot;
  });
  const eyes = mascots.flatMap((mascot) => mascot.eyes);
  const pointer = { x: 0, y: 0, active: false };
  const state = {
    focus: null,
    glancing: false,
    passwordTyping: passwordInput.value.length > 0,
    passwordVisible: passwordInput.type === 'text',
    authState: null,
    centersStale: true,
    targetsStale: true,
    lastFrameTime: 0,
    frameId: 0,
    blinkTimer: 0,
    blinkEndTimer: 0,
    glanceTimer: 0,
    startleTimer: 0,
  };

  function measureEyeCenters() {
    if (!state.centersStale) return;
    for (const eye of eyes) {
      const rect = eye.sclera.getBoundingClientRect();
      eye.centerX = rect.left + rect.width / 2;
      eye.centerY = rect.top + rect.height / 2;
    }
    state.centersStale = false;
  }

  function setTarget(eye, x, y) {
    const length = Math.hypot(x, y);
    const scale = length > 1 ? 1 / length : 1;
    eye.targetX = x * scale * eye.maxOffset;
    eye.targetY = y * scale * eye.maxOffset;
  }

  function aimAt(eye, point) {
    const dx = point.x - eye.centerX;
    const dy = point.y - eye.centerY;
    const distance = Math.hypot(dx, dy);
    if (distance < 1) {
      setTarget(eye, 0, 0);
      return;
    }
    const reach = Math.min(1, distance / 140);
    setTarget(eye, (dx / distance) * reach, (dy / distance) * reach);
  }

  function gazeMode() {
    if (state.authState) return state.authState;
    if (state.glancing || state.passwordTyping) return 'away';
    if (state.focus === 'email') return 'email';
    return pointer.active ? 'pointer' : 'idle';
  }

  function computeTargets() {
    measureEyeCenters();
    switch (gazeMode()) {
      case 'away':
        for (const eye of eyes) {
          if (state.passwordTyping && eye.mascot.element.hasAttribute('data-password-lookaway')) {
            const direction = eye.mascot.element.classList.contains('mascot--tall') ? -0.78 : 0.78;
            setTarget(eye, direction, -0.62);
          } else {
            setTarget(eye, -0.85, 0.4);
          }
        }
        break;
      case 'email': {
        const rect = emailInput.getBoundingClientRect();
        const centerY = rect.top + rect.height / 2;
        const fieldCenter = { x: rect.left + rect.width / 2, y: centerY };
        const caret = {
          x: Math.min(rect.right - 20, rect.left + 18 + emailInput.value.length * 7),
          y: centerY,
        };
        for (const eye of eyes) aimAt(eye, eye.mascot.attentive ? caret : fieldCenter);
        break;
      }
      case 'waiting':
        for (const eye of eyes) setTarget(eye, 0, 0);
        break;
      case 'success':
        for (const eye of eyes) setTarget(eye, 0, -0.2);
        break;
      case 'failure':
        for (const eye of eyes) setTarget(eye, -0.2, 0);
        break;
      case 'pointer':
        for (const eye of eyes) aimAt(eye, pointer);
        break;
      default:
        for (const eye of eyes) setTarget(eye, 0.4, 0.1);
    }
  }

  function tick(time) {
    state.frameId = 0;
    if (state.targetsStale) {
      computeTargets();
      state.targetsStale = false;
    }
    const dt = state.lastFrameTime ? Math.min(time - state.lastFrameTime, 64) : 16;
    state.lastFrameTime = time;
    const instant = reduceMotion.matches;
    let moving = false;
    for (const eye of eyes) {
      const factor = instant ? 1 : 1 - Math.exp(-dt / eye.smoothing);
      eye.x += (eye.targetX - eye.x) * factor;
      eye.y += (eye.targetY - eye.y) * factor;
      if (Math.abs(eye.targetX - eye.x) > 0.01 || Math.abs(eye.targetY - eye.y) > 0.01) {
        moving = true;
      } else {
        eye.x = eye.targetX;
        eye.y = eye.targetY;
      }
      eye.pupil.setAttribute('transform', `translate(${eye.x.toFixed(2)} ${eye.y.toFixed(2)})`);
    }
    if (moving) {
      state.frameId = requestAnimationFrame(tick);
    } else {
      state.lastFrameTime = 0;
    }
  }

  function requestFrame() {
    if (!state.frameId && !document.hidden) state.frameId = requestAnimationFrame(tick);
  }

  function invalidateTargets() {
    state.targetsStale = true;
    requestFrame();
  }

  function invalidateLayout() {
    state.centersStale = true;
    invalidateTargets();
  }

  function setExpression(name) {
    stage.dataset.expression = name;
    for (const mascot of mascots) {
      const mouthPath = name === 'password-typing' && mascot.element.hasAttribute('data-password-lookaway')
        ? mascot.mouth.dataset.whistle
        : mascot.mouth.dataset[name] || mascot.mouth.dataset.neutral;
      mascot.mouth.setAttribute('d', mouthPath);
    }
  }

  function updatePasswordExpression() {
    if (state.glancing) setExpression('shy');
    else setExpression(state.passwordTyping ? 'password-typing' : 'neutral');
  }

  function startle() {
    if (reduceMotion.matches) return;
    window.clearTimeout(state.startleTimer);
    stage.classList.remove('is-startled');
    void stage.getBoundingClientRect();
    stage.classList.add('is-startled');
    state.startleTimer = window.setTimeout(() => stage.classList.remove('is-startled'), 900);
  }

  function clearBlinkClasses() {
    for (const eye of eyes) eye.node.classList.remove('is-blinking');
  }

  function blink() {
    const group = Math.random() < 0.25
      ? mascots
      : [mascots[Math.floor(Math.random() * mascots.length)]];
    for (const mascot of group) {
      for (const eye of mascot.eyes) eye.node.classList.add('is-blinking');
    }
    window.clearTimeout(state.blinkEndTimer);
    state.blinkEndTimer = window.setTimeout(() => {
      for (const mascot of group) {
        for (const eye of mascot.eyes) eye.node.classList.remove('is-blinking');
      }
    }, 130);
  }

  function scheduleBlink() {
    window.clearTimeout(state.blinkTimer);
    if (reduceMotion.matches || document.hidden) return;
    state.blinkTimer = window.setTimeout(() => {
      blink();
      scheduleBlink();
    }, 2400 + Math.random() * 4200);
  }

  window.addEventListener('pointermove', (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
    invalidateTargets();
  }, { passive: true, signal });
  document.documentElement.addEventListener('pointerleave', () => {
    pointer.active = false;
    invalidateTargets();
  }, { signal });
  window.addEventListener('resize', invalidateLayout, { passive: true, signal });
  window.addEventListener('scroll', invalidateLayout, { passive: true, signal });

  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(invalidateLayout) : null;
  if (resizeObserver) resizeObserver.observe(stage);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      window.clearTimeout(state.blinkTimer);
      clearBlinkClasses();
    } else {
      scheduleBlink();
      invalidateLayout();
    }
  }, { signal });

  reduceMotion.addEventListener('change', () => {
    if (reduceMotion.matches) {
      window.clearTimeout(state.blinkTimer);
      clearBlinkClasses();
    } else {
      scheduleBlink();
    }
    invalidateTargets();
  }, { signal });

  emailInput.addEventListener('focus', () => {
    state.focus = 'email';
    invalidateTargets();
  }, { signal });
  emailInput.addEventListener('blur', () => {
    state.focus = null;
    invalidateTargets();
  }, { signal });
  emailInput.addEventListener('input', invalidateTargets, { signal });
  passwordInput.addEventListener('focus', () => {
    state.passwordTyping = passwordInput.value.length > 0;
    updatePasswordExpression();
    invalidateTargets();
  }, { signal });
  passwordInput.addEventListener('input', () => {
    state.passwordTyping = passwordInput.value.length > 0;
    updatePasswordExpression();
    invalidateTargets();
  }, { signal });
  passwordInput.addEventListener('blur', () => {
    state.passwordTyping = false;
    updatePasswordExpression();
    invalidateTargets();
  }, { signal });

  toggleButton.addEventListener('click', () => {
    state.passwordVisible = passwordInput.type === 'password';
    passwordInput.type = state.passwordVisible ? 'text' : 'password';
    toggleButton.setAttribute('aria-pressed', String(state.passwordVisible));
    toggleButton.setAttribute(
      'aria-label',
      state.passwordVisible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi',
    );
    window.clearTimeout(state.glanceTimer);
    state.glancing = state.passwordVisible;
    updatePasswordExpression();
    if (state.passwordVisible) {
      startle();
      state.glanceTimer = window.setTimeout(() => {
        state.glancing = false;
        updatePasswordExpression();
        invalidateTargets();
      }, 1800);
    }
    invalidateTargets();
    passwordInput.focus();
  }, { signal });

  window.addEventListener('login-visual-state', (event) => {
    state.authState = ['waiting', 'success', 'failure'].includes(event.detail?.state)
      ? event.detail.state
      : null;
    invalidateTargets();
  }, { signal });
  window.addEventListener('pagehide', () => {
    abort.abort();
    if (resizeObserver) resizeObserver.disconnect();
    cancelAnimationFrame(state.frameId);
    window.clearTimeout(state.blinkTimer);
    window.clearTimeout(state.blinkEndTimer);
    window.clearTimeout(state.glanceTimer);
    window.clearTimeout(state.startleTimer);
  }, { once: true, signal });

  setExpression('neutral');
  scheduleBlink();
  invalidateLayout();
}
