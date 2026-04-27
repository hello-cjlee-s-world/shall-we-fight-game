    // ─── Game ─────────────────────────────────────────────────────
    class Game {
      constructor() {
        this.canvas = document.getElementById("game");
        this.map = new GameMap();
        this.factions = Object.fromEntries(Object.entries(factionDefs).map(([id, def]) => [id, new Faction(id, def)]));
        this.units = [];
        this.buildings = [];
        this.selectedUnits = [];
        this.effects = [];
        this.commandEffects = [];
        this.logs = [];
        this.unitSeq = 1;
        this.buildingSeq = 1;
        this.flashTarget = null;
        this.flashTimer = 0;
        this.started = false;
        this.gameOver = false;
        this.camera = { x: 0, y: 0, zoom: CAMERA_ZOOM, manualTimer: 0 };
        this.lastTime = performance.now();
        // UI dirty flags — 건물/유닛 패널은 매 프레임 갱신하지 않음
        this._uiDirty = { buildings: true, units: true };
        this._uiBuildingHash = "";
        this._uiUnitHash = "";
        // 공간 해시 (충돌 처리)
        this.spatialHash = new SpatialHash(TILE_SIZE * 2);

        this.createWorld();
        this.updateCamera(1);
        this.dialogue = new DialogueSystem(this);
        this.input = new InputManager(this, this.canvas);
        this.renderer = new Renderer(this, this.canvas);
        this.ai = [new AIController(this, this.factions.enemyA)];

        document.getElementById("startButton").addEventListener("click", () => this.startGame());
        document.getElementById("restartButton").addEventListener("click", () => this.restartGame());
        this.showStartScreen();
        this.log("작전 시작: 건물을 점령하고 적 세력을 제압하세요.");
        requestAnimationFrame(t => this.loop(t));
      }

      showStartScreen() {
        const overlay = document.getElementById("overlay");
        overlay.style.display = "flex";
        document.getElementById("overlayText").textContent = "세력전 준비";
        document.getElementById("startButton").style.display = "inline-block";
        document.getElementById("restartButton").style.display = "none";
        document.getElementById("gameStatus").textContent = "대기";
        // 시작 전 카메라를 플레이어 유닛 위치로 초기 이동
        const playerUnits = this.units.filter(u => u.faction.id === "player");
        if (playerUnits.length) {
          const cx = playerUnits.reduce((s, u) => s + u.x, 0) / playerUnits.length;
          const cy = playerUnits.reduce((s, u) => s + u.y, 0) / playerUnits.length;
          const viewW = this.canvas.width / this.camera.zoom;
          const viewH = this.canvas.height / this.camera.zoom;
          this.camera.x = clamp(cx - viewW/2, 0, WORLD_W - viewW);
          this.camera.y = clamp(cy - viewH/2, 0, WORLD_H - viewH);
        }
      }

      startGame() {
        this.started = true;
        document.getElementById("overlay").style.display = "none";
        document.getElementById("startButton").style.display = "none";
        document.getElementById("gameStatus").textContent = "교전 중";
        this.lastTime = performance.now();
        this.log("전투 시작");
      }

      // 게임 재시작: 전체 상태를 리셋하고 새 세계 생성
      restartGame() {
        this.units = [];
        this.buildings = [];
        this.selectedUnits = [];
        this.effects = [];
        this.commandEffects = [];
        this.logs = [];
        this.unitSeq = 1;
        this.buildingSeq = 1;
        this.flashTarget = null;
        this.flashTimer = 0;
        this.started = false;
        this.gameOver = false;
        this.camera = { x: 0, y: 0, zoom: CAMERA_ZOOM, manualTimer: 0 };
        this.factions = Object.fromEntries(Object.entries(factionDefs).map(([id, def]) => [id, new Faction(id, def)]));
        this.map = new GameMap();
        this._uiBuildingHash = "";
        this._uiUnitHash = "";
        this.createWorld();
        this.updateCamera(1);
        this.ai = [new AIController(this, this.factions.enemyA)];
        this.dialogue.activeTarget = null;
        document.getElementById("dialogueText").textContent = "대화 가능 대상 근처에서 E 키를 누르세요.";
        this.showStartScreen();
        this.log("새 작전 시작: 건물을 점령하고 적 세력을 제압하세요.");
      }

      createWorld() {
        const occupied = new Set();
        const reserve = tile => occupied.add(tileKey(tile.x, tile.y));
        const isFree = tile => tile && tile.walkable && !occupied.has(tileKey(tile.x, tile.y));
        const tileDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
        const randomFreeTile = (options = {}) => {
          const minFrom = options.minFrom || [];
          const minDistance = options.minDistance || 0;
          const edgePadding = options.edgePadding ?? 1;
          for (let i = 0; i < 1500; i++) {
            const tile = this.map.randomWalkableTile(this.buildings);
            if (!isFree(tile)) continue;
            if (tile.x < edgePadding || tile.y < edgePadding || tile.x >= MAP_W - edgePadding || tile.y >= MAP_H - edgePadding) continue;
            if (minFrom.some(other => tileDistance(tile, other) < minDistance)) continue;
            reserve(tile);
            return tile;
          }
          for (let y = 0; y < MAP_H; y++) {
            for (let x = 0; x < MAP_W; x++) {
              const tile = this.map.get(x, y);
              if (isFree(tile)) { reserve(tile); return tile; }
            }
          }
          return this.map.get(1, 1);
        };
        const randomNear = center => {
          const offsets = [];
          for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) offsets.push([dx, dy]);
          offsets.sort(() => Math.random() - 0.5);
          for (const [dx, dy] of offsets) {
            const tile = this.map.get(center.x+dx, center.y+dy);
            if (isFree(tile)) { reserve(tile); return tile; }
          }
          return randomFreeTile();
        };

        [
          BuildingType.BARRACKS, BuildingType.BARRACKS,
          BuildingType.HEALER,   BuildingType.HEALER,
          BuildingType.WATCH,    BuildingType.WATCH,
          BuildingType.MINE,     BuildingType.MINE, BuildingType.MINE,
          BuildingType.FORTRESS
        ].forEach(type => {
          const tile = randomFreeTile({ edgePadding: 2 });
          this.buildings.push(new Building(this.buildingSeq++, type, tile, this.factions.neutral));
        });

        const playerBase = randomFreeTile({ edgePadding: 2 });
        const enemyBase  = randomFreeTile({ edgePadding: 2, minFrom: [playerBase], minDistance: 18 });
        const neutralBase = randomFreeTile({ edgePadding: 2, minFrom: [playerBase, enemyBase], minDistance: 5 });

        for (let i = 0; i < 4; i++) this.spawnUnit(this.factions.player,  i===0 ? playerBase  : randomNear(playerBase));
        for (let i = 0; i < 4; i++) this.spawnUnit(this.factions.enemyA,  i===0 ? enemyBase   : randomNear(enemyBase));
        for (let i = 0; i < 7; i++) this.spawnUnit(this.factions.neutral, i===0 ? neutralBase : randomFreeTile({ edgePadding: 1 }));
      }

      spawnUnit(faction, tile) {
        const arch = archetypes[randInt(0, archetypes.length - 1)];
        const u = new Unit(this.unitSeq++, faction, tile, arch);
        this.units.push(u);
        return u;
      }
      spawnUnitNear(faction, tx, ty) {
        const candidates = [[0,1],[1,0],[-1,0],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
        for (const [dx, dy] of candidates) {
          const tile = this.map.get(tx+dx, ty+dy);
          if (tile && tile.walkable) {
            this.log(faction.name + " 신규 유닛 생산");
            return this.spawnUnit(faction, tile);
          }
        }
      }

      loop(now) {
        const dt = Math.min(0.05, (now - this.lastTime) / 1000) * GAME_SPEED;
        this.lastTime = now;
        if (this.started && !this.gameOver) this.update(dt);
        this.renderer.draw();
        this.updateUI();
        requestAnimationFrame(t => this.loop(t));
      }

      update(dt) {
        // 공간 해시 갱신
        this.spatialHash.clear();
        this.units.forEach(u => { if (u.hp > 0) this.spatialHash.insert(u); });

        this.units.forEach(u => u.update(dt, this));
        this.resolveCollisions();
        this.units = this.units.filter(u => u.hp > 0);
        this.buildings.forEach(b => b.update(dt, this));
        this.ai.forEach(ai => ai.update(dt));
        this.updateEffects(dt);
        this.updateCommandEffects(dt);
        this.updateCamera(dt);
        this.flashTimer += dt;
        if (this.flashTimer > 0.12) { this.flashTarget = null; this.flashTimer = 0; }
        this.checkEndConditions();
      }

      addHitEffect(attacker, target, damage) {
        const angle = Math.atan2(target.y - attacker.y, target.x - attacker.x);
        this.effects.push({
          x: target.x, y: target.y - 8,
          sx: attacker.x, sy: attacker.y - 8,
          angle, damage,
          life: 0.45, maxLife: 0.45,
          color: attacker.spriteColor
        });
      }
      updateEffects(dt) {
        this.effects.forEach(e => { e.life -= dt; e.y -= dt * 18; });
        this.effects = this.effects.filter(e => e.life > 0);
      }
      addCommandEffect(x, y, type, color) {
        this.commandEffects.push({
          x, y, type,
          color,
          life: 0.55,
          maxLife: 0.55
        });
      }
      updateCommandEffects(dt) {
        this.commandEffects.forEach(e => { e.life -= dt; });
        this.commandEffects = this.commandEffects.filter(e => e.life > 0);
      }
      screenToWorld(x, y) {
        if (this.renderer && this.renderer.screenToWorld) return this.renderer.screenToWorld(x, y);
        return { x: x / this.camera.zoom + this.camera.x, y: y / this.camera.zoom + this.camera.y };
      }
      updateCamera(dt) {
        const viewW = this.canvas.width / this.camera.zoom;
        const viewH = this.canvas.height / this.camera.zoom;
        const keys = this.input ? this.input.keys : new Set();
        let dx = 0, dy = 0;
        if (keys.has("arrowleft")  || keys.has("a")) dx -= 1;
        if (keys.has("arrowright") || keys.has("d")) dx += 1;
        if (keys.has("arrowup")    || keys.has("w")) dy -= 1;
        if (keys.has("arrowdown")  || keys.has("s")) dy += 1;
        if (dx || dy) {
          const length = Math.hypot(dx, dy);
          this.camera.x = clamp(this.camera.x + dx/length*520*dt, 0, Math.max(0, WORLD_W-viewW));
          this.camera.y = clamp(this.camera.y + dy/length*520*dt, 0, Math.max(0, WORLD_H-viewH));
          this.camera.manualTimer = 2.5;
          return;
        }
        this.camera.manualTimer = Math.max(0, this.camera.manualTimer - dt);
        if (this.camera.manualTimer > 0) return;
        const focusUnits = this.selectedUnits.length ? this.selectedUnits : this.units.filter(u => u.faction.id === "player");
        if (!focusUnits.length) return;
        const focus = focusUnits.reduce((acc, u) => { acc.x += u.x; acc.y += u.y; return acc; }, { x:0, y:0 });
        focus.x /= focusUnits.length; focus.y /= focusUnits.length;
        const targetX = clamp(focus.x - viewW/2, 0, WORLD_W - viewW);
        const targetY = clamp(focus.y - viewH/2, 0, WORLD_H - viewH);
        const follow = Math.min(1, dt * 5);
        this.camera.x += (targetX - this.camera.x) * follow;
        this.camera.y += (targetY - this.camera.y) * follow;
      }

      // 충돌 처리: SpatialHash 활용해 O(n) 수준으로 개선
      resolveCollisions() {
        this.spatialHash.clear();
        this.units.forEach(u => { if (u.hp > 0) this.spatialHash.insert(u); });
        for (const a of this.units) {
          if (a.hp <= 0) continue;
          const nearby = this.spatialHash.query(a.x, a.y, 20);
          for (const b of nearby) {
            if (b === a || b.hp <= 0) continue;
            const dx = b.x - a.x, dy = b.y - a.y;
            const d = Math.hypot(dx, dy);
            if (d > 0 && d < 17) {
              const push = (17 - d) * 0.35;
              a.x -= dx/d*push; a.y -= dy/d*push;
              b.x += dx/d*push; b.y += dy/d*push;
            }
          }
        }
      }

      selectAt(x, y) {
        const unit = [...this.units].reverse().find(u => u.faction.id === "player" && Math.hypot(u.x-x, u.y-y) < 18);
        this.clearSelection();
        if (unit) { unit.selected = true; this.selectedUnits = [unit]; }
      }
      selectBox(a, b) {
        this.clearSelection();
        const minX = Math.min(a.x,b.x), maxX = Math.max(a.x,b.x);
        const minY = Math.min(a.y,b.y), maxY = Math.max(a.y,b.y);
        this.selectedUnits = this.units.filter(u => u.faction.id==="player" && u.x>=minX && u.x<=maxX && u.y>=minY && u.y<=maxY);
        this.selectedUnits.forEach(u => u.selected = true);
      }
      clearSelection() { this.selectedUnits.forEach(u => u.selected = false); this.selectedUnits = []; }

      issueRightClick(x, y) {
        if (!this.selectedUnits.length) return;
        const targetUnit = this.units.find(u => u.faction.id !== "player" && Math.hypot(u.x-x, u.y-y) < 18);
        if (targetUnit) {
          this.selectedUnits.forEach(u => u.commandAttack(targetUnit));
          this.addCommandEffect(targetUnit.x, targetUnit.y, "attack", "#ff4d4d");
          this.log(targetUnit.name + " 공격 명령");
          return;
        }
        const targetBuilding = this.buildings.find(b => Math.abs(b.px-x) < 18 && Math.abs(b.py-y) < 18);
        if (targetBuilding) {
          this.selectedUnits.forEach((u, i) => this.commandUnitToTile(u, targetBuilding.x+(i%2), targetBuilding.y+Math.floor(i/2)%2));
          this.addCommandEffect(targetBuilding.px, targetBuilding.py, "capture", targetBuilding.faction.color);
          this.log(targetBuilding.type + " 점령 이동");
          return;
        }
        const tile = this.map.tileAtPixel(x, y);
        if (!tile || !tile.walkable) return;
        this.addCommandEffect(tile.x * TILE_SIZE + TILE_SIZE / 2, tile.y * TILE_SIZE + TILE_SIZE / 2, "move", "#9bd3ff");
        const formation = [[0,0],[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1],[-2,0],[2,0],[0,-2],[0,2]];
        this.selectedUnits.forEach((u, i) => {
          const [ox, oy] = formation[i % formation.length];
          this.commandUnitToTile(u, clamp(tile.x+ox, 0, MAP_W-1), clamp(tile.y+oy, 0, MAP_H-1));
        });
        this.log("이동 명령");
      }
      commandUnitToTile(unit, tx, ty) {
        const tile = this.map.get(tx, ty);
        if (!tile || !tile.walkable) return;
        unit.commandMove(this.map.findPath(unit.tileX, unit.tileY, tx, ty));
      }
      findNearestEnemy(unit, radius, factionIds) {
        return this.units
          .filter(u => u.hp>0 && factionIds.includes(u.faction.id) && Math.hypot(u.x-unit.x,u.y-unit.y)<=radius)
          .sort((a,b) => dist(unit,a)-dist(unit,b))[0];
      }
      findAutoAttackTarget(unit) {
        if (unit.faction.id === "neutral") return null;
        return this.units
          .filter(u => u.hp>0 && u!==unit && u.faction.id!=="neutral" && u.faction.id!==unit.faction.id && Math.hypot(u.x-unit.x,u.y-unit.y)<=unit.attackRange)
          .sort((a,b) => dist(unit,a)-dist(unit,b))[0];
      }
      log(msg) {
        this.logs.unshift(new Date().toLocaleTimeString("ko-KR",{hour12:false}) + " " + msg);
        this.logs = this.logs.slice(0, 4);
      }
      checkEndConditions() {
        const players  = this.units.filter(u => u.faction.id === "player");
        const enemies  = this.units.filter(u => u.faction.id === "enemyA");
        const fortress = this.buildings.find(b => b.type === BuildingType.FORTRESS);
        if (!players.length)
          this.endGame("패배: 플레이어 유닛이 모두 쓰러졌습니다.");
        else if (!enemies.length)
          this.endGame("승리: 적 세력을 모두 제거했습니다.");
        else if (fortress && fortress.fortressHeld >= 60)
          this.endGame("승리: 성채를 60초 동안 장악했습니다.");
        else if (fortress && fortress.enemyFortressHeld >= 60)
          this.endGame("패배: 적이 성채를 60초 동안 장악했습니다.");
      }
      endGame(text) {
        this.gameOver = true;
        const overlay = document.getElementById("overlay");
        overlay.style.display = "flex";
        document.getElementById("overlayText").textContent = text;
        document.getElementById("startButton").style.display = "none";
        document.getElementById("restartButton").style.display = "inline-block";
        document.getElementById("gameStatus").textContent = "종료";
      }

      // UI 갱신: dirty flag 패턴으로 불필요한 DOM 재작성 방지
      updateUI() {
        // 항상 갱신 (숫자형 — 빠름)
        document.getElementById("gold").textContent = Math.floor(this.factions.player.gold);
        document.getElementById("selectedCount").textContent = this.selectedUnits.length;
        document.getElementById("ownedBuildings").textContent = this.buildings.filter(b => b.faction.id==="player").length;
        const fortress = this.buildings.find(b => b.type === BuildingType.FORTRESS);
        document.getElementById("fortressTimer").textContent = (fortress ? fortress.fortressHeld : 0).toFixed(1) + "s";
        // 로그 (배열 길이가 4로 짧아서 비용 낮음)
        document.getElementById("logLines").innerHTML = this.logs.map(l => "<div>" + l + "</div>").join("");

        // 건물 패널 — 세력이 변할 때만 갱신
        const bHash = this.buildings.map(b => b.type + b.faction.id).join("|");
        if (bHash !== this._uiBuildingHash) {
          this._uiBuildingHash = bHash;
          const bd = document.getElementById("buildingDetails");
          bd.innerHTML = "";
          for (const b of this.buildings) {
            const row = document.createElement("div");
            row.className = "buildingRow";
            const nameSpan = document.createElement("span");
            nameSpan.textContent = b.type;
            const factionSpan = document.createElement("span");
            factionSpan.style.color = b.faction.color;
            factionSpan.textContent = b.faction.name;
            row.appendChild(nameSpan);
            row.appendChild(factionSpan);
            bd.appendChild(row);
          }
        }

        // 유닛 패널 — 선택/상태/HP가 변할 때만 갱신
        const uHash = this.selectedUnits.map(u => u.id + "|" + Math.ceil(u.hp) + "|" + u.state).join(";");
        if (uHash !== this._uiUnitHash) {
          this._uiUnitHash = uHash;
          const details = document.getElementById("unitDetails");
          if (!this.selectedUnits.length) {
            details.textContent = "유닛을 좌클릭하거나 드래그해서 선택하세요.";
          } else {
            details.innerHTML = "";
            for (const u of this.selectedUnits.slice(0, 6)) {
              // DOM API 사용으로 XSS 방지
              const row1 = document.createElement("div");
              row1.className = "unitRow";
              const nameSpan = document.createElement("span");
              nameSpan.textContent = u.name;
              const br = document.createElement("br");
              const roleText = document.createTextNode(u.role);
              nameSpan.appendChild(br);
              nameSpan.appendChild(roleText);
              const hpSpan = document.createElement("span");
              hpSpan.textContent = Math.ceil(u.hp) + "/" + u.maxHp;
              row1.appendChild(nameSpan); row1.appendChild(hpSpan);

              const bar = document.createElement("div");
              bar.className = "bar";
              const barInner = document.createElement("span");
              barInner.style.width = (100 * u.hp / u.maxHp) + "%";
              bar.appendChild(barInner);

              const row2 = document.createElement("div");
              row2.className = "unitRow";
              const statsSpan = document.createElement("span");
              statsSpan.textContent = "공격 " + u.attack + " / 방어 " + u.defense;
              const stateSpan = document.createElement("span");
              stateSpan.textContent = u.state;
              row2.appendChild(statsSpan); row2.appendChild(stateSpan);

              details.appendChild(row1);
              details.appendChild(bar);
              details.appendChild(row2);
            }
          }
        }
      }
    }

    new Game();


