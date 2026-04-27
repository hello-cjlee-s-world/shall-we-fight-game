    // ─── Tile ─────────────────────────────────────────────────────
    class Tile {
      constructor(x, y, type) { this.x = x; this.y = y; this.type = type; }
      get walkable() { return this.type !== TileType.WATER; }
      get moveCost() {
        if (this.type === TileType.FOREST)   return 1.9;
        if (this.type === TileType.MOUNTAIN) return 2.4;
        return 1;
      }
      get defenseBonus() { return this.type === TileType.FOREST ? 3 : 0; }
    }

    // ─── GameMap (이름 충돌 방지) ─────────────────────────────────
    class GameMap {
      constructor() { this.tiles = []; this.generate(); }
      generate() {
        for (let y = 0; y < MAP_H; y++) {
          this.tiles[y] = [];
          for (let x = 0; x < MAP_W; x++) {
            const n = Math.random();
            let type = TileType.PLAIN;
            if      (n < 0.12) type = TileType.WATER;
            else if (n < 0.27) type = TileType.FOREST;
            else if (n < 0.38) type = TileType.MOUNTAIN;
            this.tiles[y][x] = new Tile(x, y, type);
          }
        }
      }
      inBounds(x, y) { return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H; }
      get(x, y) { return this.inBounds(x, y) ? this.tiles[y][x] : null; }
      tileAtPixel(px, py) { return this.get(Math.floor(px / TILE_SIZE), Math.floor(py / TILE_SIZE)); }
      randomWalkableTile(avoidBuildings) {
        for (let i = 0; i < 800; i++) {
          const x = randInt(0, MAP_W - 1);
          const y = randInt(0, MAP_H - 1);
          if (!this.get(x, y).walkable) continue;
          if (avoidBuildings && avoidBuildings.some(b => b.x === x && b.y === y)) continue;
          return this.get(x, y);
        }
        return this.get(1, 1);
      }
      // A* with MinHeap — O(n log n)
      findPath(startX, startY, endX, endY) {
        if (!this.inBounds(endX, endY) || !this.get(endX, endY).walkable) return [];
        const open = new MinHeap();
        open.push({ x: startX, y: startY, g: 0, f: 0, parent: null });
        const best = new Map();
        best.set(tileKey(startX, startY), 0);
        const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
        while (open.size) {
          const cur = open.pop();
          if (cur.x === endX && cur.y === endY) {
            const path = [];
            let n = cur;
            while (n.parent) {
              path.unshift({ x: n.x * TILE_SIZE + TILE_SIZE / 2, y: n.y * TILE_SIZE + TILE_SIZE / 2 });
              n = n.parent;
            }
            return path;
          }
          for (const [dx, dy] of dirs) {
            const nx = cur.x + dx, ny = cur.y + dy;
            const tile = this.get(nx, ny);
            if (!tile || !tile.walkable) continue;
            const ng = cur.g + tile.moveCost;
            const key = tileKey(nx, ny);
            if (best.has(key) && best.get(key) <= ng) continue;
            best.set(key, ng);
            const h = Math.abs(endX - nx) + Math.abs(endY - ny);
            open.push({ x: nx, y: ny, g: ng, f: ng + h, parent: cur });
          }
        }
        return [];
      }
    }


