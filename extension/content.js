// Beepo on the page: renders him, reports time, reacts to events.
// All logic/state lives in background.js; this file only renders and reacts.
(async function () {
  if (window.top !== window) return; // skip iframes

  const TICK_SECS = 5;
  const FRAME_MS = 250;
  // In quiet mode Beepo only speaks up for these.
  const LOUD = new Set(["limit100", "over", "snoozeOver", "goal100", "kept", "badge", "evolve", "snooze1", "snooze2", "snooze3", "unlock"]);
  const CELEBRATE = new Set(["goal100", "kept", "badge", "evolve", "streak"]);
  const SOUNDS = {
    good: [[660, 0.08], [880, 0.1]],
    party: [[523, 0.08], [659, 0.08], [784, 0.08], [1047, 0.16]],
    warn: [[440, 0.1], [0, 0.05], [440, 0.1]],
    bad: [[392, 0.12], [311, 0.2]],
  };
  const MOOD_SOUND = { party: "party", happy: "good", proud: "good", neutral: "warn", worried: "warn", angry: "bad", sad: "bad" };

  function send(msg) {
    try {
      return chrome.runtime.sendMessage(msg).catch(() => null);
    } catch {
      return Promise.resolve(null); // extension was reloaded; this script is orphaned
    }
  }

  // After an install/update the worker re-injects this script into open tabs. The newest
  // copy claims the page; an older (orphaned) copy sees that and retires.
  const token = Math.random().toString(36).slice(2);
  document.documentElement.dataset.beepo = token;
  document.querySelectorAll("beepo-buddy").forEach((el) => el.remove());
  const alive = () => document.documentElement.dataset.beepo === token && !!chrome.runtime?.id;

  let assets = await send({ type: "assets" });
  if (!assets) return;

  let view = null;
  let ui = null;
  let frame = 0;
  let lastInput = Date.now();
  let moodOverride = null; // { mood, until }
  let waveUntil = 0;
  let bubbleTimer = null;
  let eventQueue = [];
  let eventBusy = false;
  let lastDrawKey = "";
  let lastWidth = 0;
  let saidBored = false;
  let lastScrollMsg = 0;
  const walk = { mode: "idle", x: null, dir: -1, nextAt: Date.now() + rand(8000, 20000) };

  // ---------- helpers ----------

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const t = (key, vars = {}) => (assets.i18n.ui[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
  // Under a minute shows seconds, so "0 min over" never happens.
  const fmtMin = (secs) => {
    secs = Math.max(0, Math.round(secs));
    return secs > 0 && secs < 60 ? t("sec", { n: secs }) : t("min", { n: Math.round(secs / 60) });
  };
  const settings = () => view?.settings || {};
  const scale = () => Math.min(8, (settings().scale || 4) + (view?.look?.grow || 0));
  const isBlocked = () => !!view?.rule && view.state !== "ok";
  // Hidden rules still need the DOM for the block screen.
  const showing = () => !!view && (view.rule ? !view.rule.hidden || isBlocked() : settings().everywhere);
  const overLimit = () => view?.rule?.mode === "limit" && view.used >= view.limit;

  function line(key, vars = {}) {
    const m = assets.messages[key];
    if (!m) return { text: key, mood: "neutral" };
    const text = pick(m.lines).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
    return { text, mood: m.mood };
  }

  function greetKey() {
    const h = new Date().getHours();
    if (h < 5) return "greetNight";
    if (h < 12) return "greetMorning";
    if (h < 18) return "greetAfternoon";
    return "greetEvening";
  }

  function statusLine() {
    const time = new Date().toLocaleTimeString(assets.i18n.locale, { hour: "numeric", minute: "2-digit" });
    if (!view.rule) return line("statusCompanion", { stars: view.stars, streak: view.look.limitStreak });
    const { rule, used, limit } = view;
    const left = limit - used;
    if (rule.mode === "goal") return line(left > 0 ? "statusGoal" : "statusGoalDone", { left: fmtMin(left) });
    if (left <= 0) return line("statusOver", { over: fmtMin(-left), name: rule.name });
    if (view.night && Math.random() < 0.5) return line("statusNight", { time });
    return line("statusLimit", { left: fmtMin(left), name: rule.name });
  }

  function mediaPlaying() {
    return [...document.querySelectorAll("video, audio")].some((m) => !m.paused && !m.ended && m.readyState > 2);
  }

  let actx = null;
  function beep(kind) {
    if (!settings().sound || !SOUNDS[kind]) return;
    try {
      actx ||= new AudioContext();
      let t = actx.currentTime;
      for (const [f, d] of SOUNDS[kind]) {
        if (f) {
          const o = actx.createOscillator();
          const g = actx.createGain();
          o.type = "square";
          o.frequency.value = f;
          g.gain.value = 0.03;
          o.connect(g).connect(actx.destination);
          o.start(t);
          o.stop(t + d);
        }
        t += d;
      }
    } catch {
      // Autoplay policy or no audio; silence is fine.
    }
  }

  // ---------- DOM ----------

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    .stage {
      position: fixed; bottom: 0; z-index: 2147483646; pointer-events: none;
      font: 12px/1.4 ui-monospace, Menlo, monospace; color: #1b1b2f;
      transition-property: left; transition-timing-function: linear;
    }
    .row { display: flex; align-items: flex-end; gap: 2px; transition: transform .3s; }
    .stage.tucked .row { transform: translateY(62%); }
    .stage.peek .row { animation: peek 3.2s steps(6); }
    .stage.tucked .bubble { display: none; }
    canvas { image-rendering: pixelated; display: block; }
    .beepo { pointer-events: auto; cursor: pointer; animation: bob 1.2s steps(2) infinite; }
    .beepo.sit { animation: none; }
    .beepo.jump { animation: jump .4s steps(4) 3; }
    .beepo.shake { animation: shake .15s steps(2) 6; }
    .pet { animation: bob 1.6s steps(2) infinite; }
    @keyframes bob { 50% { translate: 0 -3px; } }
    @keyframes jump { 50% { translate: 0 -24px; } }
    @keyframes shake { 0% { translate: -3px 0; } 100% { translate: 3px 0; } }
    @keyframes peek { 0%, 100% { transform: none; } 15%, 80% { transform: translateY(68%); } }
    .bubble {
      position: absolute; bottom: calc(100% + 8px); width: max-content; max-width: 240px;
      pointer-events: auto; background: #fff; padding: 8px 12px 8px 10px;
      border: 3px solid #1b1b2f; box-shadow: 4px 4px 0 #1b1b2f33;
    }
    .bubble.r { right: 0; } .bubble.l { left: 0; }
    .bubble::after {
      content: ""; position: absolute; bottom: -9px;
      border: 6px solid transparent; border-top-color: #1b1b2f; border-bottom: 0;
    }
    .bubble.r::after { right: 22px; } .bubble.l::after { left: 22px; }
    .bubble[hidden] { display: none; }
    .meta { opacity: .6; margin-top: 4px; font-size: 11px; }
    .meta:empty { display: none; }
    .close { position: absolute; top: 0; right: 4px; cursor: pointer; opacity: .5; }
    .actions:empty { display: none; }
    .actions { margin-top: 6px; display: flex; gap: 6px; }
    button {
      font: inherit; font-weight: bold; cursor: pointer; color: #1b1b2f;
      background: #7ad1ff; border: 2px solid #1b1b2f; padding: 2px 8px; box-shadow: 2px 2px 0 #1b1b2f;
    }
    button:active { translate: 1px 1px; box-shadow: 1px 1px 0 #1b1b2f; }
    button:disabled { opacity: .5; cursor: default; }
    button.ghost { background: #fff; }
    .sign { display: flex; flex-direction: column; align-items: center; margin-bottom: 30%; order: 1; animation: bob .6s steps(2) infinite; }
    .sign b {
      background: #ff5c7a; color: #fff; font: bold 10px ui-monospace, monospace; padding: 4px 3px;
      clip-path: polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%);
    }
    .sign i { width: 3px; height: 14px; background: #1b1b2f; }
    .sign[hidden], .zzz[hidden] { display: none; }
    .zzz { position: absolute; top: -6px; right: 0; font-weight: bold; color: #4a9fd6; animation: zzz 2s steps(4) infinite; }
    @keyframes zzz { 0% { opacity: 0; translate: 0 6px; } 50% { opacity: 1; } 100% { opacity: 0; translate: 8px -10px; } }
    .confetti { position: fixed; width: 6px; height: 6px; z-index: 2147483647; pointer-events: none; }
    .block {
      position: fixed; inset: 0; z-index: 2147483647; pointer-events: auto;
      background: #f4f1e8f7; display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 14px; text-align: center; font: 14px/1.5 ui-monospace, Menlo, monospace; color: #1b1b2f;
    }
    .block[hidden] { display: none; }
    /* Monospace fonts have no Arabic, and the fallback breaks letter joining. */
    [dir="rtl"], [dir="rtl"] h1 { font-family: system-ui, "Segoe UI", Tahoma, sans-serif; }
    .block h1 { font-size: 22px; margin: 0; max-width: 520px; }
    .block p { margin: 0; opacity: .7; }
    .block .btns { display: flex; gap: 10px; }
    .block button { font-size: 14px; padding: 6px 14px; }
  `;

  function mount() {
    if (ui) return;
    const host = document.createElement("beepo-buddy");
    const shadow = host.attachShadow({ mode: "closed" });
    // Static markup only; text and styles are set below (no interpolation into innerHTML).
    shadow.innerHTML = `
      <div class="stage">
        <div class="bubble r" hidden>
          <span class="close">×</span>
          <div class="text"></div>
          <div class="actions"></div>
          <div class="meta"></div>
        </div>
        <div class="row">
          <canvas class="pet" hidden></canvas>
          <div style="position:relative">
            <canvas class="beepo"></canvas>
            <span class="zzz" hidden>z</span>
          </div>
          <div class="sign" hidden><b></b><i></i></div>
        </div>
      </div>
      <div class="block" hidden>
        <canvas class="bigBeepo"></canvas>
        <h1 class="btitle"></h1>
        <p class="binfo"></p>
        <div class="btns">
          <button class="unlockBtn"></button>
          <button class="ghost closeBtn"></button>
        </div>
      </div>`;
    const style = document.createElement("style");
    style.textContent = CSS;
    shadow.prepend(style);
    const $ = (s) => shadow.querySelector(s);
    $(".bubble").dir = $(".block").dir = assets.i18n.dir;
    $(".close").title = t("close");
    $(".beepo").title = t("beepoTitle");
    $(".sign b").textContent = t("stop");
    $(".closeBtn").textContent = t("closeTab");
    ui = {
      host,
      shadow,
      stage: $(".stage"),
      row: $(".row"),
      bubble: $(".bubble"),
      text: $(".text"),
      actions: $(".actions"),
      meta: $(".meta"),
      canvas: $(".beepo"),
      pet: $(".pet"),
      sign: $(".sign"),
      zzz: $(".zzz"),
      block: $(".block"),
      big: $(".bigBeepo"),
      btitle: $(".btitle"),
      binfo: $(".binfo"),
      unlockBtn: $(".unlockBtn"),
    };

    ui.canvas.addEventListener("click", () => {
      if (ui.stage.classList.contains("tucked")) return ui.stage.classList.remove("tucked");
      if (!ui.bubble.hidden) return (ui.bubble.hidden = true);
      sayStatus(Math.random() < 0.25 ? line("poke") : null);
    });
    ui.canvas.addEventListener("dblclick", () => ui.stage.classList.add("tucked"));
    $(".close").addEventListener("click", () => (ui.bubble.hidden = true));
    $(".closeBtn").addEventListener("click", () => send({ type: "closeTab" }));
    ui.unlockBtn.addEventListener("click", async () => {
      apply(await send({ type: "unlock", href: location.href, ruleId: view.rule.id }));
    });
    ui.stage.addEventListener("transitionend", (e) => e.target === ui.stage && arrive());

    document.documentElement.appendChild(host);
    lastDrawKey = "";
    drawBeepo();
    walk.x = homeX();
    placeStage(0);
  }

  function unmount() {
    ui?.host.remove();
    ui = null;
  }

  // ---------- movement ----------

  const stageWidth = () => ui.row.offsetWidth || 16 * scale();

  function homeX() {
    return settings().side === "left" ? 24 : Math.max(0, innerWidth - stageWidth() - 24);
  }

  function clampX(x) {
    return Math.min(Math.max(8, x), Math.max(8, innerWidth - stageWidth() - 8));
  }

  function placeStage(speedPxPerSec) {
    const cur = ui.stage.getBoundingClientRect().left;
    const dist = Math.abs(walk.x - cur);
    ui.stage.style.transitionDuration = speedPxPerSec ? `${dist / speedPxPerSec}s` : "0s";
    ui.stage.style.left = `${walk.x}px`;
    const onRight = walk.x + stageWidth() / 2 > innerWidth / 2;
    ui.bubble.classList.toggle("r", onRight);
    ui.bubble.classList.toggle("l", !onRight);
    if (!speedPxPerSec || dist < 2) arrive();
  }

  function walkTo(x, speed) {
    x = clampX(x);
    const cur = ui.stage.getBoundingClientRect().left;
    walk.dir = x > cur ? 1 : -1;
    walk.mode = "walk";
    walk.x = x;
    placeStage(speed);
  }

  function arrive() {
    if (walk.mode !== "walk") return;
    walk.mode = Math.random() < 0.4 ? "sit" : "idle";
    walk.nextAt = Date.now() + rand(15000, 40000);
  }

  function maybeWander() {
    if (!settings().wander || walk.mode === "walk" || Date.now() < walk.nextAt) return;
    if (isBlocked() || !ui.bubble.hidden || ui.stage.classList.contains("tucked") || idleFor() > 30000) {
      walk.nextAt = Date.now() + 5000;
      return;
    }
    // Mostly hang around home, sometimes go exploring.
    const target = Math.random() < 0.4 ? homeX() : rand(16, innerWidth - stageWidth() - 16);
    walkTo(target, 40);
  }

  // ---------- rendering ----------

  const idleFor = () => (mediaPlaying() ? 0 : Date.now() - lastInput);

  function baseMood() {
    if (moodOverride && Date.now() < moodOverride.until) return moodOverride.mood;
    if (walk.mode === "walk") return walk.dir > 0 ? "lookRight" : "lookLeft";
    const idle = idleFor();
    if (idle > 90000) return "sleepy";
    if (idle > 30000) return "bored";
    if (view.rule) {
      const ratio = view.used / view.base;
      if (view.rule.mode === "goal") return ratio >= 1 ? "proud" : "happy";
      if (view.used >= view.limit) return "angry";
      if (ratio >= 0.8) return "worried";
    }
    if (view.night) return "sleepy";
    if (view.look.scruffy) return "sad";
    return "happy";
  }

  function drawBeepo() {
    if (!ui) return;
    let mood = baseMood();
    const blinkable = ["happy", "neutral", "worried", "bored", "proud", "lookLeft", "lookRight"].includes(mood);
    if (blinkable && frame % 16 === 0) mood = "blink";
    let pose = null;
    if (walk.mode === "walk") pose = frame % 2 ? "walk" : null;
    else if (walk.mode === "sit") pose = "sit";
    if (Date.now() < waveUntil || overLimit()) pose = frame % 4 < 2 || overLimit() ? "wave" : null;

    const s = scale();
    const key = [mood, pose, s, JSON.stringify(view.look)].join("|");
    if (key !== lastDrawKey) {
      lastDrawKey = key;
      BeepoSprite.draw(ui.canvas, assets, { mood, pose, look: view.look, scale: s });
      ui.stage.style.bottom = `${-s}px`; // sprite has one empty row under the feet
      ui.canvas.classList.toggle("sit", pose === "sit");
      ui.canvas.style.translate = pose === "sit" ? `0 ${s}px` : "";
    }

    const petId = view.look.equipped.pet;
    const petScale = Math.max(2, s - 1);
    const petOnLeft = walk.mode === "walk" ? walk.dir > 0 : walk.x + stageWidth() / 2 > innerWidth / 2;
    ui.pet.hidden = !BeepoSprite.drawPet(ui.pet, assets, petId, Math.floor(frame / 2), petScale, petOnLeft);
    ui.pet.style.order = petOnLeft ? -1 : 2;

    ui.zzz.hidden = mood !== "sleepy" && !(mood === "blink" && idleFor() > 90000);
    ui.sign.hidden = !overLimit() || isBlocked();

    // Sign or pet appearing changes the width; keep him on screen.
    const w = stageWidth();
    if (w !== lastWidth && walk.mode !== "walk" && walk.x != null) {
      lastWidth = w;
      walk.x = clampX(walk.x);
      placeStage(0);
    }
  }

  function metaText() {
    const stars = `⭐ ${view.stars}`;
    const streak = Math.max(view.look.limitStreak, view.look.goalStreak);
    const flame = streak >= 2 ? ` · 🔥 ${streak}` : "";
    if (!view.rule) return stars + flame;
    const { rule, used, limit } = view;
    const unlock = view.unlockLeft > 0 ? ` · 🔓 ${t("m", { m: Math.ceil(view.unlockLeft / 60000) })}` : "";
    return `${fmtMin(used)} / ${fmtMin(limit)} ${t("mode_" + rule.mode)} · ${stars}${flame}${unlock}`;
  }

  // ---------- speech & reactions ----------

  function say({ text, mood }, { duration = 8000, actions = [], sound = true } = {}) {
    if (!ui) return;
    ui.stage.classList.remove("tucked");
    ui.text.textContent = text;
    ui.meta.textContent = metaText();
    ui.actions.replaceChildren(
      ...actions.map(([label, fn]) => {
        const b = document.createElement("button");
        b.textContent = label;
        b.addEventListener("click", fn);
        return b;
      })
    );
    ui.bubble.hidden = false;
    moodOverride = { mood, until: Date.now() + Math.min(duration || 8000, 8000) };
    lastDrawKey = "";
    if (sound) beep(MOOD_SOUND[mood]);
    clearTimeout(bubbleTimer);
    if (duration) bubbleTimer = setTimeout(() => ui && (ui.bubble.hidden = true), duration);
  }

  function snoozeActions() {
    if (!overLimit() || isBlocked()) return [];
    return [
      [
        view.snoozes ? t("snoozeBtnN", { n: view.snoozes + 1 }) : t("snoozeBtn"),
        async () => {
          const v = await send({ type: "snooze", href: location.href, ruleId: view.rule.id });
          apply(v);
        },
      ],
    ];
  }

  function sayStatus(extra) {
    const s = statusLine();
    const actions = snoozeActions();
    say(extra ? { text: `${extra.text} ${s.text}`, mood: extra.mood } : s, { duration: actions.length ? 15000 : 6000, actions });
  }

  function react(key) {
    ui.canvas.classList.remove("jump", "shake");
    ui.stage.classList.remove("peek");
    void ui.canvas.offsetWidth; // restart CSS animations
    if (CELEBRATE.has(key)) {
      ui.canvas.classList.add("jump");
      confetti();
    } else if (key === "limit100" || key === "over") {
      ui.canvas.classList.add("shake");
    } else if (key === "limit80") {
      ui.stage.classList.add("peek");
    } else if (key.startsWith("greet")) {
      waveUntil = Date.now() + 1600;
    }
  }

  function confetti() {
    const r = ui.canvas.getBoundingClientRect();
    const colors = ["#ffd84a", "#ff5c7a", "#8affc1", "#7ad1ff", "#9b7bff"];
    for (let i = 0; i < 28; i++) {
      const p = document.createElement("div");
      p.className = "confetti";
      p.style.background = pick(colors);
      p.style.left = `${r.left + r.width / 2}px`;
      p.style.top = `${r.top + r.height / 3}px`;
      ui.shadow.appendChild(p);
      const dx = rand(-160, 160);
      const up = rand(80, 220);
      p.animate(
        [
          { transform: "translate(0,0)" },
          { transform: `translate(${dx * 0.6}px, ${-up}px)`, offset: 0.4 },
          { transform: `translate(${dx}px, ${rand(20, 120)}px) rotate(${rand(90, 360)}deg)`, opacity: 0 },
        ],
        { duration: rand(1100, 1700), easing: "steps(12)" }
      ).onfinish = () => p.remove();
    }
  }

  function queueEvents(events) {
    for (const e of events || []) {
      if (settings().quiet && !LOUD.has(e.key)) continue;
      eventQueue.push(e);
    }
    nextEvent();
  }

  function nextEvent() {
    if (eventBusy || !eventQueue.length || !ui) return;
    eventBusy = true;
    const e = eventQueue.shift();
    const vars = { ...e.vars };
    // Badge/evolve news is queued with an id so it shows in the current language.
    if (vars.id) vars.name = (e.key === "badge" ? assets.i18n.badges[vars.id]?.name : assets.i18n.evolve[vars.id]) ?? vars.name;
    if (view.rule) {
      vars.name ??= view.rule.name;
      vars.left ??= fmtMin(view.limit - view.used);
      vars.over ??= fmtMin(view.used - view.limit);
    }
    const sticky = e.key === "limit100" || e.key === "over" || e.key === "snoozeOver";
    say(line(e.key, vars), { duration: sticky ? 0 : 8000, actions: sticky ? snoozeActions() : [] });
    react(e.key);
    setTimeout(() => {
      eventBusy = false;
      nextEvent();
    }, 6000);
  }

  // ---------- block screen ----------

  let pauseTimer = null;
  function renderBlock() {
    const blocked = isBlocked();
    ui.block.hidden = !blocked;
    clearInterval(pauseTimer);
    if (!blocked) return;
    const focus = view.state === "blocked-focus";
    const m = line(focus ? "focus" : "blocked", { name: view.rule.name, until: view.rule.focus?.end || "" });
    ui.btitle.textContent = m.text;
    ui.binfo.textContent = focus
      ? t("blockFocus", { start: view.rule.focus.start, end: view.rule.focus.end, stars: view.stars })
      : t("blockUsed", { used: fmtMin(view.used), base: fmtMin(view.base), stars: view.stars });
    ui.unlockBtn.textContent = t("unlock");
    ui.unlockBtn.disabled = view.stars < 1;
    ui.unlockBtn.title = view.stars < 1 ? t("noStars") : "";
    BeepoSprite.draw(ui.big, assets, { mood: m.mood, look: view.look, scale: 10 });
    const pause = () => document.querySelectorAll("video, audio").forEach((el) => el.pause());
    pause();
    pauseTimer = setInterval(pause, 1000);
  }

  // ---------- state ----------

  function apply(v) {
    if (!v) return;
    const first = !view || !ui;
    const ruleChanged = view?.rule?.id !== v.rule?.id;
    view = v;
    if (!showing()) {
      unmount();
      return;
    }
    mount();
    ui.stage.hidden = !!v.rule?.hidden;
    lastDrawKey = "";
    drawBeepo();
    renderBlock();
    if (!ui.bubble.hidden) ui.meta.textContent = metaText();

    if ((first || ruleChanged) && !settings().quiet && !v.events.length) {
      const g = line(greetKey());
      sayStatus(g);
      react(greetKey());
    }
    queueEvents(v.events);
  }

  async function refresh() {
    apply(await send({ type: "status", href: location.href }));
  }

  // ---------- loops & listeners ----------

  function retire() {
    clearInterval(tickTimer);
    clearInterval(frameTimer);
    unmount();
  }

  const tickTimer = setInterval(async () => {
    if (!alive()) return retire();
    if (document.visibilityState !== "visible") return;
    apply(await send({ type: "tick", href: location.href, seconds: TICK_SECS, media: mediaPlaying() }));
  }, TICK_SECS * 1000);

  const frameTimer = setInterval(() => {
    if (!alive()) return retire();
    if (!ui || !view) return;
    frame++;
    drawBeepo();
    maybeWander();
    if (!saidBored && idleFor() > 120000 && ui.bubble.hidden && !settings().quiet) {
      saidBored = true;
      say(line("bored"), { sound: false });
    }
  }, FRAME_MS);

  const markInput = () => {
    lastInput = Date.now();
    saidBored = false;
  };
  for (const ev of ["mousemove", "keydown", "wheel", "touchstart", "click"]) {
    addEventListener(ev, markInput, { passive: true, capture: true });
  }

  // Fast scrolling: Beepo gets dizzy and runs home.
  let scrollY0 = scrollY;
  let scrollT0 = Date.now();
  addEventListener(
    "scroll",
    () => {
      markInput();
      const now = Date.now();
      if (now - scrollT0 < 300) return;
      const speed = Math.abs(scrollY - scrollY0) / ((now - scrollT0) / 1000);
      scrollY0 = scrollY;
      scrollT0 = now;
      if (!ui || speed < 4000 || now - lastScrollMsg < 60000 || isBlocked()) return;
      lastScrollMsg = now;
      if (!settings().quiet) say(line("scroll"), { duration: 3000, sound: false });
      walkTo(homeX(), 260);
    },
    { passive: true }
  );

  addEventListener("resize", () => {
    if (!ui) return;
    walk.x = clampX(walk.x);
    placeStage(0);
  });

  // Switching back to a tab: show fresh numbers now, not on the next tick.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && alive()) refresh();
  });

  chrome.storage.onChanged.addListener(async (changes) => {
    if (!alive()) return;
    if (changes.custom || changes.settings) {
      const lang = assets.i18n.lang;
      assets = (await send({ type: "assets" })) || assets;
      if (assets.i18n.lang !== lang) unmount(); // rebuilt in the new language by refresh()
    }
    if (changes.rules || changes.settings || changes.wallet || changes.custom) {
      const sideChanged = changes.settings && changes.settings.oldValue?.side !== changes.settings.newValue?.side;
      await refresh();
      if (ui && sideChanged) walkTo(homeX(), 120);
    }
  });

  refresh();
})();
