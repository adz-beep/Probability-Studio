(() => {
  'use strict';

  const BLUE = '#1680ff';
  const TEAL = '#20dbc8';
  const GRID = 'rgba(151, 183, 207, 0.13)';
  const MUTED = '#89a2b8';
  const BACKDROP = 'rgba(22, 128, 255, 0.055)';

  function fitCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    const context = canvas.getContext('2d');
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { context, width, height };
  }

  function line(context, points, colour, width = 2) {
    if (!points.length) return;
    context.beginPath();
    context.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) context.lineTo(points[i][0], points[i][1]);
    context.strokeStyle = colour;
    context.lineWidth = width;
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.stroke();
  }

  function drawAxes(context, width, height, options = {}) {
    const pad = { left: 36, right: 12, top: 18, bottom: 34 };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    context.clearRect(0, 0, width, height);
    context.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.fillStyle = MUTED;
    context.textAlign = 'center';
    context.textBaseline = 'top';
    const ticks = options.ticks || [];
    ticks.forEach((tick) => {
      const x = pad.left + plotWidth * tick.position;
      context.beginPath();
      context.moveTo(x, pad.top);
      context.lineTo(x, pad.top + plotHeight);
      context.strokeStyle = GRID;
      context.lineWidth = 1;
      context.setLineDash([2, 6]);
      context.stroke();
      context.setLineDash([]);
      context.fillText(tick.label, x, pad.top + plotHeight + 9);
    });
    [0, .5, 1].forEach((fraction) => {
      const y = pad.top + plotHeight * (1 - fraction);
      context.beginPath();
      context.moveTo(pad.left, y);
      context.lineTo(pad.left + plotWidth, y);
      context.strokeStyle = GRID;
      context.setLineDash([2, 6]);
      context.stroke();
      context.setLineDash([]);
    });
    return { ...pad, plotWidth, plotHeight };
  }

  function normalPDF(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  function erf(x) {
    const sign = x < 0 ? -1 : 1;
    const value = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * value);
    const polynomial = (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
    return sign * (1 - polynomial * Math.exp(-value * value));
  }

  function normalCDF(x) {
    return 0.5 * (1 + erf(x / Math.sqrt(2)));
  }

  const normal = {
    canvas: document.querySelector('#normal-chart'),
    slider: document.querySelector('#normal-bound'),
    expression: document.querySelector('[data-normal-expression]'),
    result: document.querySelector('[data-normal-result]'),
    bound: document.querySelector('[data-normal-bound]'),
    tail: 'below'
  };

  function drawNormal() {
    if (!normal.canvas) return;
    const bound = Number(normal.slider.value);
    const { context, width, height } = fitCanvas(normal.canvas);
    const axes = drawAxes(context, width, height, {
      ticks: [-4, -2, 0, 2, 4].map((value) => ({ position: (value + 4) / 8, label: String(value) }))
    });
    const xToCanvas = (x) => axes.left + ((x + 4) / 8) * axes.plotWidth;
    const yToCanvas = (y) => axes.top + axes.plotHeight * (1 - y / .44);
    const samples = [];
    for (let i = 0; i <= 240; i += 1) {
      const x = -4 + (i / 240) * 8;
      samples.push([xToCanvas(x), yToCanvas(normalPDF(x)), x]);
    }

    context.beginPath();
    context.moveTo(axes.left, axes.top + axes.plotHeight);
    samples.forEach((point) => context.lineTo(point[0], point[1]));
    context.lineTo(axes.left + axes.plotWidth, axes.top + axes.plotHeight);
    context.closePath();
    context.fillStyle = BACKDROP;
    context.fill();

    const chosen = samples.filter((point) => normal.tail === 'below' ? point[2] <= bound : point[2] >= bound);
    if (chosen.length) {
      context.beginPath();
      context.moveTo(chosen[0][0], axes.top + axes.plotHeight);
      chosen.forEach((point) => context.lineTo(point[0], point[1]));
      context.lineTo(chosen[chosen.length - 1][0], axes.top + axes.plotHeight);
      context.closePath();
      const gradient = context.createLinearGradient(0, axes.top, 0, axes.top + axes.plotHeight);
      gradient.addColorStop(0, 'rgba(32, 219, 200, .52)');
      gradient.addColorStop(1, 'rgba(32, 219, 200, .12)');
      context.fillStyle = gradient;
      context.fill();
    }

    line(context, samples, BLUE, 2.5);
    line(context, chosen, TEAL, 3);
    const px = xToCanvas(bound);
    const py = yToCanvas(normalPDF(bound));
    context.beginPath();
    context.moveTo(px, py);
    context.lineTo(px, axes.top + axes.plotHeight);
    context.strokeStyle = 'rgba(184, 209, 227, .62)';
    context.setLineDash([5, 5]);
    context.stroke();
    context.setLineDash([]);
    context.beginPath();
    context.arc(px, py, 6, 0, Math.PI * 2);
    context.fillStyle = normal.tail === 'below' ? TEAL : BLUE;
    context.fill();
    context.strokeStyle = '#092033';
    context.lineWidth = 2;
    context.stroke();

    const probability = normal.tail === 'below' ? normalCDF(bound) : 1 - normalCDF(bound);
    normal.expression.textContent = `P(X ${normal.tail === 'below' ? '<' : '>'} ${bound.toFixed(2)})`;
    normal.result.textContent = probability.toFixed(4);
    normal.bound.textContent = bound.toFixed(2);
    normal.canvas.setAttribute('aria-label', `${normal.expression.textContent} equals ${probability.toFixed(4)}`);
  }

  function chooseNormalTail(tail) {
    normal.tail = tail;
    document.querySelectorAll('[data-normal-tail]').forEach((button) => {
      const active = button.dataset.normalTail === tail;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    drawNormal();
  }

  function binomialPMF(k, n = 20, p = .5) {
    let combination = 1;
    for (let i = 1; i <= k; i += 1) combination *= (n - i + 1) / i;
    return combination * Math.pow(p, k) * Math.pow(1 - p, n - k);
  }

  const binomial = {
    canvas: document.querySelector('#binomial-chart'),
    slider: document.querySelector('#binomial-value'),
    expression: document.querySelector('[data-binomial-expression]'),
    result: document.querySelector('[data-binomial-result]'),
    value: document.querySelector('[data-binomial-value]'),
    mode: 'exact'
  };

  function binomialSelected(index, k) {
    if (binomial.mode === 'below') return index <= k;
    if (binomial.mode === 'above') return index >= k;
    return index === k;
  }

  function drawBinomial() {
    if (!binomial.canvas) return;
    const selectedValue = Number(binomial.slider.value);
    const probabilities = Array.from({ length: 21 }, (_, k) => binomialPMF(k));
    const { context, width, height } = fitCanvas(binomial.canvas);
    const axes = drawAxes(context, width, height, {
      ticks: [0, 5, 10, 15, 20].map((value) => ({ position: value / 20, label: String(value) }))
    });
    const slot = axes.plotWidth / 21;
    const max = .2;
    probabilities.forEach((probability, k) => {
      const barHeight = axes.plotHeight * probability / max;
      const x = axes.left + slot * k + slot * .14;
      const y = axes.top + axes.plotHeight - barHeight;
      const selected = binomialSelected(k, selectedValue);
      const gradient = context.createLinearGradient(0, y, 0, axes.top + axes.plotHeight);
      gradient.addColorStop(0, selected ? 'rgba(32, 219, 200, .84)' : 'rgba(22, 128, 255, .82)');
      gradient.addColorStop(1, selected ? 'rgba(32, 219, 200, .24)' : 'rgba(22, 128, 255, .18)');
      context.fillStyle = gradient;
      context.fillRect(x, y, slot * .72, barHeight);
      context.strokeStyle = selected ? TEAL : BLUE;
      context.strokeRect(x, y, slot * .72, barHeight);
    });
    let probability = 0;
    probabilities.forEach((value, k) => { if (binomialSelected(k, selectedValue)) probability += value; });
    const symbol = binomial.mode === 'below' ? '≤' : binomial.mode === 'above' ? '≥' : '=';
    binomial.expression.textContent = `P(X ${symbol} ${selectedValue})`;
    binomial.result.textContent = probability.toFixed(4);
    binomial.value.textContent = String(selectedValue);
    binomial.canvas.setAttribute('aria-label', `${binomial.expression.textContent} equals ${probability.toFixed(4)}`);
  }

  function chooseBinomialMode(mode) {
    binomial.mode = mode;
    document.querySelectorAll('[data-binomial-mode]').forEach((button) => {
      const active = button.dataset.binomialMode === mode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    drawBinomial();
  }

  function bindCanvasValue(canvas, slider, minimum, maximum, redraw) {
    if (!canvas || !slider) return;
    const update = (event) => {
      const rect = canvas.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left - 36) / Math.max(1, rect.width - 48)));
      const raw = minimum + fraction * (maximum - minimum);
      const step = Number(slider.step || 1);
      slider.value = String(Math.round(raw / step) * step);
      redraw();
    };
    canvas.addEventListener('pointerdown', (event) => {
      canvas.setPointerCapture(event.pointerId);
      update(event);
    });
    canvas.addEventListener('pointermove', (event) => { if (canvas.hasPointerCapture(event.pointerId)) update(event); });
  }

  const live = {
    canvas: document.querySelector('#live-chart'),
    count: document.querySelector('[data-live-count]'),
    mean: document.querySelector('[data-live-mean]'),
    toggle: document.querySelector('[data-live-toggle]'),
    reset: document.querySelector('[data-live-reset]'),
    samples: [],
    running: true,
    lastAdded: 0,
    visible: true
  };

  function randomNormal() {
    const a = Math.max(Number.EPSILON, Math.random());
    const b = Math.random();
    return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b);
  }

  function drawLive() {
    if (!live.canvas) return;
    const { context, width, height } = fitCanvas(live.canvas);
    const axes = drawAxes(context, width, height, {
      ticks: [-3, -2, -1, 0, 1, 2, 3].map((value) => ({ position: (value + 3.5) / 7, label: String(value) }))
    });
    const bins = 28;
    const counts = Array(bins).fill(0);
    live.samples.forEach((sample) => {
      const index = Math.floor(((sample + 3.5) / 7) * bins);
      if (index >= 0 && index < bins) counts[index] += 1;
    });
    const maxCount = Math.max(8, ...counts);
    const slot = axes.plotWidth / bins;
    counts.forEach((count, index) => {
      const heightFraction = count / (maxCount * 1.16);
      const barHeight = axes.plotHeight * heightFraction;
      const gradient = context.createLinearGradient(0, axes.top + axes.plotHeight - barHeight, 0, axes.top + axes.plotHeight);
      gradient.addColorStop(0, index >= bins / 2 ? 'rgba(32,219,200,.78)' : 'rgba(22,128,255,.76)');
      gradient.addColorStop(1, index >= bins / 2 ? 'rgba(32,219,200,.12)' : 'rgba(22,128,255,.12)');
      context.fillStyle = gradient;
      context.fillRect(axes.left + index * slot + 1, axes.top + axes.plotHeight - barHeight, Math.max(2, slot - 3), barHeight);
    });
    const curve = [];
    for (let i = 0; i <= 180; i += 1) {
      const x = -3.5 + (i / 180) * 7;
      const px = axes.left + (i / 180) * axes.plotWidth;
      const py = axes.top + axes.plotHeight * (1 - normalPDF(x) / .46);
      curve.push([px, py]);
    }
    line(context, curve, BLUE, 2.25);
    if (live.samples.length) {
      const last = live.samples[live.samples.length - 1];
      const px = axes.left + ((last + 3.5) / 7) * axes.plotWidth;
      context.beginPath();
      context.arc(Math.max(axes.left, Math.min(axes.left + axes.plotWidth, px)), axes.top + 12, 5, 0, Math.PI * 2);
      context.fillStyle = last >= 0 ? TEAL : BLUE;
      context.fill();
    }
    const mean = live.samples.length ? live.samples.reduce((total, value) => total + value, 0) / live.samples.length : null;
    live.count.textContent = String(live.samples.length);
    live.mean.textContent = mean === null ? '—' : mean.toFixed(2);
    live.canvas.setAttribute('aria-label', `Live sample with ${live.samples.length} observations${mean === null ? '' : ` and mean ${mean.toFixed(2)}`}`);
  }

  function animateLive(timestamp) {
    if (live.running && live.visible && timestamp - live.lastAdded > 95) {
      live.samples.push(randomNormal());
      if (live.samples.length > 400) live.samples.shift();
      live.lastAdded = timestamp;
      drawLive();
    }
    window.requestAnimationFrame(animateLive);
  }

  document.querySelectorAll('[data-theme-compare]').forEach((comparison) => {
    const range = comparison.querySelector('.compare-range');
    range.addEventListener('input', () => comparison.style.setProperty('--split', `${range.value}%`));
  });

  normal.slider?.addEventListener('input', drawNormal);
  document.querySelectorAll('[data-normal-tail]').forEach((button) => button.addEventListener('click', () => chooseNormalTail(button.dataset.normalTail)));
  binomial.slider?.addEventListener('input', drawBinomial);
  document.querySelectorAll('[data-binomial-mode]').forEach((button) => button.addEventListener('click', () => chooseBinomialMode(button.dataset.binomialMode)));
  bindCanvasValue(normal.canvas, normal.slider, -3, 3, drawNormal);
  bindCanvasValue(binomial.canvas, binomial.slider, 0, 20, drawBinomial);

  live.toggle?.addEventListener('click', () => {
    live.running = !live.running;
    live.toggle.textContent = live.running ? 'Pause' : 'Resume';
  });
  live.reset?.addEventListener('click', () => {
    live.samples = [];
    live.lastAdded = 0;
    drawLive();
  });

  if ('IntersectionObserver' in window && live.canvas) {
    new IntersectionObserver((entries) => { live.visible = entries[0]?.isIntersecting ?? true; }, { threshold: .05 }).observe(live.canvas);
  }

  const redraw = () => { drawNormal(); drawBinomial(); drawLive(); };
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(redraw);
    [normal.canvas, binomial.canvas, live.canvas].filter(Boolean).forEach((canvas) => observer.observe(canvas));
  } else {
    window.addEventListener('resize', redraw);
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    live.running = false;
    if (live.toggle) live.toggle.textContent = 'Resume';
    for (let i = 0; i < 90; i += 1) live.samples.push(randomNormal());
  }
  redraw();
  window.requestAnimationFrame(animateLive);
})();
