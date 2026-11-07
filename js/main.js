/* Cards & Clans — page behaviour: nav, hero, the card vault, armies, Trophy Road. */
(function () {
  'use strict';
  const D = window.CC_DATA, C = window.CCCards;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // ---------------------------------------------------------------- nav
  const nav = $('.nav'), toggle = $('.nav__toggle');
  const onScroll = () => nav.classList.toggle('is-solid', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const setMenu = (open) => { toggle.setAttribute('aria-expanded', String(open)); nav.classList.toggle('is-open', open); document.body.style.overflow = open ? 'hidden' : ''; };
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  $$('.nav__links a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); toggle.focus(); } });

  // ---------------------------------------------------------------- hero
  const hero = $('.hero');
  requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add('is-in')));
  const art = $('.hero__art');
  if (!reduce.matches && window.matchMedia('(pointer: fine)').matches) {
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      art.style.setProperty('--px', ((e.clientX / r.width - 0.5) * -18).toFixed(1) + 'px');
      art.style.setProperty('--py', ((e.clientY / r.height - 0.5) * -12).toFixed(1) + 'px');
    });
  }
  embers($('.hero__embers'), hero);

  function embers(cv, host) {
    if (reduce.matches) return;
    const ctx = cv.getContext('2d'); let W = 0, H = 0, dpr = 1, visible = true, raf = 0;
    const N = window.innerWidth < 760 ? 34 : 70; const ps = [];
    const size = () => { dpr = Math.min(devicePixelRatio || 1, 2); W = cv.width = host.clientWidth * dpr; H = cv.height = host.clientHeight * dpr; };
    size(); window.addEventListener('resize', size);
    const spawn = (p, init) => { p.x = Math.random() * W; p.y = init ? Math.random() * H : H + 10; p.v = (0.15 + Math.random() * 0.5) * dpr; p.r = (0.6 + Math.random() * 1.8) * dpr; p.a = 0.2 + Math.random() * 0.6; p.w = Math.random() * 6.28; return p; };
    for (let i = 0; i < N; i++) ps.push(spawn({}, true));
    const step = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of ps) {
        p.y -= p.v; p.w += 0.01; p.x += Math.sin(p.w) * 0.3 * dpr;
        if (p.y < -10) spawn(p);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        g.addColorStop(0, `rgba(255,214,140,${p.a})`); g.addColorStop(1, 'rgba(255,160,60,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, 6.29); ctx.fill();
      }
      raf = visible && !document.hidden ? requestAnimationFrame(step) : 0;
    };
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(step); }).observe(host);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && visible && !raf) raf = requestAnimationFrame(step); });
  }

  // ---------------------------------------------------------------- the vault: a fanned hand of commanders
  const VAULT = ['concord_aria_vance', 'swarm_ixxa', 'axiom_ax0', 'veyran_kharra', 'lunar_aria_vance'];
  const hand = $('.vault__hand');
  const cards = VAULT.map((id, i) => {
    const el = C.create(id, { foil: 1 });
    el.setAttribute('role', 'listitem');
    el.tabIndex = 0;
    el.style.setProperty('--i', i);
    el.addEventListener('click', () => openInspect(id, el));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openInspect(id, el); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const n = cards[(i + (e.key === 'ArrowRight' ? 1 : cards.length - 1)) % cards.length]; n.focus(); }
    });
    hand.appendChild(el); return el;
  });
  function layoutFan() {
    const w = hand.clientWidth, n = cards.length, cw = cards[0].getBoundingClientRect().width || 180;
    const spread = Math.max(0, Math.min(w - cw * 1.35, cw * 0.62 * (n - 1)));
    cards.forEach((el, i) => {
      const t = n === 1 ? 0 : i / (n - 1) - 0.5;
      el.style.setProperty('--fx', (t * spread).toFixed(1) + 'px');
      el.style.setProperty('--fy', (Math.abs(t) * Math.abs(t) * 90).toFixed(1) + 'px');
      el.style.setProperty('--fr', (t * 22).toFixed(2) + 'deg');
      el.style.zIndex = String(i + 1);
    });
  }
  layoutFan(); window.addEventListener('resize', layoutFan);
  new IntersectionObserver((ents, ob) => { if (ents[0].isIntersecting) { hand.classList.add('is-dealt'); cards.forEach((el, i) => setTimeout(() => C.sweep(el, 1.2), 500 + i * 120)); ob.disconnect(); } }, { threshold: 0.35 }).observe(hand);

  // inspect dialog
  const insp = $('.inspect'), stage = $('.inspect__stage');
  let current = null, opener = null;
  function openInspect(id, from) {
    const c = D.cards[id], army = D.armies.find((a) => a.id === c.faction);
    opener = from; from.classList.add('is-lifted');
    stage.innerHTML = '';
    current = C.create(id, { foil: 1 }); C.makeDraggable(current); stage.appendChild(current);
    current.tabIndex = 0;
    $('.inspect__army').textContent = army ? army.name : '';
    $('#inspect-name').textContent = c.name;
    $('.inspect__type').textContent = c.commander ? 'Commander' : c.type;
    $('.inspect__stats').innerHTML = `<div><dt>Cost</dt><dd>${c.cost}</dd></div>` + (c.type === 'Spell' ? '' : `<div><dt>Attack</dt><dd>${c.power}</dd></div><div><dt>Health</dt><dd>${c.health}</dd></div>`);
    $('.inspect__text').textContent = c.text;
    $('.inspect__flavor').textContent = c.flavor ? '“' + c.flavor + '”' : (c.commander && army ? army.levelUp + '.' : '');
    insp.hidden = false; document.body.style.overflow = 'hidden';
    setTimeout(() => C.sweep(current, 1.6), 250);
    $('[data-flip]', insp).focus();
  }
  function closeInspect() {
    if (insp.hidden) return;
    insp.hidden = true; document.body.style.overflow = '';
    if (opener) { opener.classList.remove('is-lifted'); opener.focus(); }
  }
  $$('[data-close]', insp).forEach((b) => b.addEventListener('click', closeInspect));
  $('[data-flip]', insp).addEventListener('click', () => current && C.flip(current));
  document.addEventListener('keydown', (e) => {
    if (insp.hidden) return;
    if (e.key === 'Escape') closeInspect();
    if (e.key === 'f' || e.key === 'F') { e.preventDefault(); C.flip(current); }
    if (e.key === 'Tab') { // keep focus inside the dialog
      const f = $$('button, [tabindex="0"]', insp).filter((x) => x.offsetParent !== null);
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });

  // ---------------------------------------------------------------- armies
  const list = $('.armies__list'), section = $('.armies'), holo = $('.holo');
  const panel = $('.armies__stage');
  const tabs = [];
  D.armies.filter((a) => !a.opposite).forEach((core) => {
    const pair = document.createElement('div'); pair.className = 'pair';
    [core, D.armies.find((a) => a.opposite === core.id)].filter(Boolean).forEach((a) => {
      const b = document.createElement('button');
      b.type = 'button'; b.role = 'tab'; b.id = 'tab-' + a.id; b.className = a.opposite ? 'is-night' : '';
      b.setAttribute('aria-selected', 'false'); b.setAttribute('aria-controls', 'army-panel'); b.tabIndex = -1;
      b.style.setProperty('--c', a.color);
      b.innerHTML = `<img src="assets/img/emblem-${a.id}.webp" alt="" width="200" height="200">${a.name}`;
      b.addEventListener('click', () => select(a.id, true));
      pair.appendChild(b); tabs.push({ b, a });
    });
    list.appendChild(pair);
  });
  panel.id = 'army-panel';
  list.addEventListener('keydown', (e) => {
    const i = tabs.findIndex((t) => t.b === document.activeElement); if (i < 0) return;
    let n = null;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = (i + 1) % tabs.length;
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home') n = 0; if (e.key === 'End') n = tabs.length - 1;
    if (n !== null) { e.preventDefault(); select(tabs[n].a.id, true); tabs[n].b.focus(); }
  });
  function select(id, animate) {
    const a = D.armies.find((x) => x.id === id);
    tabs.forEach(({ b, a: x }) => { const on = x.id === id; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    panel.setAttribute('aria-labelledby', 'tab-' + id);
    section.style.setProperty('--army', a.color); section.style.setProperty('--accent', a.accent);
    const img = $('img', holo);
    img.src = `assets/img/holo-${a.id}.webp`; img.alt = `${a.commander}, commander of the ${a.name}.`;
    $('.army__emblem').src = `assets/img/emblem-${a.id}.webp`;
    const core = a.opposite ? D.armies.find((x) => x.id === a.opposite) : null;
    $('.army__pair').textContent = core ? `Night side of the ${core.name}` : 'Core army';
    $('.army__name').textContent = a.name;
    $('.army__look').textContent = a.look + (core ? ` It fights exactly like the ${core.name}.` : '');
    $('.army__plan').textContent = a.playstyle;
    $('.army__weak').textContent = a.weakness;
    $('.army__cmd').textContent = `${a.commander}. ${a.levelUp}.`;
    $('.army__diff').innerHTML = [1, 2, 3].map((n) => `<span class="${n <= a.difficulty ? 'on' : ''}"></span>`).join('') + `<span class="sr-only">${a.difficulty} of 3</span>`;
    if (animate && !reduce.matches) { holo.classList.remove('is-materialising'); void holo.offsetWidth; holo.classList.add('is-materialising'); }
    dealSignature(a, animate);
  }

  // signature cards: three live cards per army; they digitise in like a summon in the game
  const row = $('.army__row');
  let dealt = 0;
  function dealSignature(a, animate) {
    const ticket = ++dealt;
    row.innerHTML = '';
    a.cards.forEach((id, i) => {
      const el = C.create(id);
      el.setAttribute('role', 'listitem'); el.tabIndex = 0;
      el.addEventListener('click', () => openInspect(id, el));
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openInspect(id, el); } });
      row.appendChild(el);
      if (animate && !reduce.matches) {
        el.style.opacity = '0';
        setTimeout(() => { if (ticket === dealt) C.digitise(el, 'in', a.color).then(() => C.sweep(el, 1.2)); }, 250 + i * 160);
      }
    });
  }
  select('concord', false);

  // ---------------------------------------------------------------- the Assault coin: flip it
  const coin = $('.coin-flip');
  if (coin) {
    const sayEl = $('.coin-say');
    let spins = 0;
    const flipCoin = () => {
      spins += 1;
      coin.style.setProperty('--spin', (spins * 900) + 'deg');
      const theirs = spins % 2 === 1;
      setTimeout(() => {
        coin.classList.toggle('is-theirs', theirs);
        sayEl.textContent = theirs ? 'Their round: they may attack. You block.' : 'Your round: you may attack.';
      }, reduce.matches ? 0 : 550);
    };
    coin.addEventListener('click', flipCoin);
  }
  holo.addEventListener('animationend', () => holo.classList.remove('is-materialising'));

  // ---------------------------------------------------------------- Trophy Road: drag to scroll
  const road = $('.road');
  let down = false, sx = 0, sl = 0, moved = 0;
  road.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; down = true; sx = e.clientX; sl = road.scrollLeft; moved = 0; road.classList.add('is-dragging'); road.setPointerCapture(e.pointerId); });
  road.addEventListener('pointermove', (e) => { if (!down) return; moved = Math.abs(e.clientX - sx); road.scrollLeft = sl - (e.clientX - sx); });
  const up = () => { down = false; road.classList.remove('is-dragging'); };
  road.addEventListener('pointerup', up); road.addEventListener('pointercancel', up);
  road.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { road.scrollBy({ left: 240, behavior: reduce.matches ? 'auto' : 'smooth' }); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { road.scrollBy({ left: -240, behavior: reduce.matches ? 'auto' : 'smooth' }); e.preventDefault(); }
  });

  // ---------------------------------------------------------------- reveal on scroll
  const rv = $$('.vault__intro, .creed__inner > *, .play__head, .armies__head, .worlds__head, .world, .progress__head, .ledger li, .close__copy');
  rv.forEach((el) => el.classList.add('reveal'));
  const io = new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  rv.forEach((el) => io.observe(el));
})();
