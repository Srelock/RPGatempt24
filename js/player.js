const GRAVITY = 2100;
const MOVE_SPEED = 320;
const MAX_FALL = 1400;
const CLIMB_SPEED = 190;
const ATTACK_TIME = 0.22;
const ATTACK_CD = 0.42;

function createPlayer(x, y, clips) {
  return {
    x: x,
    y: y,
    w: 52,
    h: 66,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1,
    anim: createAnim(clips, "idle"),
    alive: true,
    walkTo: null,
    walkMarkY: null,
    pendingInteract: null,
    huntTarget: null,
    manualWalk: false,
    hp: 1,
    maxHp: 1,
    iframes: 0,
    climbing: false,
    swing: 0,
    swingCd: 0,
    swingHits: {},
    levelFlash: 0,
  };
}

function playerClipName(player) {
  if (player.climbing) {
    return "jump";
  }
  if (!player.onGround) {
    return "fall";
  }
  if (Math.abs(player.vx) > 25) {
    return "walk";
  }
  return "idle";
}

function attackBox(player) {
  const w = 48;
  const h = 46;
  const x = player.facing > 0 ? player.x + player.w - 10 : player.x - w + 10;
  return { x: x, y: player.y + 12, w: w, h: h };
}

function tryStartAttack(player, keepWalk) {
  if (player.swingCd > 0 || player.swing > 0) {
    return false;
  }
  player.swing = ATTACK_TIME;
  player.swingCd = ATTACK_CD;
  player.swingHits = {};
  player.climbing = false;
  if (!keepWalk) {
    player.walkTo = null;
    player.pendingInteract = null;
    player.huntTarget = null;
  }
  return true;
}

function updatePlayer(player, input, solids, ropes, dt) {
  if (input.attackPressed) {
    tryStartAttack(player);
  }
  if (player.swingCd > 0) {
    player.swingCd = Math.max(0, player.swingCd - dt);
  }
  if (player.swing > 0) {
    player.swing = Math.max(0, player.swing - dt);
  }
  if (player.levelFlash > 0) {
    player.levelFlash = Math.max(0, player.levelFlash - dt);
  }

  const left = input.left;
  const right = input.right;
  if (left || right || input.up || input.down || input.attackPressed) {
    player.walkTo = null;
    player.pendingInteract = null;
    player.walkJustArrived = false;
  }

  const rope = touchingRope(player, ropes, input.down, player.climbing);
  if (rope && (input.up || input.down)) {
    if (!player.climbing && input.down && ropeAtFeet(player, rope)) {
      player.y = rope.y - player.h + 24;
    }
    player.climbing = true;
    player.onGround = false;
  }
  if (player.climbing && !rope) {
    player.climbing = false;
  }

  const speed = player.climbing ? 0 : moveSpeed();
  if (player.climbing) {
    player.vx = 0;
  } else if (left && !right) {
    player.vx = -speed;
    player.facing = -1;
  } else if (right && !left) {
    player.vx = speed;
    player.facing = 1;
  } else if (player.walkTo !== null) {
    const dest = player.walkTo - player.w / 2;
    const dx = dest - player.x;
    if (Math.abs(dx) <= 10) {
      player.vx = 0;
      player.walkTo = null;
      player.walkJustArrived = true;
    } else {
      player.vx = dx > 0 ? speed : -speed;
      player.facing = dx > 0 ? 1 : -1;
    }
  } else {
    player.vx = 0;
  }

  const beforeX = player.x;
  if (player.climbing && rope) {
    player.x = rope.x + rope.w / 2 - player.w / 2;
    if (input.up && !input.down) {
      player.vy = -CLIMB_SPEED;
    } else if (input.down && !input.up) {
      player.vy = CLIMB_SPEED;
    } else {
      player.vy = 0;
    }
    player.y += player.vy * dt;
    const mountY = rope.y - player.h;
    const dropY = rope.y + rope.h - player.h;
    if (input.up && player.y <= mountY + 6) {
      player.y = mountY;
      player.vy = 0;
      player.climbing = false;
      player.onGround = true;
    } else if (player.y > dropY) {
      player.y = dropY;
      if (input.down) {
        player.climbing = false;
        player.vy = 80;
      }
    }
  } else {
    player.vy = Math.min(MAX_FALL, player.vy + GRAVITY * dt);
    moveWithCollisions(player, solids, dt);
  }

  if (player.walkTo !== null && player.onGround && Math.abs(player.x - beforeX) < 0.4) {
    const dest = player.walkTo - player.w / 2;
    if (Math.abs(dest - player.x) > 10) {
      player.walkTo = null;
      player.vx = 0;
      player.pendingInteract = null;
      player.walkJustArrived = false;
    }
  }
  playClip(player.anim, playerClipName(player));
  updateAnim(player.anim, dt);
}

function drawSprite(ctx, img, x, y, w, h, flip) {
  if (!img) {
    return;
  }
  ctx.save();
  if (flip) {
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, w, h);
  } else {
    ctx.drawImage(img, x, y, w, h);
  }
  ctx.restore();
}

function drawWalkMarker(ctx, player) {
  if (player.walkTo === null) {
    return;
  }
  const x = player.walkTo;
  const y = player.walkMarkY;
  ctx.save();
  ctx.fillStyle = "rgba(232, 197, 122, 0.9)";
  ctx.beginPath();
  ctx.ellipse(x, y, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff8e8";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y - 22);
  ctx.lineTo(x - 7, y - 10);
  ctx.lineTo(x + 7, y - 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawSwordSwing(ctx, player) {
  if (player.swing <= 0 || !sprites.itemSword) {
    return;
  }
  const t = 1 - player.swing / ATTACK_TIME;
  const ang = player.facing > 0 ? -1.05 + t * 2.1 : Math.PI + 1.05 - t * 2.1;
  const px = player.facing > 0 ? player.x + player.w - 2 : player.x + 2;
  const py = player.y + 30;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(ang);
  ctx.drawImage(sprites.itemSword, -10, -44, 30, 50);
  ctx.restore();
}

function drawPlayer(ctx, player) {
  const img = currentFrame(player.anim);
  const padX = 10;
  const padY = 8;
  ctx.save();
  if (player.iframes > 0 && Math.floor(player.iframes * 14) % 2 === 0) {
    ctx.globalAlpha = 0.35;
  }
  drawSprite(
    ctx,
    img,
    player.x - padX,
    player.y - padY,
    player.w + padX * 2,
    player.h + padY * 2,
    player.facing < 0
  );
  ctx.restore();
  drawSwordSwing(ctx, player);
}
