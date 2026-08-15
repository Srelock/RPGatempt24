const TILE = 64;

const ENEMY_DEFS = {
  slime: {
    clips: "slime",
    hp: 6,
    w: 48,
    h: 44,
    vx: 70,
    patrol: 90,
    xp: 10,
    coins: 2,
    ox: 8,
    oy: 12,
    padX: 6,
    padY: 8,
    tint: "",
  },
  fox: {
    clips: "fox",
    hp: 10,
    w: 50,
    h: 58,
    vx: 90,
    patrol: 110,
    xp: 18,
    coins: 4,
    ox: 6,
    oy: 4,
    padX: 8,
    padY: 10,
    tint: "",
  },
  bat: {
    clips: "slime",
    hp: 8,
    w: 40,
    h: 36,
    vx: 125,
    patrol: 130,
    xp: 14,
    coins: 3,
    ox: 12,
    oy: 20,
    padX: 6,
    padY: 8,
    tint: "hue-rotate(260deg) saturate(1.45)",
  },
  bear: {
    clips: "fox",
    hp: 16,
    w: 62,
    h: 68,
    vx: 55,
    patrol: 80,
    xp: 26,
    coins: 6,
    ox: 2,
    oy: 0,
    padX: 8,
    padY: 10,
    tint: "hue-rotate(-18deg) saturate(1.25) brightness(0.78)",
  },
};

const EXIT_CELLS = {
  "1": "wilds",
  "2": "grove",
  "3": "caves",
  "4": "ridge",
};

function groundMap(width, marks) {
  const sky = " ".repeat(width);
  const play = Array.from({ length: width }, () => " ");
  Object.keys(marks).forEach((key) => {
    const index = Number(key);
    if (index >= 0 && index < width) {
      play[index] = marks[key];
    }
  });
  const rows = [];
  for (let i = 0; i < 8; i += 1) {
    rows.push(sky);
  }
  rows.push(play.join(""));
  rows.push("#".repeat(width));
  return rows;
}

const TOWN_ROWS = [
  "                  ",
  "                  ",
  "                  ",
  "                  ",
  "                  ",
  "                  ",
  "                  ",
  "                  ",
  " P G B C  1 2 3 4 ",
  "##################",
];

const MAPS = {
  town: { title: "Town", sign: "TOWN", enemy: null, rows: TOWN_ROWS },
  wilds: {
    title: "Wilds",
    sign: "WILDS",
    enemy: "slime",
    rows: groundMap(72, {
      1: "P",
      8: "o",
      14: "E",
      22: "o",
      30: "E",
      38: "o",
      46: "E",
      54: "o",
      62: "E",
      70: "W",
    }),
  },
  grove: {
    title: "Grove",
    sign: "GROVE",
    enemy: "fox",
    rows: groundMap(80, {
      1: "P",
      8: "o",
      16: "E",
      24: "o",
      34: "E",
      44: "o",
      54: "E",
      64: "o",
      72: "E",
      78: "W",
    }),
  },
  caves: {
    title: "Caves",
    sign: "CAVES",
    enemy: "bat",
    rows: groundMap(84, {
      1: "P",
      8: "o",
      14: "E",
      22: "o",
      30: "E",
      38: "o",
      46: "E",
      54: "o",
      62: "E",
      70: "o",
      76: "E",
      82: "W",
    }),
  },
  ridge: {
    title: "Ridge",
    sign: "RIDGE",
    enemy: "bear",
    rows: groundMap(88, {
      1: "P",
      10: "o",
      18: "E",
      30: "o",
      40: "E",
      52: "o",
      62: "E",
      74: "o",
      80: "E",
      86: "W",
    }),
  },
};

function mapDef(mapId) {
  return MAPS[mapId] || MAPS.town;
}

function isTownMap(mapId) {
  return mapId === "town";
}

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
      } else if (cell === "E") {
        const kind = mapDef(mapId).enemy || "slime";
        enemies.push(createEnemy(x, y, kind));
      } else if (cell === "P") {
        start = { x: x, y: y };
      } else if (cell === "G") {
        spots.push(makeSpot("general", "General Store", x, y));
      } else if (cell === "B") {
        spots.push(makeSpot("forge", "Blacksmith's Forge", x, y));
      } else if (cell === "C") {
        spots.push(makeSpot("chest", "Storage Chest", x, y));
      } else if (EXIT_CELLS[cell]) {
        const dest = EXIT_CELLS[cell];
        spots.push(makeSpot("exit", "Path to the " + mapDef(dest).title, x, y, dest));
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

function makeSpot(kind, label, x, y, dest) {
  const wide = kind === "chest" ? 56 : 88;
  return {
    kind: kind,
    label: label,
    dest: dest || null,
    x: x - 12,
    y: y,
    w: wide,
    h: TILE,
  };
}

function createEnemy(x, y, kind) {
  const def = ENEMY_DEFS[kind] || ENEMY_DEFS.slime;
  return {
    kind: kind,
    x: x + def.ox,
    y: y + def.oy,
    w: def.w,
    h: def.h,
    vx: def.vx,
    vy: 0,
    originX: x + def.ox,
    patrol: def.patrol,
    alive: true,
    facing: 1,
    anim: null,
    hp: def.hp,
    maxHp: def.hp,
    xp: def.xp,
    coins: def.coins,
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
