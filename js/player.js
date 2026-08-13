const GRAVITY = 2100;
const MOVE_SPEED = 320;
const JUMP_SPEED = -760;
const MAX_FALL = 1400;
const COYOTE_TIME = 0.09;
const JUMP_BUFFER = 0.1;

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
    coyote: 0,
    jumpBuffer: 0,
    anim: createAnim(clips, "idle"),
    alive: true,
    walkTo: null,
    walkMarkY: null,
    pendingInteract: null,
    walkJustArrived: false,
  };
}

function playerClipName(player) {
  if (!player.onGround) {
    return player.vy < 0 ? "jump" : "fall";
  }
  if (Math.abs(player.vx) > 25) {
    return "walk";
  }
  return "idle";
}

function updatePlayer(player, input, solids, dt) {
  const left = input.left;
  const right = input.right;
  if (left || right) {
    player.walkTo = null;
    player.pendingInteract = null;
    player.walkJustArrived = false;
  }
  if (left && !right) {
    player.vx = -MOVE_SPEED;
    player.facing = -1;
  } else if (right && !left) {
    player.vx = MOVE_SPEED;
    player.facing = 1;
  } else if (player.walkTo !== null) {
    const dest = player.walkTo - player.w / 2;
    const dx = dest - player.x;
    if (Math.abs(dx) <= 10) {
      player.vx = 0;
      player.walkTo = null;
      player.walkJustArrived = true;
    } else {
      player.vx = dx > 0 ? MOVE_SPEED : -MOVE_SPEED;
      player.facing = dx > 0 ? 1 : -1;
    }
  } else {
    player.vx = 0;
  }

  if (player.onGround) {
    player.coyote = COYOTE_TIME;
  } else {
    player.coyote = Math.max(0, player.coyote - dt);
  }

  if (input.jumpPressed) {
    player.jumpBuffer = JUMP_BUFFER;
  } else {
    player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
  }

  if (player.jumpBuffer > 0 && player.coyote > 0) {
    player.vy = JUMP_SPEED;
    player.onGround = false;
    player.coyote = 0;
    player.jumpBuffer = 0;
  }

  const beforeX = player.x;
  player.vy = Math.min(MAX_FALL, player.vy + GRAVITY * dt);
  moveWithCollisions(player, solids, dt);
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

function drawPlayer(ctx, player) {
  const img = currentFrame(player.anim);
  const padX = 10;
  const padY = 8;
  drawSprite(
    ctx,
    img,
    player.x - padX,
    player.y - padY,
    player.w + padX * 2,
    player.h + padY * 2,
    player.facing < 0
  );
}
