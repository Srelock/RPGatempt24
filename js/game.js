const VIEW_W = 960;
const VIEW_H = 540;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = true;

const input = {
  left: false,
  right: false,
  jumpPressed: false,
  jumpHeld: false,
  interact: false,
  confirm: false,
  back: false,
  up: false,
  down: false,
};

let save = emptySave();
let world = null;
let player = null;
let sprites = null;
let state = "select";
let selectGender = "male";
let activeSpot = null;
let shop = null;
let chestUi = null;
let camX = 0;
let camY = 0;
let lastTime = 0;
let lastPersistAt = 0;
let coinsThisMap = 0;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load " + src));
    img.src = src;
  });
}

async function loadSprites() {
  const names = {
    maleIdle1: "male-idle-1.png",
    maleIdle2: "male-idle-2.png",
    maleWalk1: "male-walk-1.png",
    maleWalk2: "male-walk-2.png",
    maleWalk3: "male-walk-3.png",
    maleWalk4: "male-walk-4.png",
    maleJump: "male-jump.png",
    maleFall: "male-fall.png",
    femaleIdle1: "female-idle-1.png",
    femaleIdle2: "female-idle-2.png",
    femaleWalk1: "female-walk-1.png",
    femaleWalk2: "female-walk-2.png",
    femaleWalk3: "female-walk-3.png",
    femaleWalk4: "female-walk-4.png",
    femaleJump: "female-jump.png",
    femaleFall: "female-fall.png",
    foxWalk1: "player-walk-1.png",
    foxWalk2: "player-walk-2.png",
    foxWalk3: "player-walk-3.png",
    foxWalk4: "player-walk-4.png",
    slime1: "enemy-walk-1.png",
    slime2: "enemy-walk-2.png",
    slime3: "enemy-walk-3.png",
    slime4: "enemy-walk-4.png",
    coin1: "coin-1.png",
    coin2: "coin-2.png",
    coin3: "coin-3.png",
    coin4: "coin-4.png",
    tile: "tile-ground.png",
    tileTown: "tile-town.png",
    background: "background.png",
    townBackground: "town-background.png",
    buildingGeneral: "building-general.png",
    buildingForge: "building-forge.png",
    chestClosed: "chest-closed.png",
    chestOpen: "chest-open.png",
    itemApple: "item-apple.png",
    itemPotion: "item-potion.png",
    itemRope: "item-rope.png",
    itemSword: "item-sword.png",
    itemShield: "item-shield.png",
    itemPickaxe: "item-pickaxe.png",
    uiBackpack: "ui-backpack.png",
    uiLock: "ui-lock.png",
  };
  const loaded = {};
  await Promise.all(
    Object.entries(names).map(async ([key, file]) => {
      loaded[key] = await loadImage("assets/sprites/" + file);
    })
  );
  return loaded;
}

function bindAnims(level) {
  level.enemies.forEach((enemy) => {
    const clips = enemy.kind === "fox" ? foxClips() : slimeClips();
    enemy.anim = createAnim(clips, "walk");
  });
  level.coins.forEach((coin) => {
    coin.anim = createAnim(coinClips(), "spin");
  });
}

function spawnInMap(mapId, spawnX, spawnY) {
  const rows = mapId === "town" ? TOWN_ROWS : WILDS_ROWS;
  world = parseLevel(rows, mapId);
  bindAnims(world);
  const x = Number.isFinite(spawnX) ? spawnX : world.start.x;
  const y = Number.isFinite(spawnY) ? spawnY : world.start.y - 8;
  player = createPlayer(x, y, heroClips(save.gender));
  coinsThisMap = 0;
  state = "play";
  if (mapId === "town") {
    camX = 0;
    camY = Math.max(0, world.height - VIEW_H);
  } else {
    camX = Math.max(0, player.x - VIEW_W * 0.35);
    camY = Math.max(0, world.height - VIEW_H);
  }
  shop = null;
  chestUi = null;
  player.walkTo = null;
  player.walkMarkY = null;
  player.pendingInteract = null;
  player.walkJustArrived = false;
}

function startAdventure() {
  save.gender = selectGender;
  spawnInMap("town");
  persistGame(true);
}

function returnToTown() {
  spawnInMap("town");
  persistGame(true);
}

function persistGame(force) {
  if (!save.gender || !world || !player) {
    return;
  }
  const now = performance.now();
  if (!force && now - lastPersistAt < 1500) {
    return;
  }
  lastPersistAt = now;
  const runState = state === "dead" || state === "win" ? state : "play";
  writeStoredSave({
    version: 1,
    gender: save.gender,
    coins: save.coins,
    packs: save.packs,
    packPage: save.packPage,
    chests: save.chests,
    chestPage: save.chestPage,
    equips: save.equips,
    mapId: world.mapId === "wilds" ? "wilds" : "town",
    playerX: player.x,
    playerY: player.y,
    facing: player.facing,
    coinsTaken: world.coins.map((coin) => !!coin.taken),
    enemiesDead: world.enemies.map((enemy) => !enemy.alive),
    coinsThisMap: coinsThisMap,
    runState: runState,
  });
}

function applyWorldProgress(raw) {
  if (!raw || !world || raw.mapId !== world.mapId) {
    return;
  }
  if (Array.isArray(raw.coinsTaken)) {
    world.coins.forEach((coin, index) => {
      if (raw.coinsTaken[index]) {
        coin.taken = true;
      }
    });
  }
  if (Array.isArray(raw.enemiesDead)) {
    world.enemies.forEach((enemy, index) => {
      if (raw.enemiesDead[index]) {
        enemy.alive = false;
      }
    });
  }
  const taken = Math.floor(Number(raw.coinsThisMap) || 0);
  coinsThisMap = Number.isFinite(taken) && taken > 0 ? taken : 0;
}

function resumeStoredGame() {
  const stored = readStoredSave();
  if (!stored) {
    return false;
  }
  save = stored.save;
  selectGender = save.gender;
  const raw = stored.world;
  const mapId = raw.mapId === "wilds" ? "wilds" : "town";
  const x = Number(raw.playerX);
  const y = Number(raw.playerY);
  spawnInMap(mapId, Number.isFinite(x) ? x : undefined, Number.isFinite(y) ? y : undefined);
  if (raw.facing === -1 || raw.facing === 1) {
    player.facing = raw.facing;
  }
  applyWorldProgress(raw);
  if (raw.runState === "dead" || raw.runState === "win") {
    state = raw.runState;
  }
  return true;
}

function bindInput() {
  window.addEventListener("keydown", (event) => {
    handleKeyDown(event);
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Tab"].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener("keyup", (event) => {
    if (event.code === "ArrowLeft" || event.code === "KeyA") {
      input.left = false;
    } else if (event.code === "ArrowRight" || event.code === "KeyD") {
      input.right = false;
    } else if (event.code === "Space" || event.code === "KeyW" || event.code === "ArrowUp") {
      input.jumpHeld = false;
    }
  });
  canvas.addEventListener("click", handleCanvasClick);
  window.addEventListener("pagehide", () => persistGame(true));
  window.addEventListener("beforeunload", () => persistGame(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      persistGame(true);
    }
  });
}

function handleKeyDown(event) {
  const code = event.code;
  const key = event.key;
  if (state === "select") {
    if (code === "ArrowLeft" || code === "KeyA") {
      selectGender = "male";
    } else if (code === "ArrowRight" || code === "KeyD") {
      selectGender = "female";
    } else if (code === "Enter" || code === "Space" || key === "Enter") {
      startAdventure();
    }
    return;
  }

  if (state === "shop") {
    handleShopKey(code);
    return;
  }
  if (state === "chest") {
    handleChestKey(code);
    return;
  }

  if (code === "ArrowLeft" || code === "KeyA") {
    input.left = true;
  } else if (code === "ArrowRight" || code === "KeyD") {
    input.right = true;
  } else if (code === "Space" || code === "KeyW" || code === "ArrowUp") {
    if (!input.jumpHeld) {
      input.jumpPressed = true;
    }
    input.jumpHeld = true;
  } else if (code === "KeyE") {
    tryInteract();
  } else if (code === "KeyI") {
    openInventory("character");
  } else if (code === "KeyR") {
    if (state === "dead" || state === "win") {
      returnToTown();
    }
  } else if (code === "Escape" && world && world.mapId === "wilds") {
    returnToTown();
  }
}

function tryInteract() {
  if (state !== "play" || !activeSpot) {
    return;
  }
  if (activeSpot.kind === "general") {
    openShop("General Store", GENERAL_STOCK);
  } else if (activeSpot.kind === "forge") {
    openShop("Blacksmith's Forge", FORGE_STOCK);
  } else if (activeSpot.kind === "chest") {
    openInventory("chest");
  } else if (activeSpot.kind === "exit") {
    spawnInMap("wilds");
    persistGame(true);
  }
}

function openShop(title, stock) {
  shop = { title: title, stock: stock, cursor: 0, message: "" };
  state = "shop";
}

function handleShopKey(code) {
  if (code === "Escape") {
    state = "play";
    shop = null;
    persistGame(true);
    return;
  }
  if (code === "ArrowUp" || code === "KeyW") {
    shop.cursor = Math.max(0, shop.cursor - 1);
  } else if (code === "ArrowDown" || code === "KeyS") {
    shop.cursor = Math.min(shop.stock.length - 1, shop.cursor + 1);
  } else if (code === "Enter" || code === "Space") {
    buySelected();
  }
}

function openInventory(mode) {
  chestUi = {
    mode: mode,
    tab: "equips",
    focus: mode === "chest" ? "left" : "right",
    cursor: 0,
    hint: "",
    multi: false,
    selected: [],
    chestCursor: 0,
  };
  state = "chest";
}

function buySelected() {
  const item = shop.stock[shop.cursor];
  if (save.coins < item.price) {
    shop.message = "Not enough coins.";
    return;
  }
  if (!addToPack(item.id, 1)) {
    shop.message = "Pack is full.";
    return;
  }
  save.coins -= item.price;
  shop.message = "Bought " + itemName(item.id) + ".";
  persistGame(true);
}

function handleChestKey(code) {
  const inv = chestUi;
  if (code === "Escape" || code === "KeyI") {
    state = "play";
    chestUi = null;
    persistGame(true);
    return;
  }
  if (inv.mode === "character") {
    if (code === "Digit1") {
      inv.tab = "equips";
      inv.focus = "left";
      inv.cursor = 0;
      return;
    }
    if (code === "Digit2") {
      inv.tab = "tools";
      inv.focus = "left";
      inv.cursor = 0;
      return;
    }
    if (code === "Digit3") {
      inv.tab = "foods";
      inv.focus = "left";
      inv.cursor = 0;
      return;
    }
  }
  if (code === "ArrowLeft" || code === "KeyA") {
    moveInvCursor(inv, -1, 0);
  } else if (code === "ArrowRight" || code === "KeyD") {
    moveInvCursor(inv, 1, 0);
  } else if (code === "ArrowUp" || code === "KeyW") {
    moveInvCursor(inv, 0, -1);
  } else if (code === "ArrowDown" || code === "KeyS") {
    moveInvCursor(inv, 0, 1);
  } else if (code === "Tab") {
    if (inv.mode === "chest" && inv.focus !== "right") {
      save.chestPage = (save.chestPage + 1) % CHEST_PAGES;
      inv.selected = [];
    } else {
      save.packPage = (save.packPage + 1) % PACK_PAGES;
    }
  } else if (code === "Enter" || code === "Space") {
    activateInv(inv);
  }
}

function leftInvCols(inv) {
  return inv.mode === "chest" ? CHEST_COLS : 2;
}

function leftInvCount(inv) {
  return inv.mode === "chest" ? CHEST_SIZE : 8;
}

function moveInvCursor(inv, dx, dy) {
  const leftCols = leftInvCols(inv);
  const leftCount = leftInvCount(inv);
  if (inv.mode === "chest") {
    if (inv.focus === "mid") {
      if (dx < 0) {
        inv.focus = "left";
        inv.cursor = inv.cursor * CHEST_COLS + (CHEST_COLS - 1);
        inv.chestCursor = inv.cursor;
        return;
      }
      if (dx > 0) {
        inv.focus = "right";
        inv.cursor = inv.cursor * 4;
        return;
      }
      inv.cursor = Math.max(0, Math.min(3, inv.cursor + dy));
      return;
    }
    if (inv.focus === "right") {
      const col = inv.cursor % 4;
      const row = Math.floor(inv.cursor / 4);
      if (dx < 0 && col === 0) {
        inv.focus = "mid";
        inv.cursor = row;
        return;
      }
      const nextCol = Math.max(0, Math.min(3, col + dx));
      const nextRow = Math.max(0, Math.min(3, row + dy));
      inv.cursor = nextRow * 4 + nextCol;
      return;
    }
    const col = inv.cursor % CHEST_COLS;
    const row = Math.floor(inv.cursor / CHEST_COLS);
    if (dx > 0 && col === CHEST_COLS - 1) {
      inv.chestCursor = inv.cursor;
      inv.focus = "mid";
      inv.cursor = row;
      return;
    }
    const nextCol = Math.max(0, Math.min(CHEST_COLS - 1, col + dx));
    const nextRow = Math.max(0, Math.min(CHEST_ROWS - 1, row + dy));
    inv.cursor = nextRow * CHEST_COLS + nextCol;
    inv.chestCursor = inv.cursor;
    return;
  }
  if (inv.focus === "right") {
    const col = inv.cursor % 4;
    const row = Math.floor(inv.cursor / 4);
    if (dx < 0 && col === 0) {
      inv.focus = "left";
      inv.cursor = Math.min(leftCount - 1, row);
      return;
    }
    const nextCol = Math.max(0, Math.min(3, col + dx));
    const nextRow = Math.max(0, Math.min(3, row + dy));
    inv.cursor = nextRow * 4 + nextCol;
    return;
  }
  const col = inv.tab === "equips" ? (inv.cursor < 4 ? 0 : 1) : inv.cursor % 2;
  const row = inv.tab === "equips" ? inv.cursor % 4 : Math.floor(inv.cursor / 2);
  if (dx > 0 && col === 1) {
    inv.focus = "right";
    inv.cursor = row * 4;
    return;
  }
  const nextCol = Math.max(0, Math.min(leftCols - 1, col + dx));
  const nextRow = Math.max(0, Math.min(3, row + dy));
  if (inv.tab === "equips") {
    inv.cursor = nextCol * 4 + nextRow;
  } else {
    inv.cursor = nextRow * 2 + nextCol;
  }
}

function activateInv(inv) {
  if (inv.mode === "chest") {
    if (inv.focus === "mid") {
      activateChestButton(inv, inv.cursor);
      return;
    }
    if (inv.focus === "left") {
      if (inv.multi) {
        toggleChestSelected(inv, inv.cursor);
        return;
      }
      inv.hint = takeChestSlots(inv, [inv.cursor], 1);
      return;
    }
    const entry = currentPack()[inv.cursor];
    if (!entry) {
      return;
    }
    if (!addToChest(entry.id, 1)) {
      inv.hint = "Chest is full.";
      return;
    }
    takeFromGrid(currentPack(), inv.cursor);
    return;
  }
  if (inv.focus === "right") {
    const entry = currentPack()[inv.cursor];
    if (!entry) {
      return;
    }
    const def = ITEM_DEFS[entry.id];
    if (def && def.slot) {
      inv.hint = tryEquipFromPack(inv.cursor);
      return;
    }
    if (def && def.cat === "food") {
      takeFromGrid(currentPack(), inv.cursor);
      inv.hint = "Ate " + itemName(entry.id) + ".";
      return;
    }
    inv.hint = itemName(entry.id);
    return;
  }
  if (inv.tab === "equips") {
    inv.hint = unequipToPack(EQUIP_SLOTS[inv.cursor]);
    return;
  }
  const cat = inv.tab === "tools" ? "tool" : "food";
  const rows = filteredPack(cat);
  const row = rows[inv.cursor];
  if (!row) {
    return;
  }
  if (cat === "food") {
    takeFromGrid(save.packs[row.page], row.index);
    inv.hint = "Ate " + itemName(row.slot.id) + ".";
  } else {
    inv.hint = itemName(row.slot.id);
  }
}

function toggleChestSelected(inv, index) {
  if (!currentChest()[index]) {
    inv.hint = "Empty slot.";
    return;
  }
  const at = inv.selected.indexOf(index);
  if (at >= 0) {
    inv.selected.splice(at, 1);
  } else {
    inv.selected.push(index);
  }
}

function pruneChestSelection(inv) {
  const chest = currentChest();
  inv.selected = inv.selected.filter((index) => chest[index]);
}

function takeChestSlots(inv, indices, amount) {
  let moved = 0;
  let lastFail = "Empty slot.";
  indices.forEach((index) => {
    const entry = currentChest()[index];
    if (!entry) {
      return;
    }
    const count = amount === "all" ? entry.count : 1;
    const fail = moveChestToPack(index, count);
    if (fail) {
      lastFail = fail;
      return;
    }
    moved += 1;
  });
  pruneChestSelection(inv);
  if (!moved) {
    return lastFail;
  }
  return "";
}

function activateChestButton(inv, index) {
  if (index === 0) {
    sortGrid(currentChest());
    inv.selected = [];
    inv.hint = "Chest sorted.";
    return;
  }
  if (index === 1 || index === 2) {
    const amount = index === 1 ? 1 : "all";
    const targets = inv.selected.length ? inv.selected.slice() : [inv.chestCursor];
    const valid = targets.filter((slot) => slot >= 0);
    if (!valid.length) {
      inv.hint = "Pick a chest slot first.";
      return;
    }
    inv.hint = takeChestSlots(inv, valid, amount);
    return;
  }
  inv.multi = !inv.multi;
  if (!inv.multi) {
    inv.selected = [];
  }
  inv.hint = inv.multi ? "Mark chest slots, then x1 or ALL." : "";
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (VIEW_W / rect.width),
    y: (event.clientY - rect.top) * (VIEW_H / rect.height),
  };
}

function handleCanvasClick(event) {
  const point = canvasPoint(event);
  if (state === "select") {
    const gender = hitCharacterSelect(point.x, point.y);
    if (!gender) {
      return;
    }
    selectGender = gender;
    startAdventure();
    return;
  }
  if (state === "play") {
    const worldX = point.x + camX;
    const worldY = point.y + camY;
    const spot = hitWorldSpot(worldX, worldY, world.spots);
    if (spot) {
      player.walkTo = Math.max(player.w / 2, Math.min(world.width - player.w / 2, spot.x + spot.w / 2));
      player.walkMarkY = spot.y + spot.h - 6;
      player.pendingInteract = spot;
      player.walkJustArrived = false;
      return;
    }
    player.walkTo = Math.max(player.w / 2, Math.min(world.width - player.w / 2, worldX));
    player.walkMarkY = worldY;
    player.pendingInteract = null;
    player.walkJustArrived = false;
    return;
  }
  if (state !== "chest" || !chestUi) {
    return;
  }
  const mx = point.x;
  const my = point.y;
  const hit = hitInv(mx, my, chestUi);
  if (!hit) {
    return;
  }
  if (hit.kind === "tab") {
    chestUi.tab = hit.tab;
    chestUi.focus = "left";
    chestUi.cursor = 0;
    return;
  }
  if (hit.kind === "packPage") {
    save.packPage = hit.page;
    chestUi.cursor = 0;
    return;
  }
  if (hit.kind === "chestPage") {
    save.chestPage = hit.page;
    chestUi.cursor = 0;
    chestUi.selected = [];
    return;
  }
  if (hit.kind === "button") {
    chestUi.focus = "mid";
    chestUi.cursor = hit.index;
    activateChestButton(chestUi, hit.index);
    return;
  }
  if (hit.kind === "left") {
    if (chestUi.mode === "chest" && chestUi.multi) {
      chestUi.focus = "left";
      chestUi.cursor = hit.index;
      chestUi.chestCursor = hit.index;
      toggleChestSelected(chestUi, hit.index);
      return;
    }
    if (chestUi.focus === "left" && chestUi.cursor === hit.index) {
      activateInv(chestUi);
      return;
    }
    chestUi.focus = "left";
    chestUi.cursor = hit.index;
    chestUi.chestCursor = hit.index;
    return;
  }
  if (chestUi.focus === "right" && chestUi.cursor === hit.index) {
    activateInv(chestUi);
    return;
  }
  chestUi.focus = "right";
  chestUi.cursor = hit.index;
}

function updateEnemies(dt) {
  world.enemies.forEach((enemy) => {
    if (!enemy.alive) {
      return;
    }
    const leftBound = enemy.originX - enemy.patrol;
    const rightBound = enemy.originX + enemy.patrol;
    if (enemy.x < leftBound) {
      enemy.x = leftBound;
      enemy.vx = Math.abs(enemy.vx);
    } else if (enemy.x + enemy.w > rightBound) {
      enemy.x = rightBound - enemy.w;
      enemy.vx = -Math.abs(enemy.vx);
    }
    enemy.facing = enemy.vx >= 0 ? 1 : -1;
    enemy.vy = Math.min(MAX_FALL, (enemy.vy || 0) + GRAVITY * dt);
    moveWithCollisions(enemy, world.solids, dt);
    updateAnim(enemy.anim, dt);
  });
}

function resolveEnemyHits() {
  world.enemies.forEach((enemy) => {
    if (!enemy.alive || !aabbOverlap(player, enemy)) {
      return;
    }
    const stomp = player.vy > 80 && player.y + player.h - enemy.y < 28;
    if (stomp) {
      enemy.alive = false;
      player.vy = JUMP_SPEED * 0.55;
      save.coins += 2;
      persistGame(true);
      return;
    }
    state = "dead";
    persistGame(true);
  });
}

function collectCoins(dt) {
  world.coins.forEach((coin) => {
    if (coin.taken) {
      return;
    }
    updateAnim(coin.anim, dt);
    if (aabbOverlap(player, coin)) {
      coin.taken = true;
      coinsThisMap += 1;
      save.coins += 1;
      persistGame(true);
    }
  });
}

function updateCamera() {
  if (world.mapId === "town") {
    camX = 0;
    camY = Math.max(0, world.height - VIEW_H);
    return;
  }
  const targetX = player.x - VIEW_W * 0.35;
  const targetY = player.y - VIEW_H * 0.62;
  camX += (targetX - camX) * 0.12;
  camY += (targetY - camY) * 0.12;
  camX = Math.max(0, Math.min(camX, Math.max(0, world.width - VIEW_W)));
  camY = Math.max(0, Math.min(camY, Math.max(0, world.height - VIEW_H)));
}

function update(dt) {
  if (state === "select" || state === "shop" || state === "chest") {
    return;
  }
  if (state !== "play") {
    return;
  }
  updatePlayer(player, input, world.solids, dt);
  if (world.mapId === "town") {
    player.x = Math.max(0, Math.min(player.x, world.width - player.w));
  }
  input.jumpPressed = false;
  updateEnemies(dt);
  collectCoins(dt);
  if (world.mapId !== "town") {
    resolveEnemyHits();
  }
  activeSpot = nearestSpot(player, world.spots);
  if (player.walkJustArrived && player.pendingInteract) {
    if (aabbOverlap(player, player.pendingInteract)) {
      activeSpot = player.pendingInteract;
      player.pendingInteract = null;
      player.walkJustArrived = false;
      tryInteract();
    } else {
      player.pendingInteract = null;
    }
  }
  player.walkJustArrived = false;
  if (player.y > world.height + 80) {
    state = "dead";
    persistGame(true);
  }
  if (world.goal && aabbOverlap(player, world.goal)) {
    save.coins += 10;
    state = "win";
    persistGame(true);
  }
  updateCamera();
  persistGame(false);
}

function drawBackground() {
  const img = world.mapId === "town" ? sprites.townBackground : sprites.background;
  if (world.mapId === "town") {
    ctx.drawImage(img, 0, 0, VIEW_W, VIEW_H);
    return;
  }
  const extra = 160;
  const span = Math.max(1, world.width - VIEW_W);
  const shift = (camX / span) * extra;
  ctx.drawImage(img, -shift, 0, VIEW_W + extra, VIEW_H);
}

function drawBuildings() {
  world.spots.forEach((spot) => {
    if (spot.kind === "general") {
      ctx.drawImage(sprites.buildingGeneral, spot.x - 24, spot.y + TILE - 188, 150, 188);
    } else if (spot.kind === "forge") {
      ctx.drawImage(sprites.buildingForge, spot.x - 24, spot.y + TILE - 188, 150, 188);
    } else if (spot.kind === "chest") {
      const open = state === "chest";
      const img = open ? sprites.chestOpen : sprites.chestClosed;
      ctx.drawImage(img, spot.x, spot.y + TILE - 54, 56, 52);
    } else if (spot.kind === "exit") {
      ctx.fillStyle = "#6b4a32";
      ctx.fillRect(spot.x + 28, spot.y + TILE - 110, 8, 110);
      ctx.fillStyle = "#d9a441";
      ctx.fillRect(spot.x + 36, spot.y + TILE - 108, 74, 42);
      ctx.fillStyle = "#3a2a18";
      ctx.font = "12px Trebuchet MS, sans-serif";
      ctx.fillText("WILDS", spot.x + 46, spot.y + TILE - 82);
    }
  });
}

function drawHud() {
  ctx.fillStyle = "rgba(20, 24, 32, 0.45)";
  ctx.fillRect(16, 12, 280, 36);
  ctx.fillStyle = "#fff8e8";
  ctx.font = "18px Trebuchet MS, sans-serif";
  const place = world && world.mapId === "town" ? "Town" : "Wilds";
  ctx.fillText(place + "   Coins " + save.coins + "   Pack " + allPackUsed() + "/" + allPackCap(), 28, 36);

  if (state === "play") {
    drawInteractHint(activeSpot);
    return;
  }
  if (state === "shop") {
    drawShop(shop);
    return;
  }
  if (state === "chest") {
    drawChestUi(chestUi);
    return;
  }
  if (state !== "dead" && state !== "win") {
    return;
  }
  ctx.fillStyle = "rgba(16, 18, 24, 0.55)";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = "#fff8e8";
  ctx.textAlign = "center";
  ctx.font = "42px Trebuchet MS, sans-serif";
  ctx.fillText(state === "win" ? "The wilds are clear!" : "Ouch!", VIEW_W / 2, VIEW_H / 2 - 10);
  ctx.font = "18px Trebuchet MS, sans-serif";
  ctx.fillText("Press R to return to town", VIEW_W / 2, VIEW_H / 2 + 28);
  ctx.textAlign = "left";
}

function drawEnemy(enemy) {
  const img = currentFrame(enemy.anim);
  if (enemy.kind === "fox") {
    drawSprite(ctx, img, enemy.x - 8, enemy.y - 10, enemy.w + 16, enemy.h + 14, enemy.facing < 0);
    return;
  }
  drawSprite(ctx, img, enemy.x - 6, enemy.y - 8, enemy.w + 12, enemy.h + 10, enemy.facing < 0);
}

function draw() {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (state === "select") {
    ctx.drawImage(sprites.townBackground, 0, 0, VIEW_W, VIEW_H);
    drawCharacterSelect(selectGender);
    return;
  }
  drawBackground();
  ctx.save();
  ctx.translate(-Math.round(camX), -Math.round(camY));
  const tile = world.mapId === "town" ? sprites.tileTown : sprites.tile;
  drawTiles(ctx, world.solids, tile, camX);
  drawBuildings();
  drawFlag(ctx, world.goal);
  world.coins.forEach((coin) => {
    if (coin.taken) {
      return;
    }
    drawSprite(ctx, currentFrame(coin.anim), coin.x, coin.y, coin.w, coin.h, false);
  });
  world.enemies.forEach((enemy) => {
    if (enemy.alive) {
      drawEnemy(enemy);
    }
  });
  drawPlayer(ctx, player);
  drawWalkMarker(ctx, player);
  ctx.restore();
  drawHud();
}

function loop(now) {
  try {
    const dt = Math.min(0.033, (now - lastTime) / 1000 || 0.016);
    lastTime = now;
    update(dt);
    draw();
  } catch (err) {
    console.error(err);
  }
  requestAnimationFrame(loop);
}

async function main() {
  sprites = await loadSprites();
  bindInput();
  resumeStoredGame();
  requestAnimationFrame(loop);
}

main().catch((err) => {
  ctx.fillStyle = "#1b2430";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = "#fff8e8";
  ctx.font = "16px sans-serif";
  ctx.fillText(String(err.message), 24, 40);
});
