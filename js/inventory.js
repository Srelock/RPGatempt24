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

const ITEM_DEFS = {
  apple: { name: "Apple", cat: "food", slot: null, stack: 20, icon: "itemApple" },
  potion: { name: "Potion", cat: "food", slot: null, stack: 10, icon: "itemPotion" },
  rope: { name: "Rope", cat: "tool", slot: null, stack: 20, icon: "itemRope" },
  sword: { name: "Iron Sword", cat: "equip", slot: "weapon", stack: 1, icon: "itemSword" },
  shield: { name: "Wooden Shield", cat: "equip", slot: "weapon", stack: 1, icon: "itemShield" },
  pickaxe: { name: "Pickaxe", cat: "tool", slot: null, stack: 1, icon: "itemPickaxe" },
};

const GENERAL_STOCK = [
  { id: "apple", price: 3 },
  { id: "potion", price: 8 },
  { id: "rope", price: 5 },
];

const FORGE_STOCK = [
  { id: "sword", price: 12 },
  { id: "shield", price: 10 },
  { id: "pickaxe", price: 15 },
];

function emptyGrid(size) {
  const grid = [];
  for (let i = 0; i < size; i += 1) {
    grid.push(null);
  }
  return grid;
}

const SAVE_KEY = "foxhollow-autosave";

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
  return {
    gender: null,
    coins: 8,
    packs: packs,
    packPage: 0,
    chests: chests,
    chestPage: 0,
    equips: equips,
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
  return "Unequipped " + itemName(worn.id) + ".";
}
