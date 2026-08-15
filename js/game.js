const VIEW_W = 960;
const VIEW_H = 540;
const MENU_H = 76;

function playH() {
  return VIEW_H - MENU_H;
}

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = true;

const input = {
  left: false,
  right: false,
  up: false,
  down: false,
  attackPressed: false,
  attackHeld: false,
  interact: false,
  confirm: false,
  back: false,
};

let save = emptySave();
let world = null;
let player = null;
let sprites = null;
let state = "select";
let selectGender = "male";
let selectName = "";
let selectHint = "";
let activeSpot = null;
let shop = null;
let chestUi = null;
let camX = 0;
let camY = 0;
let lastTime = 0;
let lastPersistAt = 0;
let coinsThisMap = 0;
let toast = { text: "", time: 0 };
let menuPanel = null;
let autoHunt = false;

function showToast(text) {
  toast.text = text;
  toast.time = 2.2;
}

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
  ARMOR_TIERS.forEach((tier) => {
    ARMOR_PIECES.forEach((piece) => {
      names["item" + tier.name + piece.key] =
        "item-" + tier.key + "-" + piece.key.toLowerCase() + ".png";
    });
  });
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
    enemy.anim = createAnim(enemyClips(enemy.kind), "walk");
  });
  level.coins.forEach((coin) => {
    coin.anim = createAnim(coinClips(), "spin");
  });
}

function spawnInMap(mapId, spawnX, spawnY) {
  const id = MAPS[mapId] ? mapId : "town";
  world = parseLevel(mapDef(id).rows, id);
  bindAnims(world);
  const x = Number.isFinite(spawnX) ? spawnX : world.start.x;
  const y = Number.isFinite(spawnY) ? spawnY : world.start.y - 8;
  player = createPlayer(x, y, heroClips(save.gender));
  if (id === "wilds" && Array.isArray(save.placedRopes)) {
    world.ropes = attachRopesToPlatforms(
      mergeRopes(world.ropes.concat(save.placedRopes)),
      world.solids
    );
  }
  syncPlayerArmor(true);
  coinsThisMap = 0;
  state = "play";
  if (isTownMap(id)) {
    camX = 0;
    camY = Math.max(0, world.height - playH());
  } else {
    camX = Math.max(0, player.x - VIEW_W * 0.35);
    camY = Math.max(0, world.height - playH());
  }
  shop = null;
  chestUi = null;
  player.walkTo = null;
  player.walkMarkY = null;
  player.pendingInteract = null;
  player.walkJustArrived = false;
  player.huntTarget = null;
  player.manualWalk = false;
}

function startAdventure() {
  const name = sanitizeHeroName(selectName);
  if (!name) {
    selectHint = "Enter a name to begin.";
    return;
  }
  save.name = name;
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
    name: save.name,
    coins: save.coins,
    packs: save.packs,
    packPage: save.packPage,
    chests: save.chests,
    chestPage: save.chestPage,
    equips: save.equips,
    level: save.level,
    xp: save.xp,
    placedRopes: save.placedRopes || [],
    mapId: world.mapId,
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
  selectName = save.name || "";
  const raw = stored.world;
  const mapId = MAPS[raw.mapId] ? raw.mapId : "town";
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
    if (state === "select" && (event.code === "Backspace" || event.code === "Enter")) {
      event.preventDefault();
    }
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Tab"].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener("keyup", (event) => {
    if (event.code === "ArrowLeft" || event.code === "KeyA") {
      input.left = false;
    } else if (event.code === "ArrowRight" || event.code === "KeyD") {
      input.right = false;
    } else if (event.code === "ArrowUp" || event.code === "KeyW") {
      input.up = false;
    } else if (event.code === "ArrowDown" || event.code === "KeyS") {
      input.down = false;
    } else if (event.code === "Space") {
      input.attackHeld = false;
    }
  });
  canvas.addEventListener("click", handleCanvasClick);
  bindGameMenu();
  window.addEventListener("pagehide", () => persistGame(true));
  window.addEventListener("beforeunload", () => persistGame(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      persistGame(true);
    }
  });
}

function handleSelectKey(event) {
  const code = event.code;
  const key = event.key;
  if (code === "Enter") {
    startAdventure();
    return;
  }
  if (code === "Tab") {
    selectGender = selectGender === "male" ? "female" : "male";
    return;
  }
  if (code === "ArrowLeft") {
    selectGender = "male";
    return;
  }
  if (code === "ArrowRight") {
    selectGender = "female";
    return;
  }
  if (code === "Backspace") {
    selectName = selectName.slice(0, -1);
    selectHint = "";
    return;
  }
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }
  if (!key || key.length !== 1 || !HERO_NAME_CHAR.test(key)) {
    return;
  }
  if (key === " " && (!selectName || selectName.endsWith(" "))) {
    return;
  }
  if (selectName.length >= HERO_NAME_MAX) {
    return;
  }
  selectName += key;
  selectHint = "";
}

function handleKeyDown(event) {
  const code = event.code;
  if (state === "select") {
    handleSelectKey(event);
    return;
  }
  if (menuPanel) {
    if (code === "Escape") {
      closeMenuPanel();
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
    cancelHuntForManualMove();
  } else if (code === "ArrowRight" || code === "KeyD") {
    input.right = true;
    cancelHuntForManualMove();
  } else if (code === "ArrowUp" || code === "KeyW") {
    input.up = true;
    cancelHuntForManualMove();
  } else if (code === "ArrowDown" || code === "KeyS") {
    input.down = true;
    cancelHuntForManualMove();
  } else if (code === "Space") {
    if (!input.attackHeld) {
      input.attackPressed = true;
    }
    input.attackHeld = true;
  } else if (code === "KeyQ") {
    if (state === "play") {
      showToast(tryDeployRope());
    }
  } else if (code === "KeyE") {
    tryInteract();
  } else if (code === "KeyI") {
    toggleCharacterInventory();
  } else if (code === "KeyR") {
    if (state === "dead" || state === "win") {
      returnToTown();
    }
  } else if (code === "Escape" && world && !isTownMap(world.mapId)) {
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
    spawnInMap(activeSpot.dest || "wilds");
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

function openInventory(mode, tab) {
  closeMenuPanel();
  chestUi = {
    mode: mode,
    tab: tab || "equips",
    focus: mode === "chest" ? "left" : "right",
    cursor: 0,
    hint: "",
    multi: false,
    selected: [],
    chestCursor: 0,
  };
  state = "chest";
}

function closePlayUi() {
  if (state === "shop") {
    shop = null;
    state = "play";
  }
  if (state === "chest") {
    chestUi = null;
    state = "play";
  }
}

function toggleCharacterInventory(tab) {
  tab = tab || "equips";
  if (state === "chest" && chestUi && chestUi.mode === "character") {
    if (chestUi.tab !== tab) {
      chestUi.tab = tab;
      chestUi.cursor = 0;
      return;
    }
    closePlayUi();
    persistGame(true);
    return;
  }
  closePlayUi();
  openInventory("character", tab);
}

function bindGameMenu() {
  const root = document.getElementById("game-menu");
  const overlay = document.getElementById("menu-overlay");
  if (!root || !overlay) {
    return;
  }
  root.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-menu]");
    if (!btn) {
      return;
    }
    activateGameMenu(btn.getAttribute("data-menu"));
  });
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeMenuPanel();
    }
  });
}

function activateGameMenu(kind) {
  if (kind === "auto") {
    toggleAutoHunt();
    return;
  }
  if (kind === "items") {
    toggleCharacterInventory("foods");
    return;
  }
  if (kind === "equip") {
    toggleCharacterInventory("equips");
    return;
  }
  if (menuPanel === kind) {
    closeMenuPanel();
    return;
  }
  closePlayUi();
  menuPanel = kind;
  renderMenuPanel();
}

function closeMenuPanel() {
  menuPanel = null;
  const overlay = document.getElementById("menu-overlay");
  if (overlay) {
    overlay.hidden = true;
  }
  syncMenuButtons();
}

function renderMenuPanel() {
  const overlay = document.getElementById("menu-overlay");
  const card = document.getElementById("menu-card");
  if (!overlay || !card) {
    return;
  }
  overlay.hidden = false;
  if (menuPanel === "map") {
    const place = world ? mapDef(world.mapId).title : "Town";
    card.innerHTML =
      "<h2>Map</h2><p>You are in " +
      place +
      ".</p><ul><li>Town: shops, chest, and four hunting paths.</li>" +
      "<li>Wilds: slimes. Grove: foxes. Caves: bats. Ridge: bears.</li></ul>" +
      '<div class="menu-card-actions">' +
      (world && !isTownMap(world.mapId)
        ? '<button type="button" data-act="town">Return to Town</button>'
        : "") +
      '<button type="button" data-act="close">Close</button></div>';
  } else if (menuPanel === "help") {
    card.innerHTML =
      "<h2>Help</h2><ul>" +
      "<li>Click a monster to chase and attack it.</li>" +
      "<li>AUTO hunts nearby foes outside town.</li>" +
      "<li>Click the ground or a building to walk there.</li>" +
      "<li>Arrows / WASD move. Up / Down climb ropes.</li>" +
      "<li>Space swings your sword. Q hangs a rope.</li>" +
      "<li>E interacts. I opens items. Esc returns to town.</li>" +
      "</ul><div class=\"menu-card-actions\"><button type=\"button\" data-act=\"close\">Close</button></div>";
  } else {
    card.innerHTML =
      "<h2>Menu</h2><p>Progress saves automatically.</p>" +
      '<div class="menu-card-actions">' +
      '<button type="button" data-act="close">Resume</button>' +
      '<button type="button" data-act="new">New Adventurer</button></div>';
  }
  card.querySelectorAll("[data-act]").forEach((btn) => {
    btn.addEventListener("click", () => handleMenuAction(btn.getAttribute("data-act")));
  });
  syncMenuButtons();
}

function handleMenuAction(act) {
  if (act === "town") {
    closeMenuPanel();
    returnToTown();
    return;
  }
  if (act === "new") {
    startNewAdventurer();
    return;
  }
  closeMenuPanel();
}

function startNewAdventurer() {
  closeMenuPanel();
  closePlayUi();
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (err) {
    /* ignore */
  }
  save = emptySave();
  world = null;
  player = null;
  shop = null;
  chestUi = null;
  autoHunt = false;
  state = "select";
  selectName = "";
  selectGender = "male";
  selectHint = "";
  syncGameMenu();
}

function syncMenuButtons() {
  const invOpen = state === "chest" && chestUi && chestUi.mode === "character";
  document.querySelectorAll("#game-menu [data-menu]").forEach((btn) => {
    const kind = btn.getAttribute("data-menu");
    const on =
      (kind === "auto" && autoHunt) ||
      menuPanel === kind ||
      (invOpen && kind === "items" && chestUi.tab !== "equips") ||
      (invOpen && kind === "equip" && chestUi.tab === "equips");
    btn.classList.toggle("is-on", on);
  });
  const badge = document.getElementById("auto-badge");
  if (badge) {
    badge.textContent = autoHunt ? "ON" : "OFF";
    badge.classList.toggle("is-on", autoHunt);
  }
}

function syncGameMenu() {
  const root = document.getElementById("game-menu");
  if (!root) {
    return;
  }
  const show = state !== "select" && !!save.gender;
  root.hidden = !show;
  if (!show) {
    if (menuPanel) {
      closeMenuPanel();
    }
    return;
  }
  const level = heroLevel();
  const next = xpToNext(level);
  const xp = level >= 20 ? next : Math.max(0, Math.floor(Number(save.xp) || 0));
  const hp = player ? player.hp : heroMaxHp();
  const maxHp = player ? player.maxHp : heroMaxHp();
  const bag = allPackUsed();
  const bagCap = allPackCap();
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = value;
    }
  };
  const setFill = (id, amount) => {
    const el = document.getElementById(id);
    if (el) {
      el.style.width = Math.round(Math.max(0, Math.min(1, amount)) * 100) + "%";
    }
  };
  setText("menu-name", (save.name || "Adventurer").toUpperCase());
  setText("menu-place", world ? mapDef(world.mapId).title.toUpperCase() : "TOWN");
  setText("menu-level", String(level));
  setText("menu-hp-text", hp + "/" + maxHp);
  setText("menu-bag-text", bag + "/" + bagCap);
  setText("menu-xp-text", level >= 20 ? "MAX" : xp + "/" + next);
  setText("menu-coins", String(save.coins));
  setFill("menu-hp-fill", hp / Math.max(1, maxHp));
  setFill("menu-bag-fill", bag / Math.max(1, bagCap));
  setFill("menu-xp-fill", xp / Math.max(1, next));
  syncMenuButtons();
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
      inv.hint = consumeFood(entry.id);
      return;
    }
    if (entry.id === "rope") {
      inv.hint = tryDeployRope();
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
    inv.hint = consumeFood(row.slot.id);
  } else if (row.slot.id === "rope") {
    inv.hint = tryDeployRope();
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
    const hit = hitCharacterSelect(point.x, point.y);
    if (!hit) {
      return;
    }
    if (hit.kind === "gender") {
      selectGender = hit.gender;
      return;
    }
    if (hit.kind === "begin") {
      startAdventure();
    }
    return;
  }
  if (state === "play") {
    if (point.y >= playH()) {
      return;
    }
    const worldX = point.x + camX;
    const worldY = point.y + camY;
    const enemy = hitEnemyAt(worldX, worldY);
    if (enemy) {
      setHuntTarget(enemy);
      return;
    }
    const spot = hitWorldSpot(worldX, worldY, world.spots);
    if (spot) {
      player.huntTarget = null;
      player.manualWalk = true;
      player.walkTo = Math.max(player.w / 2, Math.min(world.width - player.w / 2, spot.x + spot.w / 2));
      player.walkMarkY = spot.y + spot.h - 6;
      player.pendingInteract = spot;
      player.walkJustArrived = false;
      return;
    }
    player.huntTarget = null;
    player.manualWalk = true;
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
    if (enemy.hurt > 0) {
      enemy.hurt = Math.max(0, enemy.hurt - dt);
    }
    updateAnim(enemy.anim, dt);
  });
}

function tryDeployRope() {
  if (!world || world.mapId !== "wilds" || !player) {
    return "Hang ropes in the wilds.";
  }
  if (countItem("rope") <= 0) {
    return "You have no rope.";
  }
  const cx = player.x + player.w / 2;
  let ceiling = null;
  world.solids.forEach((solid) => {
    if (cx < solid.x - 6 || cx > solid.x + solid.w + 6) {
      return;
    }
    const bottom = solid.y + solid.h;
    if (bottom >= player.y + 8) {
      return;
    }
    if (player.y - bottom > TILE * 6) {
      return;
    }
    if (!ceiling || bottom > ceiling.y + ceiling.h) {
      ceiling = solid;
    }
  });
  if (!ceiling) {
    return "No platform above to hang from.";
  }
  const top = ceiling.y;
  let floorY = world.height;
  world.solids.forEach((solid) => {
    if (cx < solid.x || cx > solid.x + solid.w) {
      return;
    }
    if (solid.y > ceiling.y + 8 && solid.y < floorY) {
      floorY = solid.y;
    }
  });
  const rope = { x: cx - 8, y: top, w: 16, h: floorY - top };
  if (rope.h < 48) {
    return "Too close to hang a rope.";
  }
  const crowded = world.ropes.some((other) => Math.abs(other.x - rope.x) < 28);
  if (crowded) {
    return "A rope is already here.";
  }
  if (!takeItemFromPack("rope", 1)) {
    return "You have no rope.";
  }
  world.ropes.push(rope);
  save.placedRopes = (save.placedRopes || []).concat([rope]);
  persistGame(true);
  return "Hung a rope. Climb with Up / Down.";
}

function toggleAutoHunt() {
  if (!world || world.mapId === "town") {
    showToast("No hunting in town.");
    return;
  }
  autoHunt = !autoHunt;
  if (player) {
    player.manualWalk = false;
    if (!autoHunt) {
      player.huntTarget = null;
    }
  }
  showToast(autoHunt ? "Auto hunt on" : "Auto hunt off");
  syncMenuButtons();
}

function cancelHuntForManualMove() {
  if (player) {
    player.huntTarget = null;
    player.manualWalk = false;
  }
  if (autoHunt) {
    autoHunt = false;
    showToast("Auto hunt off");
    syncMenuButtons();
  }
}

function setHuntTarget(enemy) {
  if (!player || !enemy || !enemy.alive) {
    return;
  }
  player.huntTarget = enemy;
  player.manualWalk = false;
  player.pendingInteract = null;
  player.walkJustArrived = false;
}

function hitEnemyAt(wx, wy) {
  if (!world) {
    return null;
  }
  let best = null;
  let bestD = Infinity;
  world.enemies.forEach((enemy) => {
    if (!enemy.alive) {
      return;
    }
    const pad = 10;
    if (wx < enemy.x - pad || wx > enemy.x + enemy.w + pad) {
      return;
    }
    if (wy < enemy.y - pad || wy > enemy.y + enemy.h + pad) {
      return;
    }
    const dx = wx - (enemy.x + enemy.w / 2);
    const dy = wy - (enemy.y + enemy.h / 2);
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      best = enemy;
      bestD = d;
    }
  });
  return best;
}

function nearestHuntEnemy() {
  let best = null;
  let bestD = Infinity;
  world.enemies.forEach((enemy) => {
    if (!enemy.alive) {
      return;
    }
    const dy = Math.abs(player.y + player.h / 2 - (enemy.y + enemy.h / 2));
    if (dy > 90) {
      return;
    }
    const d = Math.abs(player.x - enemy.x) + dy;
    if (d < bestD) {
      best = enemy;
      bestD = d;
    }
  });
  return best;
}

function faceEnemy(enemy) {
  const pc = player.x + player.w / 2;
  const ec = enemy.x + enemy.w / 2;
  player.facing = ec >= pc ? 1 : -1;
}

function inAttackRange(enemy) {
  const box = attackBox(player);
  const reach = { x: box.x - 10, y: box.y - 10, w: box.w + 20, h: box.h + 20 };
  return aabbOverlap(reach, enemy);
}

function huntApproachX(enemy) {
  const pc = player.x + player.w / 2;
  const ec = enemy.x + enemy.w / 2;
  if (pc <= ec) {
    return enemy.x - 34;
  }
  return enemy.x + enemy.w + 34;
}

function updateHunt() {
  if (!player || !world || world.mapId === "town" || player.climbing) {
    return;
  }
  if (player.manualWalk) {
    if (player.walkTo !== null) {
      return;
    }
    player.manualWalk = false;
  }
  if (player.huntTarget && !player.huntTarget.alive) {
    player.huntTarget = null;
  }
  if (!player.huntTarget && autoHunt) {
    player.huntTarget = nearestHuntEnemy();
  }
  const enemy = player.huntTarget;
  if (!enemy) {
    return;
  }
  faceEnemy(enemy);
  if (inAttackRange(enemy)) {
    player.walkTo = null;
    player.pendingInteract = null;
    tryStartAttack(player, true);
    return;
  }
  player.walkTo = Math.max(player.w / 2, Math.min(world.width - player.w / 2, huntApproachX(enemy)));
  player.walkMarkY = enemy.y + enemy.h;
  player.pendingInteract = null;
}

function hurtEnemy(enemy, damage) {
  if (!enemy.alive || enemy.hurt > 0) {
    return;
  }
  enemy.hp -= damage;
  enemy.hurt = 0.22;
  enemy.vx = player.facing * 140;
  if (enemy.hp > 0) {
    return;
  }
  enemy.alive = false;
  save.coins += enemy.coins || 2;
  const ups = gainXp(enemy.xp || 8);
  showToast(ups ? "Level " + heroLevel() + "!" : "+" + (enemy.xp || 8) + " XP");
  persistGame(true);
}

function resolveSwordHits() {
  if (!player || player.swing <= 0) {
    return;
  }
  const box = attackBox(player);
  world.enemies.forEach((enemy, index) => {
    if (!enemy.alive || player.swingHits[index] || !aabbOverlap(box, enemy)) {
      return;
    }
    player.swingHits[index] = true;
    hurtEnemy(enemy, totalAttack());
  });
}

function takeHit() {
  if (player.iframes > 0) {
    return;
  }
  player.hp -= 1;
  player.iframes = 1.15;
  player.climbing = false;
  player.vy = -180;
  player.vx = -player.facing * 220;
  if (player.hp <= 0) {
    state = "dead";
    persistGame(true);
  }
}

function resolveEnemyHits() {
  world.enemies.forEach((enemy) => {
    if (!enemy.alive || !aabbOverlap(player, enemy)) {
      return;
    }
    if (player.swing > 0) {
      return;
    }
    takeHit();
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
  const h = playH();
  camY = Math.max(0, world.height - h);
  if (isTownMap(world.mapId)) {
    const targetX = player.x - VIEW_W * 0.4;
    camX += (targetX - camX) * 0.12;
    camX = Math.max(0, Math.min(camX, Math.max(0, world.width - VIEW_W)));
    return;
  }
  const targetX = player.x - VIEW_W * 0.35;
  const targetY = player.y - h * 0.62;
  camX += (targetX - camX) * 0.12;
  camY += (targetY - camY) * 0.12;
  camX = Math.max(0, Math.min(camX, Math.max(0, world.width - VIEW_W)));
  camY = Math.max(0, Math.min(camY, Math.max(0, world.height - h)));
}

function update(dt) {
  if (state === "select" || state === "shop" || state === "chest" || menuPanel) {
    return;
  }
  if (state !== "play") {
    return;
  }
  if (player.iframes > 0) {
    player.iframes = Math.max(0, player.iframes - dt);
  }
  if (toast.time > 0) {
    toast.time = Math.max(0, toast.time - dt);
  }
  updateHunt();
  updatePlayer(player, input, world.solids, world.ropes, dt);
  if (world.mapId === "town") {
    player.x = Math.max(0, Math.min(player.x, world.width - player.w));
  }
  input.attackPressed = false;
  updateEnemies(dt);
  collectCoins(dt);
  if (world.mapId !== "town") {
    resolveSwordHits();
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
    gainXp(25);
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
      const sign = mapDef(spot.dest).sign;
      ctx.fillText(sign, spot.x + 46, spot.y + TILE - 82);
    }
  });
}

function drawHud() {
  if (player && player.levelFlash > 0) {
    ctx.textAlign = "center";
    ctx.globalAlpha = Math.min(1, player.levelFlash);
    drawOutlineText("Level " + heroLevel() + "!", VIEW_W / 2, 88, 34);
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  }
  if (toast.time > 0 && toast.text) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#e8c57a";
    ctx.font = "16px Trebuchet MS, sans-serif";
    ctx.fillText(toast.text, VIEW_W / 2, 64);
    ctx.textAlign = "left";
  }

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
  ctx.fillRect(0, 0, VIEW_W, playH());
  ctx.fillStyle = "#fff8e8";
  ctx.textAlign = "center";
  ctx.font = "42px Trebuchet MS, sans-serif";
  ctx.fillText(state === "win" ? mapDef(world.mapId).title + " is clear!" : "Ouch!", VIEW_W / 2, playH() / 2 - 10);
  ctx.font = "18px Trebuchet MS, sans-serif";
  ctx.fillText("Press R to return to town", VIEW_W / 2, playH() / 2 + 28);
  ctx.textAlign = "left";
}

function drawEnemy(enemy) {
  const img = currentFrame(enemy.anim);
  const def = ENEMY_DEFS[enemy.kind] || ENEMY_DEFS.slime;
  ctx.save();
  if (enemy.hurt > 0) {
    ctx.globalAlpha = 0.55;
  }
  if (def.tint) {
    ctx.filter = def.tint;
  }
  drawSprite(
    ctx,
    img,
    enemy.x - def.padX,
    enemy.y - def.padY,
    enemy.w + def.padX * 2,
    enemy.h + def.padY * 2,
    enemy.facing < 0
  );
  ctx.restore();
  if (player && player.huntTarget === enemy) {
    ctx.strokeStyle = "#e8c57a";
    ctx.lineWidth = 2;
    ctx.strokeRect(enemy.x - 4, enemy.y - 6, enemy.w + 8, enemy.h + 10);
  }
  if (enemy.hp < enemy.maxHp) {
    drawMeter(enemy.x, enemy.y - 10, enemy.w, 5, enemy.hp / enemy.maxHp, "#e85d4c", "");
  }
}

function draw() {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (state === "select") {
    ctx.drawImage(sprites.townBackground, 0, 0, VIEW_W, VIEW_H);
    drawCharacterSelect(selectGender, selectName, selectHint);
    syncGameMenu();
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, VIEW_W, playH());
  ctx.clip();
  drawBackground();
  ctx.save();
  ctx.translate(-Math.round(camX), -Math.round(camY));
  const tile = world.mapId === "town" ? sprites.tileTown : sprites.tile;
  drawTiles(ctx, world.solids, tile, camX);
  drawRopes(ctx, world.ropes || [], camX);
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
  ctx.restore();
  syncGameMenu();
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
