    // ─── DialogueSystem ──────────────────────────────────────────
    class DialogueSystem {
      constructor(game) {
        this.game = game;
        this.activeTarget = null;
        this.activeSpeaker = null;   // speaker도 추적해야 close()에서 상태 복구 가능
        this.textEl = document.getElementById("dialogueText");
        this.rewardBtn = document.getElementById("rewardBtn");
        document.querySelectorAll("[data-choice]").forEach(btn => {
          btn.addEventListener("click", () => this.choose(btn.dataset.choice));
        });
      }

      tryOpen() {
        const speaker = this.game.selectedUnits.find(u => u.faction.id === "player");
        if (!speaker) return;
        const target = this.game.units
          .filter(u => u.hp > 0 && u.faction.id !== "player" && Math.hypot(u.x - speaker.x, u.y - speaker.y) < 64)
          .sort((a, b) => dist(speaker, a) - dist(speaker, b))[0];
        if (!target) {
          this.textEl.textContent = "근처에 대화할 캐릭터가 없습니다.";
          return;
        }
        // 이미 다른 대화가 열려 있으면 먼저 정리
        if (this.activeTarget) this.close();

        this.activeTarget  = target;
        this.activeSpeaker = speaker;
        speaker.state = "talking";
        target.state  = "talking";
        this._refreshRewardBtn();
        this.textEl.textContent = target.name + " (" + target.role + ")와 대화 중. 충성도 " + Math.round(target.loyalty);
      }

      // ── 대화 종료 공통 정리 함수 ──────────────────────────────────
      // 모든 대화 종료 경로(성공·실패·ESC·대상 사망·재시작)에서 반드시 호출
      close(reason) {
        if (this.activeSpeaker && this.activeSpeaker.hp > 0 && this.activeSpeaker.state === "talking") {
          this.activeSpeaker.state = "idle";
        }
        if (this.activeTarget && this.activeTarget.hp > 0 && this.activeTarget.state === "talking") {
          this.activeTarget.state = "idle";
        }
        this.activeSpeaker = null;
        this.activeTarget  = null;
        if (reason !== "silent") {
          this.textEl.textContent = "대화 가능 대상 근처에서 E 키를 누르세요.";
        }
      }

      // Gold 부족 시 보상 버튼 비활성화
      _refreshRewardBtn() {
        this.rewardBtn.disabled = this.game.factions.player.gold < 25;
        this.rewardBtn.title = this.rewardBtn.disabled ? "Gold 부족 (25 필요)" : "";
      }

      choose(choice) {
        const target  = this.activeTarget;
        const speaker = this.activeSpeaker;

        // 대화 대상 또는 speaker가 이미 사라진 경우 즉시 정리
        if (!target || target.hp <= 0) { this.close(); return; }
        if (!speaker || speaker.hp <= 0) { this.close(); return; }

        const hard = target.faction.id === "neutral" ? 1 : 0.55;
        let delta = 0;
        if (choice === "friendly") delta = (speaker.persuasion + randInt(6, 15)) * hard;
        if (choice === "pressure") delta = (speaker.attack - target.defense + randInt(-4, 12)) * hard;
        if (choice === "reward") {
          if (this.game.factions.player.gold >= 25) {
            this.game.factions.player.gold -= 25;
            delta = (22 + randInt(0, 16)) * hard;
          } else {
            delta = -8;
          }
        }
        target.loyalty = clamp(target.loyalty + delta, -30, 120);

        if (target.loyalty >= 75) {
          // ── 회유 성공: 세력 전환 후 대화 종료
          target.faction = this.game.factions.player;
          target.target  = null;
          this.textEl.textContent = target.name + " 합류! 이제 푸른 연맹 소속입니다.";
          this.game.log(target.name + " 회유 성공");
          this.close("silent");   // textEl은 이미 위에서 설정했으므로 silent
        } else {
          // ── 회유 진행 중: 대화 유지
          this._refreshRewardBtn();
          this.textEl.textContent = target.name + " 충성도 변화: " + Math.round(target.loyalty) + "/75";
        }
      }

      // ── 매 프레임 상태 검증 ────────────────────────────────────────
      // 대화 중 target/speaker가 전투 등으로 사망하면 자동 종료
      tick() {
        if (!this.activeTarget && !this.activeSpeaker) return;
        const targetDead  = !this.activeTarget  || this.activeTarget.hp  <= 0;
        const speakerDead = !this.activeSpeaker || this.activeSpeaker.hp <= 0;
        if (targetDead || speakerDead) {
          this.game.log("대화 중단: 대상 전투 불능");
          this.close();
        }
      }
    }

    // ─── AIController ────────────────────────────────────────────
    class AIController {
      constructor(game, faction) {
        this.game = game;
        this.faction = faction;
        this.timer = rand(1, 3);
      }
      update(dt) {
        this.timer -= dt;
        const units = this.game.units.filter(u => u.hp > 0 && u.faction.id === this.faction.id);

        // 감시탑 시야 보너스 계산
        const watchVisionBonus = this._watchVisionBonus();

        for (const unit of units) {
          // 우선순위 1: 가까운 적 공격 (감시탑 보유 시 탐지 반경 증가)
          const detectionRadius = 190 + watchVisionBonus * TILE_SIZE;
          const player = this.game.findNearestEnemy(unit, detectionRadius, ["player"]);
          if (player) { unit.commandAttack(player); continue; }

          if (unit.state === "idle") {
            // 우선순위 2: 성채 점령 (전략적 목표 우선)
            const fortress = this.game.buildings.find(b => b.type === BuildingType.FORTRESS && b.faction.id !== this.faction.id);
            if (fortress && Math.random() < 0.4) {
              this.game.commandUnitToTile(unit, fortress.x, fortress.y);
              continue;
            }
            // 우선순위 3: 금광 → 병영 → 기타 순으로 점령
            const targetBuilding = this.game.buildings
              .filter(b => b.faction.id !== this.faction.id)
              .sort((a, b) => {
                const priority = { [BuildingType.MINE]: 0, [BuildingType.BARRACKS]: 1, [BuildingType.HEALER]: 2, [BuildingType.WATCH]: 3, [BuildingType.FORTRESS]: 4 };
                const pa = priority[a.type] ?? 5, pb = priority[b.type] ?? 5;
                if (pa !== pb) return pa - pb;
                return Math.hypot(unit.x - a.px, unit.y - a.py) - Math.hypot(unit.x - b.px, unit.y - b.py);
              })[0];
            if (targetBuilding && Math.random() < 0.65) {
              this.game.commandUnitToTile(unit, targetBuilding.x, targetBuilding.y);
            }
          }
        }

        // 주기적으로 랜덤 이동 (소수 유닛만)
        if (this.timer <= 0) {
          this.timer = rand(5, 9);
          units.forEach(unit => {
            if (Math.random() < 0.25) {
              const tile = this.game.map.randomWalkableTile(this.game.buildings);
              this.game.commandUnitToTile(unit, tile.x, tile.y);
            }
          });
        }
      }
      // AI 전용: 감시탑 점령 시 적 탐지 반경을 타일 단위로 늘린다.
      // 플레이어 시야(fog of war)와는 무관하며, AI detectionRadius 계산에만 사용된다.
      // fog of war를 추가한다면 VisionSystem 같은 별도 시스템으로 분리할 것.
      _watchVisionBonus() {
        return this.game.buildings.some(b => b.type === BuildingType.WATCH && b.faction.id === this.faction.id)
          ? WATCH_TOWER_VISION_BONUS : 0;
      }
    }

    // ─── InputManager ────────────────────────────────────────────
    class InputManager {
      constructor(game, canvas) {
        this.game = game;
        this.canvas = canvas;
        this.dragging = false;
        this.dragStart = null;
        this.dragEnd = null;
        this.keys = new Set();
        canvas.addEventListener("contextmenu", e => e.preventDefault());
        canvas.addEventListener("mousedown", e => this.onDown(e));
        canvas.addEventListener("mousemove", e => this.onMove(e));
        canvas.addEventListener("mouseup", e => this.onUp(e));
        window.addEventListener("keydown", e => this.onKey(e));
        window.addEventListener("keyup", e => this.keys.delete(e.key.toLowerCase()));
      }
      mouse(e) {
        const r = this.canvas.getBoundingClientRect();
        const screen = {
          x: (e.clientX - r.left) * (this.canvas.width / r.width),
          y: (e.clientY - r.top) * (this.canvas.height / r.height)
        };
        return this.game.screenToWorld(screen.x, screen.y);
      }
      onDown(e) {
        const p = this.mouse(e);
        if (e.button === 0) { this.dragging = true; this.dragStart = p; this.dragEnd = p; }
        else if (e.button === 2) { this.game.issueRightClick(p.x, p.y); }
      }
      onMove(e) { if (this.dragging) this.dragEnd = this.mouse(e); }
      onUp(e) {
        if (e.button !== 0) return;
        const p = this.mouse(e);
        this.dragEnd = p;
        const moved = Math.hypot(this.dragStart.x - p.x, this.dragStart.y - p.y);
        if (moved < 5) this.game.selectAt(p.x, p.y);
        else this.game.selectBox(this.dragStart, this.dragEnd);
        this.dragging = false;
      }
      onKey(e) {
        const key = e.key.toLowerCase();
        // 방향키·WASD: 브라우저 스크롤 기본 동작 차단
        if (["arrowleft","arrowright","arrowup","arrowdown","w","a","s","d"].includes(key)) {
          e.preventDefault();
        }
        this.keys.add(key);
        // 버튼/입력 UI에 포커스가 있으면 게임 단축키 처리 안 함
        const tag = document.activeElement && document.activeElement.tagName;
        if (tag === "BUTTON" || tag === "INPUT" || tag === "TEXTAREA") return;
        if (e.key === "Escape") {
          // ESC: 대화 중이면 대화를 먼저 닫고, 그 외엔 선택 해제
          if (this.game.dialogue.activeTarget) {
            this.game.dialogue.close();
          } else {
            this.game.clearSelection();
          }
        }
        if (key === "e" && this.game.started && !this.game.gameOver) this.game.dialogue.tryOpen();
      }
    }
