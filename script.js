// 高性能 Canvas 烟花动画（ES6+，无第三方库）
(() => {
  const canvas = document.getElementById('fireworks');
  const ctx = canvas.getContext('2d', { alpha: true });
  const TAU = Math.PI * 2;
  const isWeChat = /micromessenger/i.test(navigator.userAgent);
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  let dpi = Math.max(1, Math.min(2, window.devicePixelRatio || 1)); // 限制到 2x，避免高DPI过载
  if (isWeChat || isMobile) dpi = 1; // 移动端/微信强制 1x 渲染，显著减负

  let particles = [];
  let texts = [];
  let lastTime = performance.now();
  let frameDt = 0;
  let rafId = null;
  // 自适应性能调节：质量等级（0=高，1=中，2=低）与性能评分
  let quality = (isWeChat || isMobile) ? 2 : 0;
  let perfScore = 0;
  let lastSpawnTs = 0;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    const w = Math.max(320, window.innerWidth);
    const h = Math.max(320, window.innerHeight);
    canvas.width = Math.round(w * dpi);
    canvas.height = Math.round(h * dpi);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
  }
  // 使用 requestAnimationFrame 节流 resize，避免频繁计算
  let resizeScheduled = false;
  function scheduleResize() {
    if (resizeScheduled) return;
    resizeScheduled = true;
    requestAnimationFrame(() => {
      resize();
      resizeScheduled = false;
    });
  }
  window.addEventListener('resize', scheduleResize, { passive: true });
  resize();

  // 随机工具
  const rand = (min, max) => Math.random() * (max - min) + min;
  const pick = arr => arr[(Math.random() * arr.length) | 0];
  const hues = [0, 30, 60, 120, 180, 220, 260, 300]; // 多色系

  class Particle {
    constructor(x, y) {
      const angle = rand(0, TAU);
      const speed = rand(3.6, 7.2); // 更高速度，扩大绽放范围
      this.x = x;
      this.y = y;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.friction = (quality === 2 ? 0.985 : quality === 1 ? 0.989 : 0.992); // 低质量更快减速，减少帧渲染
      this.gravity = 0.06;
      this.hue = pick(hues) + rand(-10, 10);
      this.alpha = 1;
      this.decay = (quality === 2 ? rand(0.028, 0.042) : quality === 1 ? rand(0.016, 0.03) : rand(0.012, 0.024)); // 低质量更快消退
      this.radius = (quality === 2 ? rand(1.2, 2.2) : quality === 1 ? rand(1.6, 3.0) : rand(1.8, 3.4)) * dpi; // 低质量更小的粒子半径
    }
    update(dt) {
      this.vx *= this.friction;
      this.vy = this.vy * this.friction + this.gravity;
      this.x += this.vx * dt * 0.06;
      this.y += this.vy * dt * 0.06;
      this.alpha -= this.decay * dt * 0.06;
      return this.alpha > 0;
    }
    draw(ctx) {
      const a = Math.max(0, this.alpha);
      const color = `hsla(${this.hue}, 85%, 64%, ${a})`;
      ctx.save();
      ctx.fillStyle = color;
      const blur = (quality === 0 ? 6 * dpi : 0); // 中/低质量关闭光晕
      if (blur > 0) {
        ctx.shadowColor = `hsla(${this.hue}, 85%, 64%, ${Math.min(0.9, a)})`;
        ctx.shadowBlur = blur; // 低质量时关闭或降低光晕以提升性能
      }
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  class PopupText {
    constructor(x, y, text = '我爱小璐子') {
      this.x = x;
      this.y = y;
      this.alpha = 1;
      this.scale = 1;
      this.text = text;
      this.decay = 0.02;
      this.vy = -0.6 * dpi;
    }
    update(dt) {
      this.y += this.vy * dt;
      this.scale += 0.008 * dt;
      this.alpha -= this.decay * dt * 0.06;
      return this.alpha > 0;
    }
    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.alpha);
      ctx.translate(this.x, this.y);
      ctx.scale(this.scale, this.scale);
      ctx.fillStyle = '#d75a8f'; // 更深更柔的粉色
      ctx.strokeStyle = 'rgba(180, 70, 120, 0.45)'; // 减弱描边亮度
      ctx.lineWidth = 1.2 * dpi;
      ctx.font = `bold ${Math.round(16 * dpi)}px "Comic Neue", "Comic Sans MS", "Chalkboard SE", system-ui, -apple-system, Segoe UI, Microsoft YaHei, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText(this.text, 0, 0);
      ctx.fillText(this.text, 0, 0);
      ctx.restore();
    }
  }

  function spawnFirework(px, py) {
    // 触发冷却，避免极短时间内大量触发导致卡顿
    const nowTs = performance.now();
    if (nowTs - lastSpawnTs < 240) return; // 延长冷却，限制触发频率
    lastSpawnTs = nowTs;
    if (reduceMotion) {
      // 无动画偏好时仅显示文字浮层（DOM），降低CPU使用
      const node = document.createElement('div');
      node.textContent = '我爱小璐子';
      node.style.position = 'fixed';
      node.style.left = `${px / dpi}px`;
      node.style.top = `${py / dpi}px`;
      node.style.transform = 'translate(-50%, -50%)';
      node.style.color = '#fff';
      node.style.fontSize = '20px';
      node.style.pointerEvents = 'none';
      node.style.transition = 'opacity 600ms ease, transform 600ms ease';
      node.style.opacity = '1';
      node.style.zIndex = '2';
      document.body.appendChild(node);
      requestAnimationFrame(() => {
        node.style.opacity = '0';
        node.style.transform = 'translate(-50%, -60%)';
      });
      setTimeout(() => node.remove(), 800);
      return;
    }

    const scale = (quality === 0 ? 1 : quality === 1 ? 0.4 : 0.2);
    const count = Math.round((window.innerWidth < 480 ? 24 : 50) * scale);
    for (let i = 0; i < count; i++) particles.push(new Particle(px, py));
    // 限制同时存在的文字浮层数量，低质量更少
    const textLimit = (quality === 0 ? 12 : quality === 1 ? 8 : 5);
    if (quality < 2 && texts.length < textLimit) {
      texts.push(new PopupText(px, py));
    }
    playCute(px, py);
  }

  // 渐隐消失与加色叠加实现尾迹
  function fadeCanvas() {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = `rgba(0, 0, 0, 0.18)`; // 更快淡出，减少累计像素覆盖
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over'; // 始终使用更便宜的复合模式
  }

  function step(now) {
    frameDt = now - lastTime;
    lastTime = now;
    fadeCanvas();

    // 更新与绘制粒子（倒序以便 O(1) 删除）
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (!p.update(frameDt)) {
        particles[i] = particles[particles.length - 1];
        particles.pop();
        continue;
      }
      p.draw(ctx);
    }

    // 绘制文字弹出
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      if (!t.update(frameDt)) {
        texts[i] = texts[texts.length - 1];
        texts.pop();
        continue;
      }
      t.draw(ctx);
    }

    // 自适应性能：根据帧耗时调整质量等级与总粒子上限
    if (frameDt > 22) {
      perfScore = Math.min(10, perfScore + 1);
    } else if (frameDt < 16 && particles.length < (quality === 0 ? 800 : quality === 1 ? 600 : 420) - 100) {
      perfScore = Math.max(-10, perfScore - 1);
    }
    if (perfScore >= 4 && quality < 2) { quality++; perfScore = 0; }
    if (perfScore <= -4 && quality > 0) { quality--; perfScore = 0; }

    const maxLimit = (quality === 0 ? 500 : quality === 1 ? 300 : 160);
    if (particles.length > maxLimit) particles.length = maxLimit;

    // 仅在页面可见时继续动画循环，减少后台资源占用
    if (!document.hidden) {
      rafId = requestAnimationFrame(step);
    }
  }
  rafId = requestAnimationFrame(step);

  // 页面可见性切换时暂停/恢复动画
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    } else {
      lastTime = performance.now();
      rafId = requestAnimationFrame(step);
    }
  });

  // 事件：点击与触摸
  function toCanvasCoords(e) {
    const x = ('touches' in e && e.touches[0] ? e.touches[0].clientX : e.clientX) * dpi;
    const y = ('touches' in e && e.touches[0] ? e.touches[0].clientY : e.clientY) * dpi;
    return { x, y };
  }

  // 触摸/点击去重：移动端一次触摸通常会触发 click
  let lastTouchTime = 0;
  document.addEventListener('click', (e) => {
    if (Date.now() - lastTouchTime < 500) return; // 500ms 内忽略由触摸导致的 click
    const { x, y } = toCanvasCoords(e);
    spawnFirework(x, y);
  }, { passive: true });
  document.addEventListener('touchstart', (e) => {
    lastTouchTime = Date.now();
    const { x, y } = toCanvasCoords(e);
    spawnFirework(x, y);
  }, { passive: true });

  // WeChat 音频解锁：在 WeixinJSBridgeReady 触发时，执行一次零音量播放解锁音频
  let audioCtx = null;
  
  // 可爱音效：WebAudio 生成轻快的“叮咚/泡泡”声
  function ensureAudio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  // 首次触摸也尝试解锁音频（iOS/WeChat 常见限制）
  window.addEventListener('touchend', () => {
    const ctxA = ensureAudio();
    if (!ctxA) return;
  }, { once: true, passive: true });

  if (isWeChat) {
    document.addEventListener('WeixinJSBridgeReady', () => {
      const ctxA = ensureAudio();
      if (!ctxA) return;
      const t = ctxA.currentTime;
      const osc = ctxA.createOscillator();
      const gain = ctxA.createGain();
      gain.gain.setValueAtTime(0, t);
      osc.connect(gain).connect(ctxA.destination);
      osc.start(t);
      osc.stop(t + 0.01);
    }, { once: true });
  }

  function playCute(px, py) {
    // 低质量时关闭音效，进一步降低 CPU/音频节点开销
    if (quality === 2) return;
    const ctxA = ensureAudio();
    if (!ctxA) return;
    const t = ctxA.currentTime;

    // 立体声：根据点击位置左右声道偏移
    const panVal = ((px / canvas.width) - 0.5) * 0.8;
    const panner = (ctxA.createStereoPanner ? ctxA.createStereoPanner() : null);
    if (panner) panner.pan.value = panVal;

    // 主泡泡音
    const osc1 = ctxA.createOscillator();
    const gain1 = ctxA.createGain();
    osc1.type = 'sine';
    const f0 = 700 + Math.random() * 300; // 可爱清亮音色
    osc1.frequency.setValueAtTime(f0, t);
    osc1.frequency.exponentialRampToValueAtTime(f0 * 1.6, t + 0.08);
    gain1.gain.setValueAtTime(0.0001, t);
    gain1.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    // 伴随高音点缀
    const osc2 = ctxA.createOscillator();
    const gain2 = ctxA.createGain();
    osc2.type = 'triangle';
    const f1 = f0 * 2.2;
    osc2.frequency.setValueAtTime(f1, t);
    gain2.gain.setValueAtTime(0.0001, t);
    gain2.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    // 连接音频节点
    if (panner) {
      osc1.connect(gain1).connect(panner).connect(ctxA.destination);
      osc2.connect(gain2).connect(panner).connect(ctxA.destination);
    } else {
      osc1.connect(gain1).connect(ctxA.destination);
      osc2.connect(gain2).connect(ctxA.destination);
    }

    osc1.start(t); osc1.stop(t + 0.4);
    osc2.start(t); osc2.stop(t + 0.3);
  }
})();