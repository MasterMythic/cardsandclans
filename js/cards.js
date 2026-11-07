/* Cards & Clans — live card component.
 * A browser port of the game's CardView + CardFace shader behaviour:
 *  - spring-followed tilt toward the cursor (11° / 13°), sway while dragged
 *  - art parallax against the frame (0.04 of the card while hovered)
 *  - holographic foil and twinkles on the frame's metal, iridescent art foil on commanders
 *  - specular sweep when the cursor arrives, repeating every 1.8 s while hovered
 *  - flowing energy rim in the army colour, flip to the army's card back
 *  - hex "digitise" dissolve and materialise (deaths and summons)
 */
(function () {
  'use strict';
  const D = window.CC_DATA;
  const IMG = 'assets/img/';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const FACTION_COLOR = Object.fromEntries(D.armies.map((a) => [a.id, a.color]));
  const BACKS = new Set(D.armies.map((a) => a.id));

  const damp = (sharp, dt) => 1 - Math.exp(-sharp * dt);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const live = new Set();
  let raf = 0, last = 0;

  function frameKind(c) { return c.commander ? 'champion' : c.type === 'Spell' ? 'spell' : 'unit'; }

  function keywordLine(c) {
    // keywords the card text already spells out (CantBlock -> "Can't block.") are not repeated
    const kws = (c.keywords || []).filter((k) => k !== 'Commander' && k !== 'CantBlock');
    return kws.join(' · ');
  }

  /** Build a card element. opts: {size:'hand'|'board'|'big', foil:0..1, flippable} */
  function create(id, opts = {}) {
    const c = D.cards[id];
    if (!c) throw new Error('unknown card ' + id);
    const kind = frameKind(c);
    const el = document.createElement('div');
    el.className = 'cc-card cc-card--' + kind;
    el.dataset.card = id;
    el.style.setProperty('--army', FACTION_COLOR[c.faction] || '#e3bd72');
    const type = c.type === 'Spell' ? 'Spell' : (c.commander ? 'Commander' : 'Unit') + (c.subtype && !c.commander ? ' · ' + c.subtype : '');
    const stats = c.type === 'Spell' ? '' :
      `<span class="cc-card__power" data-stat="power"><b>${c.power}</b></span><span class="cc-card__health" data-stat="health"><b>${c.health}</b></span>`;
    const text = [keywordLine(c), c.text].filter(Boolean).join('. ');
    el.innerHTML =
      `<div class="cc-card__pivot">` +
        `<div class="cc-card__face">` +
          `<div class="cc-card__art"><img src="${IMG}art-${id}.webp" alt="" draggable="false"></div>` +
          `<img class="cc-card__frame" src="${IMG}frame-${c.faction}-${kind}.webp" alt="" draggable="false">` +
          `<div class="cc-card__foil"></div>` +
          `<div class="cc-card__shine"></div>` +
          `<span class="cc-card__cost"><b>${c.cost}</b></span>` +
          `<span class="cc-card__name">${c.name}</span>` +
          `<span class="cc-card__type">${type}</span>` +
          `<span class="cc-card__text">${text || ''}</span>` +
          stats +
          `<span class="cc-card__rim"></span>` +
        `</div>` +
        (BACKS.has(c.faction) ? `<div class="cc-card__back"><img src="${IMG}back-${c.faction}.webp" alt="" draggable="false"></div>` : '') +
      `</div>`;
    el.setAttribute('aria-label', describe(c));
    // set through the CSSOM (not style="" attributes) so the page's strict CSP allows it
    el.querySelector('.cc-card__foil').style.setProperty('--mask', `url(${IMG}frame-${c.faction}-${kind}.webp)`);
    el.querySelector('.cc-card__name').style.setProperty('--nl', String(Math.max(12, c.name.length)));
    const st = {
      el, id, tilt: [0, 0], target: [0, 0], vel: [0, 0], hover: false, drag: false,
      flip: 0, faceUp: true, shine: -1, shineAmt: 0, shineWait: 0, foil: opts.foil ?? (c.commander ? 1 : 0.55),
      artFoil: c.commander ? 1 : 0,
    };
    el._cc = st;
    el.style.setProperty('--foil', st.foil);
    el.style.setProperty('--artfoil', st.artFoil);
    if (opts.interactive !== false) bindHover(el);
    return el;
  }

  function describe(c) {
    const bits = [c.name, c.type === 'Spell' ? 'spell' : c.commander ? 'commander' : 'unit', `cost ${c.cost}`];
    if (c.type !== 'Spell') bits.push(`${c.power} attack, ${c.health} health`);
    const kw = keywordLine(c); if (kw) bits.push(kw);
    if (c.text) bits.push(c.text);
    return bits.join(', ');
  }

  function bindHover(el) {
    const st = el._cc;
    el.addEventListener('pointerenter', () => { st.hover = true; startShine(st); wake(st); });
    el.addEventListener('pointerleave', () => { st.hover = false; st.target = [0, 0]; wake(st); });
    el.addEventListener('pointermove', (e) => {
      if (st.drag) return;
      const r = el.getBoundingClientRect();
      st.target = [clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1), clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1)];
      wake(st);
    });
    el.addEventListener('focus', () => { st.hover = true; st.target = [0.35, -0.25]; startShine(st); wake(st); });
    el.addEventListener('blur', () => { st.hover = false; st.target = [0, 0]; wake(st); });
  }

  function startShine(st) { if (reduce.matches) return; st.shine = -0.4; st.shineAmt = 1.6; st.shineWait = 0; }

  function wake(st) { live.add(st); if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }

  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    for (const st of live) {
      const k = reduce.matches ? 1 : damp(10, dt);
      const tx = st.target[0] + st.vel[0], ty = st.target[1] + st.vel[1];
      st.tilt[0] += (tx - st.tilt[0]) * k; st.tilt[1] += (ty - st.tilt[1]) * k;
      st.vel[0] *= 1 - damp(6, dt); st.vel[1] *= 1 - damp(6, dt);
      const fT = st.faceUp ? 0 : 180;
      st.flip = reduce.matches ? fT : st.flip + clamp(fT - st.flip, -720 * dt, 720 * dt);
      if (st.shine > -0.5) { st.shine += dt * 2.4; if (st.shine > 2.2) { st.shine = -1; st.shineWait = 1.8; } }
      else if (st.hover && !reduce.matches) { st.shineWait -= dt; if (st.shineWait <= 0) { st.shine = -0.4; st.shineAmt = 1.1; } }
      const s = st.el.style;
      const scale = reduce.matches ? 0.35 : 1;
      s.setProperty('--tx', (st.tilt[0] * scale).toFixed(4));
      s.setProperty('--ty', (st.tilt[1] * scale).toFixed(4));
      s.setProperty('--flip', st.flip.toFixed(2) + 'deg');
      s.setProperty('--shine', st.shine.toFixed(4));
      s.setProperty('--shineamt', st.shineAmt.toFixed(3));
      const mag = Math.hypot(st.tilt[0], st.tilt[1]);
      s.setProperty('--foilk', (st.foil * (0.55 + 0.45 * clamp(mag * 1.5 + (st.hover ? 0.5 : 0), 0, 1))).toFixed(3));
      st.el.classList.toggle('is-back', Math.abs(st.flip) > 90);
      const settled = !st.hover && !st.drag && mag < 0.002 && Math.abs(st.flip - fT) < 0.01 && st.shine <= -0.5 &&
        Math.abs(st.vel[0]) + Math.abs(st.vel[1]) < 0.001;
      if (settled) live.delete(st);
    }
    raf = live.size ? requestAnimationFrame(tick) : 0;
  }

  /** Pointer-drag rotation (inspect stage). */
  function makeDraggable(el) {
    const st = el._cc; let sx = 0, sy = 0, base = [0, 0];
    el.addEventListener('pointerdown', (e) => {
      st.drag = true; sx = e.clientX; sy = e.clientY; base = st.tilt.slice();
      el.setPointerCapture(e.pointerId); wake(st);
    });
    el.addEventListener('pointermove', (e) => {
      if (!st.drag) return;
      const w = el.getBoundingClientRect().width;
      st.target = [clamp(base[0] + (e.clientX - sx) / w * 2.4, -2.2, 2.2), clamp(base[1] + (e.clientY - sy) / w * 2.4, -1.8, 1.8)];
      wake(st);
    });
    const end = () => { if (!st.drag) return; st.drag = false; st.target = [0, 0]; startShine(st); wake(st); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }

  function flip(el, faceUp) { const st = el._cc; st.faceUp = faceUp ?? !st.faceUp; wake(st); return st.faceUp; }

  function sweep(el, amt = 1.4) { const st = el._cc; if (reduce.matches) return; st.shine = -0.4; st.shineAmt = amt; wake(st); }

  // ---------------------------------------------------------------- hex dissolve / materialise
  const imgCache = new Map();
  function loadImg(src) {
    if (!imgCache.has(src)) imgCache.set(src, new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }));
    return imgCache.get(src);
  }

  /** mode 'out' (death) or 'in' (summon). Resolves when finished. */
  async function digitise(el, mode = 'out', color) {
    const c = D.cards[el.dataset.card];
    const r = el.getBoundingClientRect();
    if (reduce.matches || !r.width) { el.style.opacity = mode === 'out' ? '0' : '1'; return; }
    const face = el.querySelector('.cc-card__face');
    const kind = frameKind(c);
    const [art, frame] = await Promise.all([loadImg(`${IMG}art-${c.id}.webp`), loadImg(`${IMG}frame-${c.faction}-${kind}.webp`)]);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(r.width * dpr), H = Math.round(r.width * 1.5 * dpr);
    const src = document.createElement('canvas'); src.width = W; src.height = H;
    const g = src.getContext('2d');
    // art under the frame window, like the CSS layer
    const ax = W * 0.07, ay = H * 0.05, aw = W * 0.86, ah = H * 0.535;
    const s = Math.max(aw / art.width, ah / art.height);
    g.save(); g.beginPath(); g.rect(ax, ay, aw, ah); g.clip();
    g.drawImage(art, ax + (aw - art.width * s) / 2, ay + (ah - art.height * s) / 3, art.width * s, art.height * s); g.restore();
    g.drawImage(frame, 0, 0, W, H);

    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.className = 'cc-card__digitise';
    face.appendChild(cv);
    const ctx = cv.getContext('2d');
    const glow = color || getComputedStyle(el).getPropertyValue('--army').trim() || '#e3bd72';
    // hex grid (11 x 16 in the shader)
    const cols = 11, rw = W / cols, rh = rw * 0.866, rows = Math.ceil(H / rh) + 1, R = rw / Math.sqrt(3) * 1.02;
    const cells = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i <= cols; i++) {
      const cx = i * rw + (j % 2 ? rw / 2 : 0), cy = j * rh;
      const n = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; const rnd = n - Math.floor(n);
      cells.push({ cx, cy, t: (cy / H) * 0.55 + rnd * 0.45 });
    }
    el.classList.add('is-digitising');
    if (mode === 'in') el.style.opacity = '1';
    const dur = 900, t0 = performance.now();
    await new Promise((done) => {
      function frameStep(now) {
        const p = clamp((now - t0) / dur, 0, 1);
        const prog = mode === 'out' ? p : 1 - p;           // cells with t < prog are gone
        ctx.clearRect(0, 0, W, H);
        ctx.save(); ctx.beginPath();
        for (const h of cells) if (h.t >= prog) hexPath(ctx, h.cx, h.cy, R);
        ctx.clip(); ctx.drawImage(src, 0, 0); ctx.restore();
        ctx.save(); ctx.strokeStyle = glow; ctx.shadowColor = glow; ctx.shadowBlur = 12 * dpr; ctx.lineWidth = 1.6 * dpr;
        ctx.globalAlpha = 0.9;
        for (const h of cells) { const d = h.t - prog; if (d >= 0 && d < 0.07) { ctx.beginPath(); hexPath(ctx, h.cx, h.cy, R * (0.92 - d * 4)); ctx.stroke(); } }
        ctx.restore();
        if (p < 1) requestAnimationFrame(frameStep); else done();
      }
      requestAnimationFrame(frameStep);
    });
    cv.remove(); el.classList.remove('is-digitising');
    if (mode === 'out') el.style.opacity = '0';
  }
  function hexPath(ctx, x, y, r) {
    for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; const px = x + r * Math.cos(a), py = y + r * Math.sin(a); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.closePath();
  }

  window.CCCards = { create, flip, sweep, makeDraggable, digitise, wake: (el) => wake(el._cc), describe, reduce };
})();
