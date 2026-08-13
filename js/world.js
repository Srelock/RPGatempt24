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
  "                          o                                             o       ",
  "                        ####                                          ####      ",
  "                                    o     o                                     ",
  "        o             o           ####  ###             o                       ",
  "      ####                  S                   S     ####                      ",
  "      o             ##### ###                 #######           o     o         ",
  "P                      F                     S                                  W",
  "##############  ##############  ##############  ################################",
];

function parseLevel(rows, mapId) {
  const solids = [];
  const coins = [];
  const enemies = [];
  const spots = [];
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
  };
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
