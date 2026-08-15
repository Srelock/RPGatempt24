function heroClips(gender) {
  const p = gender === "female" ? "female" : "male";
  return {
    idle: {
      frames: [sprites[p + "Idle1"], sprites[p + "Idle2"]],
      fps: 3,
      loop: true,
    },
    walk: {
      frames: [
        sprites[p + "Walk1"],
        sprites[p + "Walk2"],
        sprites[p + "Walk3"],
        sprites[p + "Walk4"],
      ],
      fps: 9,
      loop: true,
    },
    jump: { frames: [sprites[p + "Jump"]], fps: 8, loop: false },
    fall: { frames: [sprites[p + "Fall"]], fps: 8, loop: false },
  };
}

function slimeClips() {
  return {
    walk: {
      frames: [sprites.slime1, sprites.slime2, sprites.slime3, sprites.slime4],
      fps: 8,
      loop: true,
    },
  };
}

function foxClips() {
  return {
    walk: {
      frames: [sprites.foxWalk1, sprites.foxWalk2, sprites.foxWalk3, sprites.foxWalk4],
      fps: 9,
      loop: true,
    },
  };
}

function enemyClips(kind) {
  const def = ENEMY_DEFS[kind] || ENEMY_DEFS.slime;
  return def.clips === "fox" ? foxClips() : slimeClips();
}

function coinClips() {
  return {
    spin: {
      frames: [sprites.coin1, sprites.coin2, sprites.coin3, sprites.coin4],
      fps: 8,
      loop: true,
    },
  };
}

function drawPanel(x, y, w, h) {
  ctx.fillStyle = "rgba(18, 22, 30, 0.92)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#e8c57a";
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
}

function inRect(mx, my, box) {
  return mx >= box.x && mx <= box.x + box.w && my >= box.y && my <= box.y + box.h;
}

function characterSelectLayout() {
  const panelW = 560;
  const panelH = 430;
  const panelX = (VIEW_W - panelW) / 2;
  const panelY = (VIEW_H - panelH) / 2;
  const nameBox = { x: panelX + 40, y: panelY + 96, w: panelW - 80, h: 42 };
  const cardW = 210;
  const cardH = 168;
  const cardY = panelY + 168;
  return {
    panelX: panelX,
    panelY: panelY,
    panelW: panelW,
    panelH: panelH,
    nameBox: nameBox,
    cards: [
      {
        gender: "male",
        label: "Male",
        img: sprites.maleIdle1,
        x: panelX + 50,
        y: cardY,
        w: cardW,
        h: cardH,
      },
      {
        gender: "female",
        label: "Female",
        img: sprites.femaleIdle1,
        x: panelX + panelW - 50 - cardW,
        y: cardY,
        w: cardW,
        h: cardH,
      },
    ],
    begin: {
      x: panelX + (panelW - 220) / 2,
      y: panelY + panelH - 62,
      w: 220,
      h: 44,
    },
  };
}

function hitCharacterSelect(mx, my) {
  const layout = characterSelectLayout();
  if (inRect(mx, my, layout.begin)) {
    return { kind: "begin" };
  }
  if (inRect(mx, my, layout.nameBox)) {
    return { kind: "name" };
  }
  for (let i = 0; i < layout.cards.length; i += 1) {
    const card = layout.cards[i];
    if (inRect(mx, my, card)) {
      return { kind: "gender", gender: card.gender };
    }
  }
  return null;
}

function drawCharacterSelect(choice, name, hint) {
  ctx.fillStyle = "rgba(12, 16, 24, 0.62)";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const layout = characterSelectLayout();
  drawPanel(layout.panelX, layout.panelY, layout.panelW, layout.panelH);

  ctx.textAlign = "center";
  ctx.fillStyle = "#fff8e8";
  ctx.font = "28px Trebuchet MS, sans-serif";
  ctx.fillText("Create your adventurer", layout.panelX + layout.panelW / 2, layout.panelY + 42);
  ctx.font = "14px Trebuchet MS, sans-serif";
  ctx.fillStyle = "#c9a06a";
  ctx.fillText("Name your hero, pick a look, then begin", layout.panelX + layout.panelW / 2, layout.panelY + 68);

  ctx.textAlign = "left";
  ctx.fillStyle = "#e8c57a";
  ctx.font = "14px Trebuchet MS, sans-serif";
  ctx.fillText("Name", layout.nameBox.x, layout.nameBox.y - 8);
  ctx.fillStyle = "rgba(10, 12, 18, 0.88)";
  ctx.fillRect(layout.nameBox.x, layout.nameBox.y, layout.nameBox.w, layout.nameBox.h);
  ctx.strokeStyle = "#e8c57a";
  ctx.lineWidth = 2;
  ctx.strokeRect(layout.nameBox.x, layout.nameBox.y, layout.nameBox.w, layout.nameBox.h);
  ctx.fillStyle = "#fff8e8";
  ctx.font = "20px Trebuchet MS, sans-serif";
  const shown = name || "";
  const textX = layout.nameBox.x + 12;
  const textY = layout.nameBox.y + 28;
  if (!shown) {
    ctx.fillStyle = "rgba(255, 248, 232, 0.35)";
    ctx.fillText("Type a name...", textX, textY);
    ctx.fillStyle = "#fff8e8";
  } else {
    ctx.fillText(shown, textX, textY);
  }
  if (Math.floor(performance.now() / 530) % 2 === 0) {
    const caretX = textX + ctx.measureText(shown).width + 1;
    ctx.fillRect(caretX, layout.nameBox.y + 10, 2, layout.nameBox.h - 20);
  }

  ctx.textAlign = "center";
  layout.cards.forEach((card) => {
    const selected = choice === card.gender;
    ctx.fillStyle = selected ? "rgba(232, 197, 122, 0.22)" : "rgba(10, 12, 18, 0.72)";
    ctx.fillRect(card.x, card.y, card.w, card.h);
    ctx.strokeStyle = selected ? "#e8c57a" : "#6a6258";
    ctx.lineWidth = selected ? 3 : 2;
    ctx.strokeRect(card.x, card.y, card.w, card.h);
    if (card.img) {
      ctx.drawImage(card.img, card.x + 45, card.y + 8, 120, 118);
    }
    ctx.fillStyle = "#fff8e8";
    ctx.font = "18px Trebuchet MS, sans-serif";
    ctx.fillText(card.label, card.x + card.w / 2, card.y + card.h - 16);
  });

  const ready = !!sanitizeHeroName(name);
  ctx.fillStyle = ready ? "rgba(232, 197, 122, 0.28)" : "rgba(18, 22, 30, 0.7)";
  ctx.fillRect(layout.begin.x, layout.begin.y, layout.begin.w, layout.begin.h);
  ctx.strokeStyle = ready ? "#e8c57a" : "#6a6258";
  ctx.lineWidth = 2;
  ctx.strokeRect(layout.begin.x, layout.begin.y, layout.begin.w, layout.begin.h);
  ctx.fillStyle = ready ? "#fff8e8" : "#8a8378";
  ctx.font = "20px Trebuchet MS, sans-serif";
  ctx.fillText("Begin", layout.begin.x + layout.begin.w / 2, layout.begin.y + 30);

  if (hint) {
    ctx.fillStyle = "#e85d4c";
    ctx.font = "13px Trebuchet MS, sans-serif";
    ctx.fillText(hint, layout.panelX + layout.panelW / 2, layout.begin.y - 12);
  }
  ctx.textAlign = "left";
}

function drawShop(shop) {
  ctx.textAlign = "left";
  drawPanel(180, 56, 600, 430);
  ctx.fillStyle = "#fff8e8";
  ctx.font = "26px Trebuchet MS, sans-serif";
  ctx.fillText(shop.title, 210, 100);
  ctx.font = "16px Trebuchet MS, sans-serif";
  ctx.fillText("Coins: " + save.coins, 210, 126);
  ctx.fillText("Up / Down to pick · Enter to buy · Esc to leave", 210, 150);

  const visible = 6;
  let start = 0;
  if (shop.cursor >= start + visible) {
    start = shop.cursor - visible + 1;
  }
  const shown = shop.stock.slice(start, start + visible);
  shown.forEach((item, offset) => {
    const index = start + offset;
    const y = 186 + offset * 42;
    if (index === shop.cursor) {
      ctx.fillStyle = "rgba(232, 197, 122, 0.25)";
      ctx.fillRect(200, y - 28, 560, 40);
    }
    const def = ITEM_DEFS[item.id];
    const img = def && sprites[def.icon] ? sprites[def.icon] : null;
    if (img) {
      ctx.drawImage(img, 210, y - 24, 32, 32);
    }
    ctx.fillStyle = "#fff8e8";
    ctx.font = "18px Trebuchet MS, sans-serif";
    ctx.fillText(itemName(item.id), 252, y);
    if (def && def.armor) {
      ctx.fillStyle = "#e8c57a";
      ctx.fillText("+" + def.armor + " ARM", 500, y);
    } else if (def && def.attack) {
      ctx.fillStyle = "#e8c57a";
      ctx.fillText("+" + def.attack + " ATK", 500, y);
    }
    ctx.fillStyle = "#fff8e8";
    ctx.fillText(item.price + " coins", 620, y);
  });
  if (shop.stock.length > visible) {
    ctx.fillStyle = "#c9a06a";
    ctx.font = "13px Trebuchet MS, sans-serif";
    ctx.fillText(start + 1 + "-" + Math.min(start + visible, shop.stock.length) + " of " + shop.stock.length, 210, 448);
  }
  if (shop.message) {
    ctx.fillStyle = "#e8c57a";
    ctx.font = "16px Trebuchet MS, sans-serif";
    ctx.fillText(shop.message, 360, 448);
  }
}

function drawHeart(x, y, filled) {
  const s = 8;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x, y - s * 0.35, x - s, y - s * 0.35, x - s, y + s * 0.25);
  ctx.bezierCurveTo(x - s, y + s * 0.85, x, y + s * 1.25, x, y + s * 1.55);
  ctx.bezierCurveTo(x, y + s * 1.25, x + s, y + s * 0.85, x + s, y + s * 0.25);
  ctx.bezierCurveTo(x + s, y - s * 0.35, x, y - s * 0.35, x, y + s * 0.3);
  ctx.fillStyle = filled ? "#e85d4c" : "rgba(24, 20, 18, 0.55)";
  ctx.fill();
  ctx.strokeStyle = "#fff8e8";
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

function drawMeter(x, y, w, h, amount, color, label) {
  ctx.fillStyle = "rgba(12, 10, 8, 0.72)";
  ctx.fillRect(x, y, w, h);
  const fill = Math.max(0, Math.min(1, amount));
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * fill), h - 2);
  ctx.strokeStyle = "#c9a06a";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  if (label) {
    ctx.fillStyle = "#140c08";
    ctx.font = "11px Trebuchet MS, sans-serif";
    ctx.fillText(label, x + 6, y + h - 3);
  }
}

function drawHpHud() {
  if (!player) {
    return;
  }
  const maxHp = player.maxHp || 1;
  const hp = player.hp || 0;
  drawMeter(VIEW_W - 168, 16, 148, 16, hp / maxHp, "#e85d4c", "HP " + hp + "/" + maxHp);
}

function drawChestUi(inv) {
  drawCharacterInventory(inv);
}

function roundRectPath(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawLeatherPanel(x, y, w, h) {
  roundRectPath(x, y, w, h, 12);
  ctx.fillStyle = "#6a4328";
  ctx.fill();
  ctx.strokeStyle = "#2b170e";
  ctx.lineWidth = 4;
  ctx.stroke();
}

function drawOutlineText(text, x, y, size) {
  ctx.font = "bold " + size + "px Trebuchet MS, sans-serif";
  ctx.lineJoin = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#140c08";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = "#fff8e8";
  ctx.fillText(text, x, y);
}

function drawInvSlot(x, y, size, selected) {
  ctx.fillStyle = "#3a2416";
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "#2a1810";
  ctx.fillRect(x + 3, y + 3, size - 6, size - 6);
  ctx.strokeStyle = selected ? "#f2d789" : "#c9a06a";
  ctx.lineWidth = selected ? 3 : 2;
  ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
}

function drawGhost(kind, x, y, size) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const s = size / 54;
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = "#d8c4a0";
  ctx.strokeStyle = "#d8c4a0";
  ctx.lineWidth = 2 * s;
  if (kind === "helmet") {
    ctx.beginPath();
    ctx.arc(cx, cy - 2 * s, 11 * s, Math.PI, 0);
    ctx.lineTo(cx + 11 * s, cy + 8 * s);
    ctx.lineTo(cx - 11 * s, cy + 8 * s);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "shirt") {
    ctx.fillRect(cx - 10 * s, cy - 8 * s, 20 * s, 18 * s);
    ctx.fillRect(cx - 16 * s, cy - 8 * s, 6 * s, 10 * s);
    ctx.fillRect(cx + 10 * s, cy - 8 * s, 6 * s, 10 * s);
  } else if (kind === "pants") {
    ctx.fillRect(cx - 9 * s, cy - 8 * s, 18 * s, 8 * s);
    ctx.fillRect(cx - 9 * s, cy, 7 * s, 14 * s);
    ctx.fillRect(cx + 2 * s, cy, 7 * s, 14 * s);
  } else if (kind === "boots") {
    ctx.fillRect(cx - 12 * s, cy - 4 * s, 10 * s, 12 * s);
    ctx.fillRect(cx - 12 * s, cy + 6 * s, 14 * s, 5 * s);
  } else if (kind === "weapon") {
    ctx.fillRect(cx - 2 * s, cy - 14 * s, 4 * s, 22 * s);
    ctx.fillRect(cx - 8 * s, cy + 6 * s, 16 * s, 4 * s);
  } else if (kind === "pendant") {
    ctx.beginPath();
    ctx.arc(cx, cy + 4 * s, 7 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - 1 * s, cy - 12 * s, 2 * s, 10 * s);
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, 8 * s, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawItemInSlot(entry, x, y, size) {
  if (!entry) {
    return;
  }
  const def = ITEM_DEFS[entry.id];
  const img = def && sprites[def.icon] ? sprites[def.icon] : null;
  const pad = 6;
  if (img) {
    ctx.drawImage(img, x + pad, y + pad, size - pad * 2, size - pad * 2);
  }
  if (entry.count > 1) {
    ctx.textAlign = "right";
    drawOutlineText(String(entry.count), x + size - 6, y + size - 8, 14);
    ctx.textAlign = "left";
  }
}

function invLayout(inv) {
  const slot = 70;
  const gap = 4;
  const pad = 8;
  const tabH = 46;
  const footerH = 30;
  const chest = inv && inv.mode === "chest";
  const showStats = inv && inv.mode === "character";
  const colsLeft = chest ? CHEST_COLS : 2;
  const colsRight = 4;
  const rows = 4;
  const leftW = pad * 2 + colsLeft * slot + (colsLeft - 1) * gap;
  const rightW = pad * 2 + colsRight * slot + (colsRight - 1) * gap;
  const midW = chest ? slot : 0;
  const statsW = showStats ? 188 : 0;
  const gridH = rows * slot + (rows - 1) * gap;
  const height = tabH + pad + gridH + pad + footerH;
  const join = 4;
  const totalW =
    statsW + (showStats ? join : 0) + leftW + join + midW + (chest ? join : 0) + rightW;
  const statsX = Math.round((VIEW_W - totalW) / 2);
  const leftX = statsX + statsW + (showStats ? join : 0);
  const top = Math.round((VIEW_H - height) / 2) - 8;
  const midX = leftX + leftW + join;
  const rightX = chest ? midX + midW + join : leftX + leftW + join;
  return {
    slot: slot,
    gap: gap,
    pad: pad,
    tabH: tabH,
    footerH: footerH,
    colsLeft: colsLeft,
    top: top,
    height: height,
    showStats: showStats,
    statsX: statsX,
    statsW: statsW,
    leftX: leftX,
    leftW: leftW,
    midX: midX,
    midW: midW,
    rightX: rightX,
    rightW: rightW,
    gridTop: top + tabH + pad,
    leftGridX: leftX + pad,
    midGridX: midX,
    rightGridX: rightX + pad,
  };
}

function slotRect(originX, originY, col, row, cols, layout) {
  const size = layout.slot;
  const gap = layout.gap;
  const x = originX + col * (size + gap);
  const y = originY + row * (size + gap);
  return { x: x, y: y, size: size };
}

function drawPageTabs(x, y, w, h, pages, selectedPage, icon) {
  const tabW = w / pages;
  for (let i = 0; i < pages; i += 1) {
    drawInvTab(x + i * tabW, y, tabW, h, String(i + 1), icon, i === selectedPage);
  }
}

function drawInvTab(x, y, w, h, label, icon, selected) {
  ctx.fillStyle = selected ? "#7a4e2e" : "#4a2e1c";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = selected ? "#e8c57a" : "#2b170e";
  ctx.lineWidth = selected ? 2 : 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  if (icon) {
    const iconSize = Math.min(22, Math.max(14, w - 12));
    ctx.drawImage(icon, x + w / 2 - iconSize / 2, y + 3, iconSize, iconSize);
  }
  ctx.textAlign = "center";
  const textY = icon ? y + h - 7 : y + Math.round(h / 2) + 4;
  drawOutlineText(label, x + w / 2, textY, w < 48 ? 9 : 13);
  ctx.textAlign = "left";
}

function drawStatRow(x, y, w, label, value) {
  ctx.textAlign = "left";
  ctx.fillStyle = "#e8c57a";
  ctx.font = "13px Trebuchet MS, sans-serif";
  ctx.fillText(label, x, y);
  ctx.textAlign = "right";
  drawOutlineText(String(value), x + w, y, 14);
  ctx.textAlign = "left";
}

function drawStatsPanel(layout) {
  const stats = characterStats();
  const tabY = layout.top + 2;
  drawInvTab(layout.statsX, tabY, layout.statsW, layout.tabH, "STATS", null, true);
  const pad = 10;
  const innerX = layout.statsX + pad;
  const innerW = layout.statsW - pad * 2;
  const portraitH = 96;
  const portraitY = layout.gridTop;
  ctx.fillStyle = "#2a1810";
  ctx.fillRect(innerX, portraitY, innerW, portraitH);
  ctx.strokeStyle = "#c9a06a";
  ctx.lineWidth = 2;
  ctx.strokeRect(innerX + 1, portraitY + 1, innerW - 2, portraitH - 2);
  const pose = save.gender === "female" ? sprites.femaleIdle1 : sprites.maleIdle1;
  if (pose) {
    ctx.drawImage(pose, innerX + 22, portraitY + 4, innerW - 44, portraitH - 8);
  }
  ctx.textAlign = "center";
  drawOutlineText(stats.title, layout.statsX + layout.statsW / 2, portraitY + portraitH + 20, 13);
  ctx.textAlign = "left";
  const rowY = portraitY + portraitH + 42;
  stats.rows.forEach((row, index) => {
    drawStatRow(innerX, rowY + index * 22, innerW, row.label, row.value);
  });
}

function drawCharacterInventory(inv) {
  const layout = invLayout(inv);
  ctx.fillStyle = "rgba(10, 8, 14, 0.45)";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (layout.showStats) {
    drawLeatherPanel(layout.statsX, layout.top, layout.statsW, layout.height);
    drawStatsPanel(layout);
  }
  drawLeatherPanel(layout.leftX, layout.top, layout.leftW, layout.height);
  if (inv.mode === "chest") {
    drawLeatherPanel(layout.midX, layout.top, layout.midW, layout.height);
  }
  drawLeatherPanel(layout.rightX, layout.top, layout.rightW, layout.height);

  const tabY = layout.top + 2;
  if (inv.mode === "character") {
    const tabW = layout.leftW / 3;
    drawInvTab(layout.leftX, tabY, tabW, layout.tabH, "EQUIPS", sprites.itemSword, inv.tab === "equips");
    drawInvTab(layout.leftX + tabW, tabY, tabW, layout.tabH, "TOOLS", sprites.itemPickaxe, inv.tab === "tools");
    drawInvTab(layout.leftX + tabW * 2, tabY, tabW, layout.tabH, "FOODS", sprites.itemApple, inv.tab === "foods");
    drawPageTabs(layout.rightX, tabY, layout.rightW, layout.tabH, PACK_PAGES, save.packPage, sprites.uiBackpack);
  } else {
    drawPageTabs(layout.leftX, tabY, layout.leftW, layout.tabH, CHEST_PAGES, save.chestPage, sprites.chestClosed);
    drawPageTabs(layout.rightX, tabY, layout.rightW, layout.tabH, PACK_PAGES, save.packPage, sprites.uiBackpack);
  }

  drawLeftInvGrid(inv, layout);
  if (inv.mode === "chest") {
    drawChestButtons(inv, layout);
  }
  drawRightInvGrid(inv, layout);

  const footY = layout.top + layout.height - layout.footerH + 4;
  if (inv.mode === "character") {
    drawOutlineText("ARM " + totalArmor(), layout.leftX + 10, footY + 16, 14);
  }
  ctx.drawImage(sprites.uiLock, layout.rightX + 8, footY, 20, 20);
  ctx.drawImage(sprites.coin1, layout.rightX + layout.rightW - 70, footY, 20, 20);
  drawOutlineText(String(save.coins), layout.rightX + layout.rightW - 46, footY + 16, 16);

  ctx.textAlign = "center";
  ctx.font = "13px Trebuchet MS, sans-serif";
  ctx.fillStyle = "#fff8e8";
  const help =
    inv.mode === "chest"
      ? inv.multi
        ? "SEL on · click chest slots to mark · x1 / ALL take marked · Esc close"
        : "SORT · x1 take one · ALL take stack · SEL mark several · Esc close"
      : "Stats on the left · Click pack tabs for pages · 1/2/3 left tabs · Enter equip · Esc close";
  ctx.fillText(inv.hint || help, VIEW_W / 2, layout.top + layout.height + 18);
  ctx.textAlign = "left";
}

function drawLeftInvGrid(inv, layout) {
  if (inv.mode === "chest") {
    drawSlotGrid(
      currentChest(),
      CHEST_COLS,
      CHEST_ROWS,
      layout.leftGridX,
      layout.gridTop,
      layout,
      inv.focus === "left" ? inv.cursor : inv.chestCursor,
      inv.selected
    );
    return;
  }
  if (inv.tab === "equips") {
    EQUIP_SLOTS.forEach((slotName, index) => {
      const col = index < 4 ? 0 : 1;
      const row = index % 4;
      const rect = slotRect(layout.leftGridX, layout.gridTop, col, row, 2, layout);
      const selected = inv.focus === "left" && inv.cursor === index;
      drawInvSlot(rect.x, rect.y, rect.size, selected);
      const worn = save.equips[slotName];
      if (worn) {
        drawItemInSlot(worn, rect.x, rect.y, rect.size);
      } else {
        drawGhost(slotName, rect.x, rect.y, rect.size);
      }
    });
    return;
  }
  const cat = inv.tab === "tools" ? "tool" : "food";
  const rows = filteredPack(cat);
  for (let i = 0; i < 8; i += 1) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const rect = slotRect(layout.leftGridX, layout.gridTop, col, row, 2, layout);
    const selected = inv.focus === "left" && inv.cursor === i;
    drawInvSlot(rect.x, rect.y, rect.size, selected);
    if (rows[i]) {
      drawItemInSlot(rows[i].slot, rect.x, rect.y, rect.size);
    }
  }
}

function drawRightInvGrid(inv, layout) {
  drawSlotGrid(currentPack(), 4, 4, layout.rightGridX, layout.gridTop, layout, inv.focus === "right" ? inv.cursor : -1);
}

function chestButtonLabels() {
  return ["SORT", "x1", "ALL", "SEL"];
}

function drawChestButtons(inv, layout) {
  const labels = chestButtonLabels();
  for (let i = 0; i < labels.length; i += 1) {
    const rect = slotRect(layout.midGridX, layout.gridTop, 0, i, 1, layout);
    const selected = (inv.focus === "mid" && inv.cursor === i) || (i === 3 && inv.multi);
    drawInvSlot(rect.x, rect.y, rect.size, selected);
    ctx.textAlign = "center";
    drawOutlineText(labels[i], rect.x + rect.size / 2, rect.y + rect.size / 2 + 5, 14);
    ctx.textAlign = "left";
  }
}

function drawSlotGrid(grid, cols, rows, originX, originY, layout, cursor, marked) {
  for (let i = 0; i < cols * rows; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const rect = slotRect(originX, originY, col, row, cols, layout);
    drawInvSlot(rect.x, rect.y, rect.size, cursor === i);
    if (marked && marked.indexOf(i) >= 0) {
      ctx.strokeStyle = "#7dff9a";
      ctx.lineWidth = 2;
      ctx.strokeRect(rect.x + 5, rect.y + 5, rect.size - 10, rect.size - 10);
    }
    drawItemInSlot(grid[i], rect.x, rect.y, rect.size);
  }
}

function hitInv(mx, my, inv) {
  const layout = invLayout(inv);
  const tabY = layout.top + 2;
  if (inv.mode === "character") {
    const tabW = layout.leftW / 3;
    if (my >= tabY && my <= tabY + layout.tabH) {
      if (mx >= layout.leftX && mx < layout.leftX + tabW) {
        return { kind: "tab", tab: "equips" };
      }
      if (mx >= layout.leftX + tabW && mx < layout.leftX + tabW * 2) {
        return { kind: "tab", tab: "tools" };
      }
      if (mx >= layout.leftX + tabW * 2 && mx <= layout.leftX + layout.leftW) {
        return { kind: "tab", tab: "foods" };
      }
    }
    const packHit = hitPageTabs(mx, my, layout.rightX, tabY, layout.rightW, layout.tabH, PACK_PAGES, "packPage");
    if (packHit) {
      return packHit;
    }
  } else {
    const chestHit = hitPageTabs(mx, my, layout.leftX, tabY, layout.leftW, layout.tabH, CHEST_PAGES, "chestPage");
    if (chestHit) {
      return chestHit;
    }
    const packHit = hitPageTabs(mx, my, layout.rightX, tabY, layout.rightW, layout.tabH, PACK_PAGES, "packPage");
    if (packHit) {
      return packHit;
    }
    for (let i = 0; i < 4; i += 1) {
      const r = slotRect(layout.midGridX, layout.gridTop, 0, i, 1, layout);
      if (mx >= r.x && mx <= r.x + r.size && my >= r.y && my <= r.y + r.size) {
        return { kind: "button", index: i };
      }
    }
  }
  const leftHits = leftSlotHits(inv, layout);
  for (let i = 0; i < leftHits.length; i += 1) {
    const r = leftHits[i];
    if (mx >= r.x && mx <= r.x + r.size && my >= r.y && my <= r.y + r.size) {
      return { kind: "left", index: i };
    }
  }
  for (let i = 0; i < 16; i += 1) {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const r = slotRect(layout.rightGridX, layout.gridTop, col, row, 4, layout);
    if (mx >= r.x && mx <= r.x + r.size && my >= r.y && my <= r.y + r.size) {
      return { kind: "right", index: i };
    }
  }
  return null;
}

function hitPageTabs(mx, my, x, y, w, h, pages, kind) {
  if (my < y || my > y + h || mx < x || mx > x + w) {
    return null;
  }
  const page = Math.floor((mx - x) / (w / pages));
  if (page < 0 || page >= pages) {
    return null;
  }
  return { kind: kind, page: page };
}

function leftSlotHits(inv, layout) {
  const hits = [];
  if (inv.mode === "chest") {
    for (let i = 0; i < CHEST_SIZE; i += 1) {
      const col = i % CHEST_COLS;
      const row = Math.floor(i / CHEST_COLS);
      hits.push(slotRect(layout.leftGridX, layout.gridTop, col, row, CHEST_COLS, layout));
    }
    return hits;
  }
  for (let i = 0; i < 8; i += 1) {
    const col = inv.tab === "equips" ? (i < 4 ? 0 : 1) : i % 2;
    const row = inv.tab === "equips" ? i % 4 : Math.floor(i / 2);
    hits.push(slotRect(layout.leftGridX, layout.gridTop, col, row, 2, layout));
  }
  return hits;
}

function drawInteractHint(spot) {
  let text = "";
  if (spot) {
    const action = spot.kind === "exit" ? "head to the " + (spot.label || "path").replace("Path to the ", "") : "open";
    text = "Press E to " + action + "  ·  " + spot.label;
  } else if (world && !isTownMap(world.mapId)) {
    text = "Click a monster to attack  ·  AUTO hunts  ·  Space to swing";
  }
  if (!text) {
    return;
  }
  const hintY = VIEW_H - MENU_H - 22;
  ctx.fillStyle = "rgba(20, 24, 32, 0.55)";
  ctx.fillRect(VIEW_W / 2 - 250, hintY - 24, 500, 36);
  ctx.fillStyle = "#fff8e8";
  ctx.textAlign = "center";
  ctx.font = "15px Trebuchet MS, sans-serif";
  ctx.fillText(text, VIEW_W / 2, hintY);
  ctx.textAlign = "left";
}
