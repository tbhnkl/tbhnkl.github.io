(() => {
  const canvas = document.getElementById('field');
  const ctx = canvas.getContext('2d');
  const scoreYouEl = document.getElementById('scoreYou');
  const scoreCpuEl = document.getElementById('scoreCpu');
  const timerEl = document.getElementById('timer');
  const messageEl = document.getElementById('message');

  const GRAVITY = 1800;
  const GROUND_RATIO = 0.82;
  const MATCH_SECONDS = 60;

  let width = 0, height = 0, groundY = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    groundY = height * GROUND_RATIO;
    layoutField();
  }

  let goalHeight, goalLineLeft, goalLineRight, goalDepth;

  function layoutField() {
    goalHeight = Math.max(90, height * 0.22);
    goalDepth = Math.max(22, width * 0.035);
    goalLineLeft = goalDepth;
    goalLineRight = width - goalDepth;
  }

  const input = { left: false, right: false, jump: false, kickPressed: false };

  const player = makeActor(0, 1, '#2d6cdf');
  const cpu = makeActor(0, -1, '#e0473c');
  const ball = { x: 0, y: 0, vx: 0, vy: 0, r: 16 };

  function makeActor(dummyX, facing, color) {
    return {
      x: 0, y: 0, vy: 0,
      onGround: true,
      facing,
      w: 46, h: 92,
      speed: 260,
      jumpPower: 780,
      kickCooldown: 0,
      kickAnim: 0,
      jumpCooldown: 0,
      reactionTimer: 0,
      color,
    };
  }

  function resetPositions(kickoffFor) {
    player.x = width * 0.28;
    player.y = groundY;
    player.vy = 0;
    player.onGround = true;
    player.facing = 1;

    cpu.x = width * 0.72;
    cpu.y = groundY;
    cpu.vy = 0;
    cpu.onGround = true;
    cpu.facing = -1;

    ball.x = width / 2;
    ball.y = groundY - ball.r;
    // Ball drifts toward whoever conceded, giving them first touch (not the scorer).
    ball.vx = kickoffFor === 'cpu' ? 60 : (kickoffFor === 'player' ? -60 : 0);
    ball.vy = 0;

    cpu.reactionTimer = 0.4;
  }

  let scoreYou = 0, scoreCpu = 0, timeLeft = MATCH_SECONDS;
  let gameOver = false;
  let lastTime = 0;

  function updateHud() {
    scoreYouEl.textContent = scoreYou;
    scoreCpuEl.textContent = scoreCpu;
    const m = Math.floor(timeLeft / 60);
    const s = Math.floor(timeLeft % 60);
    timerEl.textContent = m + ':' + String(s).padStart(2, '0');
  }

  function showMessage(text) {
    messageEl.textContent = text;
    messageEl.classList.remove('hidden');
  }
  function hideMessage() {
    messageEl.classList.add('hidden');
  }

  function goalScored(scorer) {
    if (scorer === 'player') scoreYou++; else scoreCpu++;
    updateHud();
    gameOver = true;
    showMessage((scorer === 'player' ? 'GOAL! You score' : 'GOAL! CPU scores'));
    setTimeout(() => {
      if (timeLeft <= 0) return;
      resetPositions(scorer === 'player' ? 'cpu' : 'player');
      hideMessage();
      gameOver = false;
    }, 1200);
  }

  function endMatch() {
    gameOver = true;
    let text;
    if (scoreYou > scoreCpu) text = 'You Win! ' + scoreYou + ' - ' + scoreCpu;
    else if (scoreCpu > scoreYou) text = 'CPU Wins ' + scoreCpu + ' - ' + scoreYou;
    else text = 'Draw ' + scoreYou + ' - ' + scoreCpu;
    showMessage(text + '\nTap to play again');
  }

  function restartMatch() {
    scoreYou = 0;
    scoreCpu = 0;
    timeLeft = MATCH_SECONDS;
    gameOver = false;
    updateHud();
    hideMessage();
    resetPositions(null);
  }

  messageEl.addEventListener('click', () => {
    if (timeLeft <= 0) restartMatch();
  });
  messageEl.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (timeLeft <= 0) restartMatch();
  });

  function updateActorPhysics(a, dt, moveLeft, moveRight, jump) {
    if (moveLeft && !moveRight) {
      a.x -= a.speed * dt;
      a.facing = -1;
    } else if (moveRight && !moveLeft) {
      a.x += a.speed * dt;
      a.facing = 1;
    }
    a.x = Math.max(a.w / 2 + 4, Math.min(width - a.w / 2 - 4, a.x));

    if (jump && a.onGround) {
      a.vy = -a.jumpPower;
      a.onGround = false;
    }
    a.vy += GRAVITY * dt;
    a.y += a.vy * dt;
    if (a.y >= groundY) {
      a.y = groundY;
      a.vy = 0;
      a.onGround = true;
    }
    if (a.kickCooldown > 0) a.kickCooldown -= dt;
    if (a.kickAnim > 0) a.kickAnim -= dt;
  }

  function tryKick(a, isPlayer) {
    if (a.kickCooldown > 0) return;
    const dx = ball.x - a.x;
    const dy = ball.y - (a.y - a.h * 0.5);
    const reachX = 56;
    const reachY = 70;
    if (Math.abs(dx) < reachX && Math.abs(dy) < reachY) {
      const dir = a.facing;
      ball.vx = dir * (isPlayer ? 620 : 480);
      ball.vy = -560;
      a.kickCooldown = 0.35;
      a.kickAnim = 0.22;
    }
  }

  function actorBallCollision(a) {
    // Right after a kick, let the kick's velocity fly clean instead of
    // immediately fighting it with the passive dribble push below.
    if (a.kickCooldown > 0.2) return;

    const left = a.x - a.w / 2, right = a.x + a.w / 2;
    const top = a.y - a.h, bottom = a.y;
    const insideX = ball.x > left && ball.x < right;
    const insideY = ball.y > top && ball.y < bottom;

    let nx, ny, overlap;
    if (insideX && insideY) {
      // Ball's center is inside the body box: push out along whichever
      // edge is closest instead of the ambiguous (0,0) normal you'd get
      // from the closest-point method below.
      const distLeft = ball.x - left, distRight = right - ball.x;
      const distTop = ball.y - top, distBottom = bottom - ball.y;
      const minX = Math.min(distLeft, distRight);
      const minY = Math.min(distTop, distBottom);
      if (minX < minY) {
        nx = distLeft < distRight ? -1 : 1;
        ny = 0;
        overlap = minX + ball.r;
      } else {
        nx = 0;
        ny = distTop < distBottom ? -1 : 1;
        overlap = minY + ball.r;
      }
    } else {
      const closestX = Math.max(left, Math.min(ball.x, right));
      const closestY = Math.max(top, Math.min(ball.y, bottom));
      const dx = ball.x - closestX;
      const dy = ball.y - closestY;
      const distSq = dx * dx + dy * dy;
      if (distSq >= ball.r * ball.r) return;
      const dist = Math.sqrt(distSq) || 0.01;
      nx = dx / dist;
      ny = dy / dist;
      overlap = ball.r - dist;
    }

    ball.x += nx * overlap;
    ball.y += ny * overlap;
    const pushSpeed = 140;
    ball.vx += nx * pushSpeed;
    ball.vy += ny * pushSpeed;
  }

  function updateBall(dt) {
    ball.vy += GRAVITY * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.vx *= 0.995;

    if (ball.y + ball.r > groundY) {
      ball.y = groundY - ball.r;
      ball.vy *= -0.55;
      ball.vx *= 0.85;
      if (Math.abs(ball.vy) < 40) ball.vy = 0;
    }

    if (ball.x - ball.r < 0) {
      ball.x = ball.r;
      ball.vx *= -0.6;
    }
    if (ball.x + ball.r > width) {
      ball.x = width - ball.r;
      ball.vx *= -0.6;
    }
  }

  function checkGoals() {
    const inOpening = ball.y + ball.r > groundY - goalHeight;
    if (inOpening && ball.x - ball.r < goalLineLeft) {
      goalScored('cpu');
      return true;
    }
    if (inOpening && ball.x + ball.r > goalLineRight) {
      goalScored('player');
      return true;
    }
    return false;
  }

  function updateCpuAI(dt) {
    if (cpu.reactionTimer > 0) {
      cpu.reactionTimer -= dt;
      updateActorPhysics(cpu, dt, false, false, false);
      return;
    }

    const dx = ball.x - cpu.x;
    const engageDist = 30;
    let moveLeft = false, moveRight = false;

    const ballComingToCpuSide = ball.x > width * 0.42;
    if (ballComingToCpuSide) {
      if (dx > engageDist) moveRight = true;
      else if (dx < -engageDist) moveLeft = true;
    } else {
      const homeX = width * 0.72;
      const hdx = homeX - cpu.x;
      if (hdx > engageDist) moveRight = true;
      else if (hdx < -engageDist) moveLeft = true;
    }

    let jump = false;
    if (cpu.onGround && cpu.jumpCooldown <= 0 && ball.y < groundY - 95 && Math.abs(dx) < 55 && ball.vy > -200 && ball.vy < 260) {
      jump = true;
      cpu.jumpCooldown = 0.7;
    }
    if (cpu.jumpCooldown > 0) cpu.jumpCooldown -= dt;

    updateActorPhysics(cpu, dt, moveLeft, moveRight, jump);

    if (Math.abs(dx) < 60 && Math.abs(ball.y - cpu.y) < 90) {
      cpu.facing = ball.x < cpu.x ? -1 : 1;
      tryKick(cpu, false);
    }
  }

  function updatePlayer(dt) {
    updateActorPhysics(player, dt, input.left, input.right, input.jump);
    if (input.kickPressed) {
      tryKick(player, true);
      input.kickPressed = false;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
    skyGrad.addColorStop(0, '#8fd3ff');
    skyGrad.addColorStop(1, '#cdeeff');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, groundY);

    ctx.fillStyle = '#1f8a3b';
    ctx.fillRect(0, groundY, width, height - groundY);

    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 10; i++) {
      const bandW = width / 10;
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(i * bandW, groundY, bandW, height - groundY);
      }
    }
    ctx.beginPath();
    ctx.moveTo(width / 2, groundY);
    ctx.lineTo(width / 2, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(width / 2, groundY, 50, 0, Math.PI * 2);
    ctx.stroke();

    drawGoal(goalLineLeft, true);
    drawGoal(goalLineRight, false);

    drawActor(cpu);
    drawActor(player);
    drawBall();
  }

  function drawGoal(lineX, isLeft) {
    const topY = groundY - goalHeight;
    const backX = isLeft ? lineX - goalDepth : lineX + goalDepth;

    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const step = goalHeight / 6;
    for (let i = 1; i < 6; i++) {
      ctx.moveTo(Math.min(lineX, backX), topY + i * step);
      ctx.lineTo(Math.max(lineX, backX), topY + i * step);
    }
    ctx.stroke();

    ctx.strokeStyle = '#f5f5f5';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(lineX, groundY);
    ctx.lineTo(lineX, topY);
    ctx.lineTo(backX, topY);
    ctx.lineTo(backX, groundY);
    ctx.stroke();
  }

  function drawActor(a) {
    ctx.save();
    ctx.translate(a.x, a.y);

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 4, a.w * 0.5, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    const legSwing = a.kickAnim > 0 ? Math.sin((0.22 - a.kickAnim) / 0.22 * Math.PI) : 0;
    const kickDir = a.facing;

    ctx.strokeStyle = '#222';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-8, -a.h * 0.42);
    ctx.lineTo(-8, -6);
    ctx.moveTo(8, -a.h * 0.42);
    ctx.lineTo(8 + legSwing * 22 * kickDir, -6 - legSwing * 10);
    ctx.stroke();

    ctx.fillStyle = a.color;
    ctx.beginPath();
    ctx.roundRect(-a.w * 0.35, -a.h * 0.95, a.w * 0.7, a.h * 0.55, 10);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(a.facing * 4, -a.h * 0.95 - 14, 15, 0, Math.PI * 2);
    ctx.fillStyle = '#f2c199';
    ctx.fill();

    ctx.restore();
  }

  function drawBall() {
    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 0, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-ball.r * 0.5, -ball.r * 0.2);
    ctx.lineTo(ball.r * 0.5, -ball.r * 0.2);
    ctx.lineTo(0, ball.r * 0.5);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function loop(ts) {
    if (!lastTime) lastTime = ts;
    let dt = (ts - lastTime) / 1000;
    lastTime = ts;
    if (dt > 0.05) dt = 0.05;

    if (!gameOver) {
      timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        updateHud();
        endMatch();
      } else {
        updatePlayer(dt);
        updateCpuAI(dt);
        updateBall(dt);
        actorBallCollision(player);
        actorBallCollision(cpu);
        updateHud();
        checkGoals();
      }
    }

    draw();
    requestAnimationFrame(loop);
  }

  function bindHoldButton(el, onDown, onUp) {
    const down = (e) => { e.preventDefault(); el.classList.add('pressed'); onDown(); };
    const up = (e) => { e.preventDefault(); el.classList.remove('pressed'); onUp(); };
    el.addEventListener('touchstart', down, { passive: false });
    el.addEventListener('touchend', up, { passive: false });
    el.addEventListener('touchcancel', up, { passive: false });
    el.addEventListener('mousedown', down);
    el.addEventListener('mouseup', up);
    el.addEventListener('mouseleave', up);
  }

  bindHoldButton(document.getElementById('btnLeft'),
    () => input.left = true, () => input.left = false);
  bindHoldButton(document.getElementById('btnRight'),
    () => input.right = true, () => input.right = false);
  bindHoldButton(document.getElementById('btnJump'),
    () => input.jump = true, () => input.jump = false);

  const kickBtn = document.getElementById('btnKick');
  kickBtn.addEventListener('touchstart', (e) => { e.preventDefault(); kickBtn.classList.add('pressed'); input.kickPressed = true; }, { passive: false });
  kickBtn.addEventListener('touchend', (e) => { e.preventDefault(); kickBtn.classList.remove('pressed'); }, { passive: false });
  kickBtn.addEventListener('mousedown', () => { kickBtn.classList.add('pressed'); input.kickPressed = true; });
  kickBtn.addEventListener('mouseup', () => kickBtn.classList.remove('pressed'));

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = true;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') input.jump = true;
    if (e.code === 'KeyK' || e.code === 'Enter') input.kickPressed = true;
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = false;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') input.jump = false;
  });

  window.addEventListener('resize', resize);
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  resize();
  updateHud();
  resetPositions(null);
  requestAnimationFrame(loop);
})();
