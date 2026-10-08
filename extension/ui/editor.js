import { localize } from "./i18n.js";

const $ = (id) => document.getElementById(id);
const send = (msg) => chrome.runtime.sendMessage(msg);
const CELL = 20;

let assets = await send({ type: "assets" });
const t = localize(assets.i18n);
const { width: W, height: H, palette } = assets.sprites;

let overlay = blank();
let brush = "k";
let editingId = null;
let painting = null; // char being painted while dragging

function blank() {
  return Array.from({ length: H }, () => Array(W).fill("."));
}

function sparseRows() {
  const rows = {};
  overlay.forEach((r, y) => {
    const s = r.join("");
    if (/[^.]/.test(s)) rows[y] = s;
  });
  return rows;
}

function loadRows(rows) {
  overlay = blank();
  for (const [y, s] of Object.entries(rows || {})) overlay[y] = s.padEnd(W, ".").slice(0, W).split("");
}

// ---------- drawing ----------

const grid = $("grid");
grid.width = W * CELL;
grid.height = H * CELL;
const ctx = grid.getContext("2d");

function draw() {
  ctx.clearRect(0, 0, grid.width, grid.height);
  // Beepo underneath, faded.
  const { grid: base, palette: pal } = BeepoSprite.compose(assets, { mood: "happy" });
  ctx.globalAlpha = 0.35;
  base.forEach((row, y) =>
    row.forEach((c, x) => {
      if (c === "." || !pal[c]) return;
      ctx.fillStyle = pal[c];
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    })
  );
  ctx.globalAlpha = 1;
  overlay.forEach((row, y) =>
    row.forEach((c, x) => {
      if (c === ".") return;
      if (c === "_") {
        ctx.strokeStyle = "#ff5c7a";
        ctx.beginPath();
        ctx.moveTo(x * CELL + 4, y * CELL + 4);
        ctx.lineTo(x * CELL + CELL - 4, y * CELL + CELL - 4);
        ctx.stroke();
        return;
      }
      ctx.fillStyle = palette[c];
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    })
  );
  ctx.strokeStyle = "#1b1b2f14";
  for (let x = 0; x <= W; x++) ctx.strokeRect(x * CELL, 0, 0, grid.height);
  for (let y = 0; y <= H; y++) ctx.strokeRect(0, y * CELL, grid.width, 0);
  drawPreview();
}

function drawPreview() {
  const id = "__preview";
  const item = { id, slot: $("slot").value, name: "preview", rows: sparseRows() };
  const a = { ...assets, custom: [...(assets.custom || []), item] };
  $("preview").replaceChildren(
    ...["happy", "angry", "sleepy"].map((mood) => {
      const c = document.createElement("canvas");
      BeepoSprite.draw(c, a, { mood, scale: 4, look: { equipped: { [item.slot]: id } } });
      return c;
    })
  );
}

function cellAt(e) {
  const r = grid.getBoundingClientRect();
  return [Math.floor((e.clientX - r.left) / CELL), Math.floor((e.clientY - r.top) / CELL)];
}

grid.addEventListener("contextmenu", (e) => e.preventDefault());
grid.addEventListener("pointerdown", (e) => {
  painting = e.button === 2 ? "." : brush;
  grid.setPointerCapture(e.pointerId);
  paint(e);
});
grid.addEventListener("pointermove", (e) => painting && paint(e));
grid.addEventListener("pointerup", () => (painting = null));

function paint(e) {
  const [x, y] = cellAt(e);
  if (x < 0 || y < 0 || x >= W || y >= H || overlay[y][x] === painting) return;
  overlay[y][x] = painting;
  draw();
}

// ---------- controls ----------

function renderSwatches() {
  const entries = [...Object.entries(palette).filter(([k]) => k !== "a"), ["_", null]];
  $("swatches").replaceChildren(
    ...entries.map(([k, color]) => {
      const b = document.createElement("button");
      b.className = "sw" + (k === brush ? " on" : "");
      b.title = k === "_" ? t("edErase") : `${k} ${color}`;
      if (color) b.style.background = color;
      else b.textContent = "⌫";
      b.addEventListener("click", () => {
        brush = k;
        renderSwatches();
      });
      return b;
    })
  );
}

for (const [id, it] of Object.entries(assets.sprites.items)) {
  if (it.rows) $("base").append(new Option(assets.i18n.items[id] ?? it.name, id));
}
$("base").addEventListener("change", (e) => {
  const it = assets.sprites.items[e.target.value];
  loadRows(it?.rows);
  if (it) $("slot").value = it.slot;
  draw();
});
$("slot").addEventListener("change", drawPreview);
$("clear").addEventListener("click", () => {
  overlay = blank();
  editingId = null;
  $("name").value = "";
  draw();
});

$("copy").addEventListener("click", async () => {
  const json = JSON.stringify({ slot: $("slot").value, name: $("name").value || "Untitled", price: 5, rows: sparseRows() }, null, 2);
  await navigator.clipboard.writeText(json);
  $("msg").textContent = t("edCopied");
});

$("save").addEventListener("click", async () => {
  const rows = sparseRows();
  if (!Object.keys(rows).length) return ($("msg").textContent = t("edDrawFirst"));
  const item = { id: editingId, slot: $("slot").value, name: $("name").value.trim() || t("edDefaultName"), rows };
  editingId = (await send({ type: "saveCustom", item }))?.id ?? editingId;
  $("msg").textContent = t("edSaved");
  await reloadCustoms();
});

async function reloadCustoms() {
  assets = await send({ type: "assets" });
  $("customs").replaceChildren(
    ...(assets.custom.length
      ? assets.custom.map((c) => {
          const row = document.createElement("div");
          row.className = "row";
          const name = document.createElement("span");
          name.className = "grow";
          name.textContent = c.name;
          const edit = Object.assign(document.createElement("button"), { className: "icon", textContent: "✎", title: t("edit") });
          edit.addEventListener("click", () => {
            editingId = c.id;
            $("name").value = c.name;
            $("slot").value = c.slot;
            loadRows(c.rows);
            draw();
          });
          const del = Object.assign(document.createElement("button"), { className: "icon", textContent: "×", title: t("delete") });
          del.addEventListener("click", async () => {
            await send({ type: "deleteCustom", id: c.id });
            if (editingId === c.id) editingId = null;
            reloadCustoms();
          });
          row.append(name, edit, del);
          return row;
        })
      : [Object.assign(document.createElement("div"), { className: "hint", textContent: t("edNothing") })])
  );
}

renderSwatches();
draw();
reloadCustoms();
