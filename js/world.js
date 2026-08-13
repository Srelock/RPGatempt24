const TILE = 64;

const TOWN_ROWS = [
  "               ",
  "               ",
  "               ",
  "               ",
  "               ",
  "               ",
  "               ",
  "               ",
  " P  G  B  C   X",
  "###############",
];

const WILDS_ROWS = [
  "                                                                                ",
  "                                                                                ",
  "                         o                      o                         o     ",
  "                       ####                   ####                      ####    ",
  "                         |                      |                         |     ",
  "       o                 |      o     o         |            o            |     ",
  "     ####                |    ####  ###         |          ####           |     ",
  "       |      o          |      |     |         |      ######  |    o     |     ",
  "P      |              F  |      |  S  |      S  |              |          |    W",
  "##############  ##############  ##############  ################################",
];

function parseLevel(rows, mapId) {
  const solids = [];
  const coins = [];
  const enemies = [];
  const spots = [];
  const ropeCells = [];
  let start = { x: TILE, y: TILE };
  let goal = null;

  rows.forEach((row, ty) => {
    [...row].forEach((cell, tx) => {
      const x = tx * TILE;
      const y = ty * TILE;
      if (cell === "#") {
        solids.push({ x: x, y: y, w: TILE, h: TILE });
      } else if (cell === "o") {
        coins.push({ x: x + 16, y: y + 16, w: 32, h: 32, taken: false });
      } else if (cell === "|") {
        ropeCells.push({ x: x + 24, y: y, w: 16, h: TILE });
      } else if (cell === "S") {
        enemies.push(createEnemy(x + 8, y + 12, "slime"));
      } else if (cell === "F") {
        enemies.push(createEnemy(x + 6, y + 4, "fox"));
      } else if (cell === "P") {
        start = { x: x, y: y };
      } else if (cell === "G") {
        spots.push(makeSpot("general", "General Store", x, y));
      } else if (cell === "B") {
        spots.push(makeSpot("forge", "Blacksmith's Forge", x, y));
      } else if (cell === "C") {
        spots.push(makeSpot("chest", "Storage Chest", x, y));
      } else if (cell === "X") {
        spots.push(makeSpot("exit", "Path to the Wilds", x, y));
      } else if (cell === "W") {
        goal = { x: x + 16, y: y - 32, w: 28, h: TILE + 32 };
      }
    });
  });

  return {
    mapId: mapId,
    cols: rows[0].length,
    rows: rows.length,
    width: rows[0].length * TILE,
    height: rows.length * TILE,
    solids: solids,
    coins: coins,
    enemies: enemies,
    spots: spots,
    ropes: attachRopesToPlatforms(mergeRopes(ropeCells), solids),
    start: start,
    goal: goal,
    coinTotal: coins.length,
  };
}

function makeSpot(kind, label, x, y) {
  const wide = kind === "chest" ? 56 : 88;
  return {
    kind: kind,
    label: label,
    x: x - 12,
    y: y,
    w: wide,
    h: TILE,
  };
}

function createEnemy(x, y, kind) {
  const fox = kind === "fox";
  const hp = fox ? 10 : 6;
  return {
    kind: kind,
    x: x,
    y: y,
    w: fox ? 50 : 48,
    h: fox ? 58 : 44,
    vx: fox ? 90 : 70,
    vy: 0,
    originX: x,
    patrol: fox ? 110 : 90,
    alive: true,
    facing: 1,
    anim: null,
    hp: hp,
    maxHp: hp,
    xp: fox ? 18 : 10,
    coins: fox ? 4 : 2,
    hurt: 0,
  };
}

function mergeRopes(ropes) {
  const sorted = ropes.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const merged = [];
  sorted.forEach((rope) => {
    const last = merged[merged.length - 1];
    if (last && Math.abs(last.x - rope.x) < 8 && rope.y <= last.y + last.h + 6) {
      last.h = Math.max(last.y + last.h, rope.y + rope.h) - last.y;
      return;
    }
    merged.push({ x: rope.x, y: rope.y, w: rope.w, h: rope.h });
  });
  return merged;
}

function attachRopesToPlatforms(ropes, solids) {
  ropes.forEach((rope) => {
    const cx = rope.x + rope.w / 2;
    let platform = null;
    solids.forEach((solid) => {
      if (cx < solid.x + 2 || cx > solid.x + solid.w - 2) {
        return;
      }
      const bottom = solid.y + solid.h;
      if (Math.abs(bottom - rope.y) > 12) {
        return;
      }
      if (!platform || solid.y < platform.y) {
        platform = solid;
      }
    });
    if (!platform) {
      return;
    }
    const extra = rope.y - platform.y;
    if (extra > 0) {
      rope.h += extra;
      rope.y = platform.y;
    }
  });
  return ropes;
}

function ropeOverlap(body, rope, topSlack) {
  const slack = topSlack || 0;
  const mid = body.x + body.w / 2;
  return (
    mid > rope.x - 14 &&
    mid < rope.x + rope.w + 14 &&
    body.y + body.h > rope.y + 2 - slack &&
    body.y < rope.y + rope.h + 8
  );
}

function ropeAtFeet(body, rope) {
  const mid = body.x + body.w / 2;
  const feet = body.y + body.h;
  return (
    mid > rope.x - 16 &&
    mid < rope.x + rope.w + 16 &&
    feet >= rope.y - 8 &&
    feet <= rope.y + 16
  );
}

function touchingRope(body, ropes, wantDown, climbing) {
  if (!ropes) {
    return null;
  }
  const slack = climbing ? 32 : 0;
  for (let i = 0; i < ropes.length; i += 1) {
    const rope = ropes[i];
    if (ropeOverlap(body, rope, slack)) {
      return rope;
    }
    if (wantDown && ropeAtFeet(body, rope)) {
      return rope;
    }
  }
  return null;
}

function drawRopes(ctx, ropes, camX) {
  const view = ctx.canvas.width;
  ropes.forEach((rope) => {
    if (rope.x + rope.w < camX - 20 || rope.x > camX + view + 20) {
      return;
    }
    const cx = rope.x + rope.w / 2;
    ctx.strokeStyle = "#5a3318";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx, rope.y);
    ctx.lineTo(cx, rope.y + rope.h);
    ctx.stroke();
    ctx.strokeStyle = "#d4a05a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 1.5, rope.y);
    ctx.lineTo(cx - 1.5, rope.y + rope.h);
    ctx.stroke();
    ctx.fillStyle = "#8a5a32";
    for (let y = rope.y + 12; y < rope.y + rope.h - 4; y += 18) {
      ctx.beginPath();
      ctx.arc(cx, y, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function aabbOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function moveWithCollisions(body, solids, dt) {
  body.x += body.vx * dt;
  solids.forEach((solid) => {
    if (!aabbOverlap(body, solid)) {
      return;
    }
    if (body.vx > 0) {
      body.x = solid.x - body.w;
    } else if (body.vx < 0) {
      body.x = solid.x + solid.w;
    }
    body.vx = 0;
  });

  body.onGround = false;
  const prevY = body.y;
  body.y += body.vy * dt;
  solids.forEach((solid) => {
    if (!aabbOverlap(body, solid)) {
      return;
    }
    if (prevY + body.h <= solid.y + 2) {
      body.y = solid.y - body.h;
      body.vy = 0;
      body.onGround = true;
    } else if (prevY >= solid.y + solid.h - 2) {
      body.y = solid.y + solid.h;
      body.vy = 0;
    }
  });
}

function drawTiles(ctx, solids, tileImg, camX) {
  solids.forEach((solid) => {
    if (solid.x + solid.w < camX - TILE || solid.x > camX + ctx.canvas.width + TILE) {
      return;
    }
    ctx.drawImage(tileImg, solid.x, solid.y, solid.w, solid.h);
  });
}

function drawFlag(ctx, goal) {
  if (!goal) {
    return;
  }
  ctx.fillStyle = "#6b4a32";
  ctx.fillRect(goal.x + 6, goal.y, 6, goal.h);
  ctx.fillStyle = "#e85d4c";
  ctx.beginPath();
  ctx.moveTo(goal.x + 12, goal.y + 4);
  ctx.lineTo(goal.x + 42, goal.y + 18);
  ctx.lineTo(goal.x + 12, goal.y + 32);
  ctx.closePath();
  ctx.fill();
}

function spotClickRect(spot) {
  if (spot.kind === "chest") {
    return { x: spot.x, y: spot.y + TILE - 54, w: 56, h: 54 };
  }
  if (spot.kind === "exit") {
    return { x: spot.x + 20, y: spot.y + TILE - 110, w: 90, h: 110 };
  }
  return { x: spot.x - 24, y: spot.y + TILE - 188, w: 150, h: 188 };
}

function hitWorldSpot(worldX, worldY, spots) {
  let found = null;
  spots.forEach((spot) => {
    const rect = spotClickRect(spot);
    if (worldX >= rect.x && worldX <= rect.x + rect.w && worldY >= rect.y && worldY <= rect.y + rect.h) {
      found = spot;
    }
  });
  return found;
}

function nearestSpot(player, spots) {
  let best = null;
  spots.forEach((spot) => {
    if (!aabbOverlap(player, spot)) {
      return;
    }
    best = spot;
  });
  return best;
}
