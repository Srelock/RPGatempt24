const PACK_SIZE = 16;
const PACK_PAGES = 4;
const CHEST_PAGES = 8;
const CHEST_COLS = 5;
const CHEST_ROWS = 4;
const CHEST_SIZE = CHEST_COLS * CHEST_ROWS;
const EQUIP_SLOTS = [
  "helmet",
  "shirt",
  "pants",
  "boots",
  "weapon",
  "pendant",
  "ring1",
  "ring2",
];

const ARMOR_PIECES = [
  { key: "Helmet", slot: "helmet", label: "Helmet" },
  { key: "Shirt", slot: "shirt", label: "Shirt" },
  { key: "Pants", slot: "pants", label: "Pants" },
  { key: "Boots", slot: "boots", label: "Boots" },
];

const ARMOR_TIERS = [
  { key: "leather", name: "Leather", armor: 1 },
  { key: "copper", name: "Copper", armor: 2 },
  { key: "iron", name: "Iron", armor: 3 },
  { key: "platinum", name: "Platinum", armor: 4 },
];

const ARMOR_PRICES = {
  leather: { Helmet: 6, Shirt: 10, Pants: 9, Boots: 6 },
  copper: { Helmet: 12, Shirt: 20, Pants: 18, Boots: 12 },
  iron: { Helmet: 22, Shirt: 36, Pants: 32, Boots: 22 },
  platinum: { Helmet: 45, Shirt: 70, Pants: 60, Boots: 45 },
};

const ITEM_DEFS = {
  apple: { name: "Apple", cat: "food", slot: null, stack: 20, icon: "itemApple" },
  potion: { name: "Potion", cat: "food", slot: null, stack: 10, icon: "itemPotion" },
  rope: { name: "Rope", cat: "tool", slot: null, stack: 20, icon: "itemRope" },
  sword: { name: "Iron Sword", cat: "equip", slot: "weapon", stack: 1, attack: 4, icon: "itemSword" },
  shield: { name: "Wooden Shield", cat: "equip", slot: "weapon", stack: 1, attack: 2, icon: "itemShield" },
  pickaxe: { name: "Pickaxe", cat: "tool", slot: null, stack: 1, icon: "itemPickaxe" },
};

ARMOR_TIERS.forEach((tier) => {
  ARMOR_PIECES.forEach((piece) => {
    ITEM_DEFS[tier.key + piece.key] = {
      name: tier.name + " " + piece.label,
      cat: "equip",
      slot: piece.slot,
      stack: 1,
      armor: tier.armor,
      icon: "item" + tier.name + piece.key,
    };
  });
});

function armorStock(tierKey) {
  const tier = ARMOR_TIERS.find((entry) => entry.key === tierKey);
  return ARMOR_PIECES.map((piece) => ({
    id: tier.key + piece.key,
    price: ARMOR_PRICES[tierKey][piece.key],
  }));
}

const GENERAL_STOCK = [
  { id: "apple", price: 3 },
  { id: "potion", price: 8 },
  { id: "rope", price: 5 },
].concat(armorStock("leather"));

const FORGE_STOCK = [
  { id: "sword", price: 12 },
  { id: "shield", price: 10 },
  { id: "pickaxe", price: 15 },
]
  .concat(armorStock("copper"))
  .concat(armorStock("iron"))
  .concat(armorStock("platinum"));

function armorTotal() {
  let total = 0;
  ["helmet", "shirt", "pants", "boots"].forEach((slot) => {
    const worn = save.equips[slot];
    if (!worn || !ITEM_DEFS[worn.id] || !ITEM_DEFS[worn.id].armor) {
      return;
    }
    total += ITEM_DEFS[worn.id].armor;
  });
  return total;
}

function xpToNext(level) {
  return 12 + (level - 1) * 10;
}

function heroLevel() {
  return Math.max(1, Math.min(20, Math.floor(Number(save.level) || 1)));
}

function heroMaxHp() {
  return 2 + heroLevel() + Math.round(armorTotal() / 4);
}

function totalAttack() {
  return Math.max(1, heroLevel() + weaponAttack() - 1);
}

function totalArmor() {
  return armorTotal() + Math.floor((heroLevel() - 1) / 2);
}

function moveSpeed() {
  return MOVE_SPEED + (heroLevel() - 1) * 6;
}

function armorMaxHp() {
  return heroMaxHp();
}

function equippedDef(slot) {
  const worn = save.equips[slot];
  if (!worn || !ITEM_DEFS[worn.id]) {
    return null;
  }
  return ITEM_DEFS[worn.id];
}

function weaponAttack() {
  const def = equippedDef("weapon");
  if (def && def.attack) {
    return def.attack;
  }
  return 1;
}

function characterStats() {
  const weapon = equippedDef("weapon");
  const hp = player ? player.hp : heroMaxHp();
  const maxHp = player ? player.maxHp : heroMaxHp();
  const level = heroLevel();
  const next = xpToNext(level);
  const xp = level >= 20 ? next : Math.max(0, Math.floor(Number(save.xp) || 0));
  return {
    title: save.name || (save.gender === "female" ? "Female" : "Male"),
    hp: hp,
    maxHp: maxHp,
    rows: [
      { label: "Level", value: String(level) },
      { label: "XP", value: level >= 20 ? "MAX" : xp + " / " + next },
      { label: "Health", value: hp + " / " + maxHp },
      { label: "Armor", value: String(totalArmor()) },
      { label: "Attack", value: String(totalAttack()) },
      { label: "Weapon", value: weapon ? weapon.name : "Unarmed" },
    ],
  };
}

function gainXp(amount) {
  save.level = heroLevel();
  save.xp = Math.max(0, Math.floor(Number(save.xp) || 0));
  if (save.level >= 20 || amount <= 0) {
    return 0;
  }
  save.xp += amount;
  let ups = 0;
  while (save.level < 20 && save.xp >= xpToNext(save.level)) {
    save.xp -= xpToNext(save.level);
    save.level += 1;
    ups += 1;
  }
  if (save.level >= 20) {
    save.xp = 0;
  }
  if (ups) {
    syncPlayerArmor(true);
    if (typeof player !== "undefined" && player) {
      player.levelFlash = 2.2;
    }
  }
  return ups;
}

function countItem(id) {
  let total = 0;
  save.packs.forEach((grid) => {
    grid.forEach((slot) => {
      if (slot && slot.id === id) {
        total += slot.count;
      }
    });
  });
  return total;
}

function takeItemFromPack(id, count) {
  let need = count;
  save.packs.forEach((grid) => {
    grid.forEach((slot, index) => {
      if (need <= 0 || !slot || slot.id !== id) {
        return;
      }
      const take = Math.min(need, slot.count);
      slot.count -= take;
      need -= take;
      if (slot.count <= 0) {
        grid[index] = null;
      }
    });
  });
  return need <= 0;
}

function syncPlayerArmor(fill) {
  if (typeof player === "undefined" || !player) {
    return;
  }
  const oldMax = player.maxHp || 1;
  const maxHp = heroMaxHp();
  player.maxHp = maxHp;
  if (fill || player.hp == null) {
    player.hp = maxHp;
    return;
  }
  if (maxHp > oldMax) {
    player.hp += maxHp - oldMax;
  }
  player.hp = Math.max(0, Math.min(maxHp, player.hp));
}

function emptyGrid(size) {
  const grid = [];
  for (let i = 0; i < size; i += 1) {
    grid.push(null);
  }
  return grid;
}

const SAVE_KEY = "foxhollow-autosave";
const HERO_NAME_MAX = 16;
const HERO_NAME_CHAR = /^[A-Za-z0-9 '\-]$/;

function sanitizeHeroName(raw) {
  if (typeof raw !== "string") {
    return "";
  }
  return raw.replace(/\s+/g, " ").trim().slice(0, HERO_NAME_MAX);
}

function emptySave() {
  const equips = {};
  EQUIP_SLOTS.forEach((slot) => {
    equips[slot] = null;
  });
  const packs = [];
  for (let i = 0; i < PACK_PAGES; i += 1) {
    packs.push(emptyGrid(PACK_SIZE));
  }
  const chests = [];
  for (let i = 0; i < CHEST_PAGES; i += 1) {
    chests.push(emptyGrid(CHEST_SIZE));
  }
  packs[0][0] = { id: "rope", count: 3 };
  equips.weapon = { id: "sword", count: 1 };
  return {
    gender: null,
    name: "",
    coins: 12,
    packs: packs,
    packPage: 0,
    chests: chests,
    chestPage: 0,
    equips: equips,
    level: 1,
    xp: 0,
    placedRopes: [],
  };
}

function slotFromRaw(raw) {
  if (!raw || !ITEM_DEFS[raw.id]) {
    return null;
  }
  const count = Math.max(1, Math.floor(Number(raw.count) || 1));
  return { id: raw.id, count: count };
}

function gridFromRaw(raw, size) {
  const grid = emptyGrid(size);
  if (!Array.isArray(raw)) {
    return grid;
  }
  for (let i = 0; i < size; i += 1) {
    grid[i] = slotFromRaw(raw[i]);
  }
  return grid;
}

function normalizeSave(raw) {
  const next = emptySave();
  if (!raw || typeof raw !== "object") {
    return next;
  }
  if (raw.gender === "male" || raw.gender === "female") {
    next.gender = raw.gender;
  }
  next.name = sanitizeHeroName(raw.name);
  const coins = Math.floor(Number(raw.coins));
  if (Number.isFinite(coins) && coins >= 0) {
    next.coins = coins;
  }
  next.packPage = clampIndex(raw.packPage, PACK_PAGES);
  next.chestPage = clampIndex(raw.chestPage, CHEST_PAGES);
  if (Array.isArray(raw.packs)) {
    for (let i = 0; i < PACK_PAGES; i += 1) {
      next.packs[i] = gridFromRaw(raw.packs[i], PACK_SIZE);
    }
  }
  if (Array.isArray(raw.chests)) {
    for (let i = 0; i < CHEST_PAGES; i += 1) {
      next.chests[i] = gridFromRaw(raw.chests[i], CHEST_SIZE);
    }
  }
  if (raw.equips && typeof raw.equips === "object") {
    EQUIP_SLOTS.forEach((slot) => {
      next.equips[slot] = slotFromRaw(raw.equips[slot]);
    });
  }
  const level = Math.floor(Number(raw.level) || 1);
  next.level = Math.max(1, Math.min(20, Number.isFinite(level) ? level : 1));
  const xp = Math.floor(Number(raw.xp) || 0);
  next.xp = Number.isFinite(xp) && xp >= 0 ? xp : 0;
  if (Array.isArray(raw.placedRopes)) {
    next.placedRopes = raw.placedRopes
      .map((rope) => {
        const x = Number(rope && rope.x);
        const y = Number(rope && rope.y);
        const w = Number(rope && rope.w);
        const h = Number(rope && rope.h);
        if (![x, y, w, h].every(Number.isFinite) || h < 24) {
          return null;
        }
        return { x: x, y: y, w: w, h: h };
      })
      .filter((rope) => rope);
  }
  return next;
}

function clampIndex(value, count) {
  const index = Math.floor(Number(value) || 0);
  if (!Number.isFinite(index)) {
    return 0;
  }
  return Math.max(0, Math.min(count - 1, index));
}

function readStoredSave() {
  try {
    const text = window.localStorage.getItem(SAVE_KEY);
    if (!text) {
      return null;
    }
    const raw = JSON.parse(text);
    const data = normalizeSave(raw);
    if (!data.gender) {
      return null;
    }
    return { save: data, world: raw };
  } catch (err) {
    return null;
  }
}

function writeStoredSave(payload) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch (err) {
    return;
  }
}

function itemName(id) {
  return ITEM_DEFS[id] ? ITEM_DEFS[id].name : id;
}

function consumeFood(id) {
  if (id === "potion" && typeof player !== "undefined" && player && player.hp < player.maxHp) {
    const heal = 1 + Math.floor(heroLevel() / 4);
    player.hp = Math.min(player.maxHp, player.hp + heal);
    return "Drank a potion. +" + heal + " heart" + (heal > 1 ? "s" : "") + ".";
  }
  return "Ate " + itemName(id) + ".";
}

function currentPack() {
  if (!save.packs[save.packPage]) {
    save.packPage = 0;
  }
  return save.packs[save.packPage];
}

function ensureChestGrids() {
  if (!save.chests) {
    save.chests = [];
  }
  while (save.chests.length < CHEST_PAGES) {
    save.chests.push(emptyGrid(CHEST_SIZE));
  }
  save.chests.forEach((grid) => {
    while (grid.length < CHEST_SIZE) {
      grid.push(null);
    }
  });
}

function currentChest() {
  ensureChestGrids();
  if (!save.chests[save.chestPage]) {
    save.chestPage = 0;
  }
  return save.chests[save.chestPage];
}

function addToChest(id, count) {
  if (addToGrid(currentChest(), id, count)) {
    return true;
  }
  for (let i = 0; i < save.chests.length; i += 1) {
    if (i !== save.chestPage && addToGrid(save.chests[i], id, count)) {
      return true;
    }
  }
  return false;
}

function addToPack(id, count) {
  if (addToGrid(currentPack(), id, count)) {
    return true;
  }
  for (let i = 0; i < save.packs.length; i += 1) {
    if (i !== save.packPage && addToGrid(save.packs[i], id, count)) {
      return true;
    }
  }
  return false;
}

function allPackUsed() {
  let used = 0;
  save.packs.forEach((grid) => {
    used += packUsed(grid);
  });
  return used;
}

function allPackCap() {
  return PACK_PAGES * PACK_SIZE;
}

function packUsed(grid) {
  let used = 0;
  grid.forEach((slot) => {
    if (slot) {
      used += 1;
    }
  });
  return used;
}

function addToGrid(grid, id, count) {
  const def = ITEM_DEFS[id] || { stack: 1 };
  const stack = def.stack || 1;
  let remaining = count;
  for (let i = 0; i < grid.length; i += 1) {
    if (grid[i] && grid[i].id === id && grid[i].count < stack) {
      const put = Math.min(stack - grid[i].count, remaining);
      grid[i].count += put;
      remaining -= put;
      if (remaining <= 0) {
        return true;
      }
    }
  }
  for (let i = 0; i < grid.length; i += 1) {
    if (!grid[i]) {
      const put = Math.min(stack, remaining);
      grid[i] = { id: id, count: put };
      remaining -= put;
      if (remaining <= 0) {
        return true;
      }
    }
  }
  return false;
}

function takeFromGrid(grid, index) {
  const taken = takeCountFromGrid(grid, index, 1);
  return taken ? taken.id : null;
}

function takeCountFromGrid(grid, index, count) {
  const entry = grid[index];
  if (!entry || count <= 0) {
    return null;
  }
  const take = Math.min(count, entry.count);
  const id = entry.id;
  entry.count -= take;
  if (entry.count <= 0) {
    grid[index] = null;
  }
  return { id: id, count: take };
}

function moveChestToPack(index, count) {
  const chest = currentChest();
  const entry = chest[index];
  if (!entry) {
    return "Empty slot.";
  }
  const amount = Math.min(count, entry.count);
  if (!addToPack(entry.id, amount)) {
    return "Pack is full.";
  }
  takeCountFromGrid(chest, index, amount);
  return "";
}

function moveGridItem(fromGrid, fromIndex, toGrid) {
  const entry = fromGrid[fromIndex];
  if (!entry) {
    return false;
  }
  if (!addToGrid(toGrid, entry.id, 1)) {
    return false;
  }
  takeFromGrid(fromGrid, fromIndex);
  return true;
}

function filteredPack(cat) {
  const rows = [];
  save.packs.forEach((grid, page) => {
    grid.forEach((slot, index) => {
      if (slot && ITEM_DEFS[slot.id] && ITEM_DEFS[slot.id].cat === cat) {
        rows.push({ page: page, index: index, slot: slot });
      }
    });
  });
  return rows;
}

function tryEquipFromPack(index) {
  const pack = currentPack();
  const entry = pack[index];
  if (!entry) {
    return "Empty slot.";
  }
  const def = ITEM_DEFS[entry.id];
  if (!def || !def.slot) {
    return "That does not go in equipment.";
  }
  const worn = save.equips[def.slot];
  save.equips[def.slot] = { id: entry.id, count: 1 };
  takeFromGrid(pack, index);
  if (worn) {
    addToPack(worn.id, worn.count || 1);
  }
  syncPlayerArmor(false);
  return "Equipped " + itemName(save.equips[def.slot].id) + ".";
}

function sortGrid(grid) {
  const items = [];
  grid.forEach((slot) => {
    if (slot) {
      items.push({ id: slot.id, count: slot.count });
    }
  });
  items.sort((a, b) => {
    const defA = ITEM_DEFS[a.id] || {};
    const defB = ITEM_DEFS[b.id] || {};
    const cat = String(defA.cat || "").localeCompare(String(defB.cat || ""));
    if (cat !== 0) {
      return cat;
    }
    return itemName(a.id).localeCompare(itemName(b.id));
  });
  const merged = [];
  items.forEach((entry) => {
    const last = merged[merged.length - 1];
    const stack = (ITEM_DEFS[entry.id] && ITEM_DEFS[entry.id].stack) || 1;
    if (last && last.id === entry.id && last.count < stack) {
      const put = Math.min(stack - last.count, entry.count);
      last.count += put;
      entry.count -= put;
    }
    if (entry.count > 0) {
      merged.push(entry);
    }
  });
  for (let i = 0; i < grid.length; i += 1) {
    grid[i] = merged[i] || null;
  }
}

function unequipToPack(slotName) {
  const worn = save.equips[slotName];
  if (!worn) {
    return "Nothing equipped.";
  }
  if (!addToPack(worn.id, worn.count || 1)) {
    return "Pack is full.";
  }
  save.equips[slotName] = null;
  syncPlayerArmor(false);
  return "Unequipped " + itemName(worn.id) + ".";
}
