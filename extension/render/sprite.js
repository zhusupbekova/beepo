// Composes Beepo from data/sprites.json layers and draws him on a <canvas>.
// Classic script (no modules) so content scripts, pages and node can all load it.
//
// Overlay format: { rowIndex: "16 chars" } where '.' keeps the pixel below,
// '_' clears it, and any other char is a palette key.
(function () {
  function applyOverlay(grid, rows) {
    for (const [y, line] of Object.entries(rows || {})) {
      const row = grid[y];
      if (!row) continue;
      for (let x = 0; x < line.length && x < row.length; x++) {
        const c = line[x];
        if (c === ".") continue;
        row[x] = c === "_" ? "." : c;
      }
    }
  }

  function findItem(assets, id) {
    if (!id) return null;
    return assets.sprites.items[id] || (assets.custom || []).find((c) => c.id === id) || null;
  }

  /**
   * opts: { mood, pose, look: { equipped, evolve: [ids], scruffy } }
   * Returns { grid: string[][], palette }.
   */
  function compose(assets, opts = {}) {
    const S = assets.sprites;
    const look = opts.look || {};
    const eq = look.equipped || {};
    const grid = S.body.map((r) => r.split(""));
    const palette = { ...S.palette, ...(findItem(assets, eq.color)?.colors || {}) };

    if (opts.pose && S.poses[opts.pose]) applyOverlay(grid, S.poses[opts.pose]);

    const face = S.faces[opts.mood] || S.faces.neutral;
    for (let fy = 0; fy < face.length; fy++) {
      for (let fx = 0; fx < face[fy].length; fx++) grid[S.faceRow + fy][S.faceCol + fx] = face[fy][fx];
    }

    for (const id of look.evolve || []) applyOverlay(grid, S.evolve.find((e) => e.id === id)?.rows);
    if (look.scruffy) applyOverlay(grid, S.scruffy.rows);
    for (const slot of ["antenna", "accessory", "hat"]) applyOverlay(grid, findItem(assets, eq[slot])?.rows);
    return { grid, palette };
  }

  function drawGrid(canvas, grid, palette, scale, flip) {
    const h = grid.length;
    const w = grid[0].length;
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = grid[y][x];
        if (c === "." || !palette[c]) continue;
        ctx.fillStyle = palette[c];
        ctx.fillRect((flip ? w - 1 - x : x) * scale, y * scale, scale, scale);
      }
    }
  }

  function draw(canvas, assets, opts = {}) {
    const { grid, palette } = compose(assets, opts);
    drawGrid(canvas, grid, palette, opts.scale || 4);
  }

  function drawPet(canvas, assets, petId, frame, scale, flip) {
    const pet = findItem(assets, petId);
    if (!pet?.frames) return false;
    const f = pet.frames[frame % pet.frames.length].map((r) => r.split(""));
    drawGrid(canvas, f, assets.sprites.palette, scale, flip);
    return true;
  }

  globalThis.BeepoSprite = { compose, draw, drawGrid, drawPet, applyOverlay, findItem };
})();
