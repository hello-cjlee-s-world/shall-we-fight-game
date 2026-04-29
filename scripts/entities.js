    // ─── Faction ─────────────────────────────────────────────────
    class Faction {
      constructor(id, def) {
        this.id = id;
        this.name = def.name;
        this.color = def.color;
        this.gold = id === "player" ? 80 : 60;
      }
    }

    // ─── Unit ─────────────────────────────────────────────────────
    class Unit {
      constructor(id, faction, tile, archetype) {
        this.id = id;
        this.name = namePartsA[randInt(0, namePartsA.length-1)] + " " + namePartsB[randInt(0, namePartsB.length-1)];
        this.kind = archetype.kind;
        this.role = archetype.title;
        this.spriteColor = archetype.color;
        this.faction = faction;
        this.hp = 100; this.maxHp = 100;
        this.attack = archetype.attack;
        this.defense = archetype.defense;
        this.moveSpeed = rand(62, 80);
        this.attackRange = archetype.range * TILE_SIZE;
        this.persuasion = archetype.persuasion;
        this.loyalty = faction.id === "neutral" ? randInt(20, 45) : randInt(0, 20);
        this.x = tile.x * TILE_SIZE + TILE_SIZE / 2;
        this.y = tile.y * TILE_SIZE + TILE_SIZE / 2;
        this.target = null;
        this.path = [];
        this.state = "idle";
        this.attackCooldown = rand(0, 0.6);
        this.moveMarker = null;
        this.selected = false;
        this.facing = "down";
        this.animTime = Math.random() * 10;
        this.attackAnim = 0;
        this.attackAngle = 0;
        this.manualMove = false;
      }
      get tileX() { return Math.floor(this.x / TILE_SIZE); }
      get tileY() { return Math.floor(this.y / TILE_SIZE); }
      isEnemy(other) { return other && this.faction.id !== other.faction.id && other.faction.id !== "neutral"; }
      commandMove(path) {
        this.target = null;
        this.path = path;
        this.state = path.length ? "moving" : "idle";
        this.moveMarker = path[path.length - 1] || null;
        this.manualMove = path.length > 0;
      }
      commandAttack(target) {
        this.manualMove = false;
        this.target = target;
        this.state = "attacking";
      }
      update(dt, game) {
        if (this.hp <= 0) return;
        this.animTime += dt;
        this.attackAnim = Math.max(0, this.attackAnim - dt * 5);
        this.attackCooldown = Math.max(0, this.attackCooldown - dt);

        // 대화 중이면 자동 공격 차단
        if (this.state === "talking") return;

        if (!this.manualMove && this.state !== "attacking") {
          const nearbyEnemy = game.findAutoAttackTarget(this);
          if (nearbyEnemy) {
            this.path = [];
            this.moveMarker = null;
            this.commandAttack(nearbyEnemy);
          }
        }
        if (this.state === "attacking" && this.target && this.target.hp > 0) {
          const d = dist(this, this.target);
          if (d <= this.attackRange) {
            if (this.attackCooldown <= 0) {
              const tile = game.map.get(this.target.tileX, this.target.tileY);
              const mitigation = this.target.defense + (tile ? tile.defenseBonus : 0);
              const damage = Math.max(4, this.attack - mitigation + randInt(-2, 3));
              this.target.hp -= damage;
              this.attackCooldown = 0.9;
              this.attackAnim = 1;
              this.attackAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
              game.flashTarget = this.target;
              game.addHitEffect(this, this.target, damage);
              if (this.target.hp <= 0) game.log(this.target.name + " 전투 불능");
            }
          } else {
            this.moveToward(this.target.x, this.target.y, dt, game);
          }
        } else if (this.path.length) {
          const next = this.path[0];
          if (this.moveToward(next.x, next.y, dt, game)) this.path.shift();
          this.state = this.path.length ? "moving" : "idle";
          if (!this.path.length) this.manualMove = false;
        } else {
          this.state = "idle";
          this.manualMove = false;
        }
      }
      moveToward(tx, ty, dt, game) {
        const tile = game.map.get(this.tileX, this.tileY);
        const terrainCost = tile ? tile.moveCost : 1;
        const speed = this.moveSpeed / terrainCost;
        const dx = tx - this.x, dy = ty - this.y;
        const d = Math.hypot(dx, dy);
        if (d < 2) return true;
        this.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
        this.x += dx / d * speed * dt;
        this.y += dy / d * speed * dt;
        this.x = clamp(this.x, 8, WORLD_W - 8);
        this.y = clamp(this.y, 8, WORLD_H - 8);
        return false;
      }
    }

    // ─── Building ─────────────────────────────────────────────────
    class Building {
      constructor(id, type, tile, faction) {
        this.id = id;
        this.type = type;
        this.x = tile.x;
        this.y = tile.y;
        this.faction = faction;
        this.captureFaction = null;
        this.captureProgress = 0;
        this.spawnTimer = rand(4, 8);
        this.resourceTimer = 0;
        this.fortressHeld = 0;       // 플레이어 성채 점령 시간
        this.enemyFortressHeld = 0;  // 적 성채 점령 시간 (패배 조건)
      }
      get px() { return this.x * TILE_SIZE + TILE_SIZE / 2; }
      get py() { return this.y * TILE_SIZE + TILE_SIZE / 2; }
      update(dt, game) {
        const nearby = game.units.filter(u => u.hp > 0 && Math.hypot(u.x - this.px, u.y - this.py) < TILE_SIZE * 1.45);
        const groups = {};
        nearby.forEach(u => groups[u.faction.id] = (groups[u.faction.id] || 0) + 1);
        const contenders = Object.keys(groups).filter(id => id !== this.faction.id);
        if (contenders.length) {
          contenders.sort((a, b) => groups[b] - groups[a]);
          const top = contenders[0];
          const incomingFaction = game.factions[top];

          // 점령 시도 세력이 바뀌었으면 progress 초기화
          // (예: 적이 90% 쌓은 게이지를 플레이어가 그대로 이어받는 것 방지)
          if (this.captureFaction && this.captureFaction.id !== incomingFaction.id) {
            this.captureProgress = 0;
          }

          this.captureFaction = incomingFaction;
          this.captureProgress += dt * groups[top] * 18;
          if (this.captureProgress >= 100) {
            this.faction = this.captureFaction;
            this.captureProgress = 0;
            this.captureFaction = null;
            game.log(this.type + " 점령: " + this.faction.name);
          }
        } else {
          // 점령 시도 세력 없음: 게이지 감산, 0이 되면 captureFaction 해제
          this.captureProgress = Math.max(0, this.captureProgress - dt * 10);
          if (this.captureProgress === 0) this.captureFaction = null;
        }

        if (this.faction.id !== "neutral") {
          if (this.type === BuildingType.MINE) {
            this.resourceTimer += dt;
            if (this.resourceTimer > 2) { this.faction.gold += 8; this.resourceTimer = 0; }
          }
          if (this.type === BuildingType.HEALER) {
            nearby.filter(u => u.faction.id === this.faction.id).forEach(u => {
              u.hp = Math.min(u.maxHp, u.hp + 10 * dt);
            });
          }
          if (this.type === BuildingType.BARRACKS) {
            this.spawnTimer -= dt;
            if (this.spawnTimer <= 0 && this.faction.gold >= 30) {
              this.faction.gold -= 30;
              game.spawnUnitNear(this.faction, this.x, this.y);
              this.spawnTimer = 13;
            }
          }
          // 성채: 플레이어 / 적 각각 점령 시간 누적 (대칭 승패 조건)
          if (this.type === BuildingType.FORTRESS) {
            if (this.faction.id === "player") {
              this.fortressHeld += dt;
              this.enemyFortressHeld = 0;
            } else if (this.faction.id === "enemyA") {
              this.enemyFortressHeld += dt;
              this.fortressHeld = 0;
            } else {
              this.fortressHeld = 0;
              this.enemyFortressHeld = 0;
            }
          }
          // 감시탑: 점령 중인 세력에게 시야 반경 확장 표시 (렌더러에서 활용)
          // 실제 효과: 점령 세력의 적 탐지 범위를 WATCH_TOWER_VISION_BONUS 타일만큼 증가
        }
      }
    }
