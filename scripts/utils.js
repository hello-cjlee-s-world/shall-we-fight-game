    // ─── 유틸 ────────────────────────────────────────────────────
    function rand(min, max) { return Math.random() * (max - min) + min; }
    function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    function tileKey(x, y) { return x + "," + y; }

    // ─── 최소 힙 (A* 용) ─────────────────────────────────────────
    class MinHeap {
      constructor() { this.data = []; }
      push(item) {
        this.data.push(item);
        this._bubbleUp(this.data.length - 1);
      }
      pop() {
        const top = this.data[0];
        const last = this.data.pop();
        if (this.data.length > 0) { this.data[0] = last; this._sinkDown(0); }
        return top;
      }
      get size() { return this.data.length; }
      _bubbleUp(i) {
        while (i > 0) {
          const p = (i - 1) >> 1;
          if (this.data[p].f <= this.data[i].f) break;
          [this.data[p], this.data[i]] = [this.data[i], this.data[p]];
          i = p;
        }
      }
      _sinkDown(i) {
        const n = this.data.length;
        while (true) {
          let s = i, l = 2*i+1, r = 2*i+2;
          if (l < n && this.data[l].f < this.data[s].f) s = l;
          if (r < n && this.data[r].f < this.data[s].f) s = r;
          if (s === i) break;
          [this.data[s], this.data[i]] = [this.data[i], this.data[s]];
          i = s;
        }
      }
    }

    // ─── 공간 해시 (충돌 처리용) ─────────────────────────────────
    class SpatialHash {
      constructor(cellSize) { this.cellSize = cellSize; this.cells = new Map(); }
      _key(x, y) { return Math.floor(x/this.cellSize) + "," + Math.floor(y/this.cellSize); }
      clear() { this.cells.clear(); }
      insert(unit) {
        const k = this._key(unit.x, unit.y);
        if (!this.cells.has(k)) this.cells.set(k, []);
        this.cells.get(k).push(unit);
      }
      query(x, y, radius) {
        const result = [];
        const r = Math.ceil(radius / this.cellSize);
        const cx = Math.floor(x / this.cellSize);
        const cy = Math.floor(y / this.cellSize);
        for (let dx = -r; dx <= r; dx++) {
          for (let dy = -r; dy <= r; dy++) {
            const k = (cx+dx) + "," + (cy+dy);
            const cell = this.cells.get(k);
            if (cell) result.push(...cell);
          }
        }
        return result;
      }
    }


