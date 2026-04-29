    // ─── Three.js Renderer ───────────────────────────────────────
    class Renderer {
      constructor(game, canvas) {
        this.game = game;
        this.canvas = canvas;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0d1118);
        this.scene.fog = new THREE.Fog(0x0d1118, 900, 1900);
        this.camera3d = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 3000);
        this.raycaster = new THREE.Raycaster();
        this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.tmpVec2 = new THREE.Vector2();
        this.tmpVec3 = new THREE.Vector3();

        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
        this.renderer.setSize(canvas.width, canvas.height, false);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.mapGroup = new THREE.Group();
        this.buildingGroup = new THREE.Group();
        this.unitGroup = new THREE.Group();
        this.effectGroup = new THREE.Group();
        this.overlayGroup = new THREE.Group();
        this.scene.add(this.mapGroup, this.buildingGroup, this.unitGroup, this.effectGroup, this.overlayGroup);

        this.materials = this.createMaterials();
        this.geometries = this.createGeometries();

        // ── 캐시 ────────────────────────────────────────────────
        // 건물 타입별 고정 material (bodyMat, accentMat): 타입이 변하지 않으므로 한 번만 생성
        this.buildingTypeMats = this._createBuildingTypeMats();
        // 세력 color → MeshStandardMaterial 캐시 (건물 factionMat, 유닛 factionMat 공용)
        this.factionMatCache = new Map();
        // 유닛 spriteColor → MeshStandardMaterial 캐시 (gearMat)
        this.gearMatCache = new Map();
        // 유닛 라벨 role → { texture, material } 캐시
        this.labelCache = new Map();

        this.mapRef = null;
        this.addLights();
      }

      // ── 건물 타입별 고정 material 사전 생성 ─────────────────────
      _createBuildingTypeMats() {
        const make = (color, roughness = 0.68, metalness = 0.03) =>
          new THREE.MeshStandardMaterial({ color, roughness, metalness });
        return {
          [BuildingType.BARRACKS]: {
            body:   make(0xb95538),
            accent: make(0xf3c05f, 0.45, 0.08),
            height: 22
          },
          [BuildingType.HEALER]: {
            body:   make(0xf4f7fb),
            accent: make(0x40d187, 0.45, 0.08),
            height: 20
          },
          [BuildingType.WATCH]: {
            body:   make(0x8b6f4e),
            accent: make(0x8fd3ff, 0.45, 0.08),
            height: 36
          },
          [BuildingType.MINE]: {
            body:   make(0x7a6246),
            accent: make(0xffd15a, 0.45, 0.08),
            height: 18
          },
          [BuildingType.FORTRESS]: {
            body:   make(0x596579),
            accent: make(0xd9e6ff, 0.45, 0.08),
            height: 30
          }
        };
      }

      // ── 세력/장비 색상 material 캐시 lookup ─────────────────────
      _getFactionMat(colorHex) {
        if (!this.factionMatCache.has(colorHex)) {
          this.factionMatCache.set(colorHex,
            new THREE.MeshStandardMaterial({ color: new THREE.Color(colorHex), roughness: 0.55 })
          );
        }
        return this.factionMatCache.get(colorHex);
      }

      _getGearMat(colorHex) {
        if (!this.gearMatCache.has(colorHex)) {
          this.gearMatCache.set(colorHex,
            new THREE.MeshStandardMaterial({ color: new THREE.Color(colorHex), roughness: 0.45 })
          );
        }
        return this.gearMatCache.get(colorHex);
      }

      createMaterials() {
        const make = (color, options = {}) => new THREE.MeshStandardMaterial({
          color,
          roughness: options.roughness ?? 0.78,
          metalness: options.metalness ?? 0.05,
          flatShading: options.flatShading ?? true,
          transparent: options.transparent ?? false,
          opacity: options.opacity ?? 1
        });
        return {
          plain: make(0x5fa85f),
          plainAlt: make(0x6bb86a),
          forest: make(0x2f7b48),
          forestDark: make(0x215235),
          water: new THREE.MeshStandardMaterial({ color: 0x2d83c4, roughness: 0.34, metalness: 0.05, transparent: true, opacity: 0.88 }),
          waterFoam: new THREE.MeshBasicMaterial({ color: 0x9bdcff, transparent: true, opacity: 0.45 }),
          mountain: make(0x838a92),
          mountainDark: make(0x5e656d),
          dark: make(0x171b22, { roughness: 0.82 }),
          white: make(0xf8fafc),
          wood: make(0x6b4528, { roughness: 0.92 }),
          stone: make(0x6f7682, { roughness: 0.86 }),
          metal: make(0xc8d0d9, { roughness: 0.34, metalness: 0.35 }),
          leather: make(0x5b3924, { roughness: 0.75 }),
          skin: make(0xf1c99d, { roughness: 0.62 }),
          path: make(0x9b7b52, { roughness: 0.9 }),
          outline: new THREE.MeshBasicMaterial({ color: 0x05070a, side: THREE.BackSide }),
          hpBack: new THREE.MeshBasicMaterial({ color: 0x1b1f27 }),
          hpGood: new THREE.MeshBasicMaterial({ color: 0x54e37f }),
          hpBad: new THREE.MeshBasicMaterial({ color: 0xff5c5c }),
          selected: new THREE.MeshBasicMaterial({ color: 0xfff36d }),
          move: new THREE.MeshBasicMaterial({ color: 0xffffff }),
          capture: new THREE.MeshBasicMaterial({ color: 0xffffff }),
          shadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 }),
          hit: new THREE.MeshBasicMaterial({ color: 0xfff7a8, transparent: true, opacity: 0.9 }),
          flashRing: new THREE.MeshBasicMaterial({ color: 0xff2b2b }),
          selectionBox: new THREE.LineBasicMaterial({ color: 0x9bd3ff })
        };
      }

      createGeometries() {
        return {
          tile: new THREE.BoxGeometry(TILE_SIZE, 3, TILE_SIZE),
          water: new THREE.BoxGeometry(TILE_SIZE, 1, TILE_SIZE),
          grassBlade: new THREE.BoxGeometry(2, 7, 2),
          treeTop: new THREE.ConeGeometry(9, 20, 7),
          treeTopSmall: new THREE.ConeGeometry(7, 14, 7),
          treeTrunk: new THREE.CylinderGeometry(2.5, 3.5, 10, 6),
          mountain: new THREE.ConeGeometry(16, 24, 5),
          rock: new THREE.DodecahedronGeometry(5),
          wave: new THREE.BoxGeometry(18, 0.5, 1.2),
          buildingBase: new THREE.BoxGeometry(24, 22, 24),
          buildingRoof: new THREE.ConeGeometry(17, 12, 4),
          buildingPlinth: new THREE.BoxGeometry(30, 4, 30),
          buildingTrim27: new THREE.BoxGeometry(27, 3, 27),
          buildingBanner: new THREE.BoxGeometry(28, 4, 4),
          buildingWindowSm: new THREE.BoxGeometry(5, 6, 2),
          barracksSpear: new THREE.BoxGeometry(3, 24, 3),
          barracksDoor: new THREE.BoxGeometry(10, 10, 3),
          barracksShield: new THREE.CylinderGeometry(5, 5, 2, 16),
          healerCrossV: new THREE.BoxGeometry(5, 22, 4),
          healerCrossH: new THREE.BoxGeometry(18, 5, 4),
          healerRing: new THREE.RingGeometry(9, 12, 32),
          watchDeck: new THREE.CylinderGeometry(15, 15, 6, 8),
          watchMast: new THREE.BoxGeometry(4, 18, 4),
          watchRail: new THREE.BoxGeometry(28, 3, 3),
          watchBeacon: new THREE.SphereGeometry(4, 12, 8),
          mineOreA: new THREE.DodecahedronGeometry(5),
          mineOreB: new THREE.DodecahedronGeometry(4),
          mineEntrance: new THREE.BoxGeometry(15, 10, 3),
          mineCart: new THREE.BoxGeometry(14, 6, 9),
          mineWheel: new THREE.CylinderGeometry(2.5, 2.5, 2, 12),
          fortressTower: new THREE.BoxGeometry(10, 32, 10),
          fortressBattlement: new THREE.BoxGeometry(30, 5, 8),
          fortressFlag: new THREE.BoxGeometry(16, 9, 2),
          unitBody: new THREE.CapsuleGeometry(5.8, 13, 4, 10),
          unitHead: new THREE.SphereGeometry(5, 12, 8),
          unitArm: new THREE.CapsuleGeometry(2, 10, 3, 6),
          unitLeg: new THREE.CapsuleGeometry(2.2, 8, 3, 6),
          unitChest: new THREE.BoxGeometry(11, 7, 7),
          unitHair: new THREE.SphereGeometry(5.3, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52),
          shoulder: new THREE.SphereGeometry(3.2, 8, 6),
          unitRing: new THREE.TorusGeometry(15, 1.2, 6, 36),
          unitShadow: new THREE.CircleGeometry(13, 24),
          bar: new THREE.BoxGeometry(1, 1, 1),
          marker: new THREE.TorusGeometry(6, 0.8, 5, 4),
          effect: new THREE.SphereGeometry(4, 10, 8),
          watchVisionRing: new THREE.RingGeometry(0.94, 1, 72),
          swordsmanBlade: new THREE.BoxGeometry(3, 26, 3),
          swordsmanGuard: new THREE.BoxGeometry(10, 3, 3),
          ninjaScarf: new THREE.BoxGeometry(18, 4, 3),
          ninjaDagger: new THREE.BoxGeometry(3, 14, 3),
          fighterGlove: new THREE.BoxGeometry(7, 7, 7),
          mageStaff: new THREE.BoxGeometry(3, 26, 3),
          guardShield: new THREE.CylinderGeometry(7, 7, 3, 18),
          guardMace: new THREE.BoxGeometry(4, 18, 4),
          moveCone: new THREE.ConeGeometry(7, 18, 4)
        };
      }

      addLights() {
        const ambient = new THREE.HemisphereLight(0xddeeff, 0x263221, 0.85);
        const sun = new THREE.DirectionalLight(0xfff5dc, 1.25);
        sun.position.set(-320, 700, 420);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.left = -900;
        sun.shadow.camera.right = 900;
        sun.shadow.camera.top = 900;
        sun.shadow.camera.bottom = -900;
        sun.shadow.camera.near = 100;
        sun.shadow.camera.far = 1400;
        const rim = new THREE.DirectionalLight(0x88bfff, 0.38);
        rim.position.set(500, 320, -500);
        this.scene.add(ambient, sun, rim);
      }

      draw() {
        if (this.mapRef !== this.game.map) this.rebuildMap();
        this.syncCamera();
        this.rebuildDynamicGroups();
        this.renderer.render(this.scene, this.camera3d);
      }

      syncCamera() {
        const viewW = this.canvas.width / this.game.camera.zoom;
        const viewH = this.canvas.height / this.game.camera.zoom;
        const centerX = this.game.camera.x + viewW / 2;
        const centerZ = this.game.camera.y + viewH / 2;

        this.camera3d.left = -viewW / 2;
        this.camera3d.right = viewW / 2;
        this.camera3d.top = viewH / 2;
        this.camera3d.bottom = -viewH / 2;
        this.camera3d.near = 1;
        this.camera3d.far = 3000;
        this.camera3d.position.set(centerX, 720, centerZ + 520);
        this.camera3d.lookAt(centerX, 0, centerZ);
        this.camera3d.updateProjectionMatrix();
      }

      screenToWorld(screenX, screenY) {
        this.tmpVec2.set((screenX / this.canvas.width) * 2 - 1, -(screenY / this.canvas.height) * 2 + 1);
        this.raycaster.setFromCamera(this.tmpVec2, this.camera3d);
        this.raycaster.ray.intersectPlane(this.groundPlane, this.tmpVec3);
        return { x: this.tmpVec3.x, y: this.tmpVec3.z };
      }

      rebuildMap() {
        this.clearGroup(this.mapGroup);
        this.mapRef = this.game.map;

        // 맵 전용 일회성 material: 맵은 재시작 시에만 재생성되므로 여기서만 사용
        const flowerMat = new THREE.MeshBasicMaterial({ color: 0xf4dc63 });
        const reedMat = new THREE.MeshStandardMaterial({ color: 0x8bbf65, roughness: 0.9, flatShading: true });

        for (let y = 0; y < MAP_H; y++) {
          for (let x = 0; x < MAP_W; x++) {
            const tile = this.game.map.get(x, y);
            const cx = x * TILE_SIZE + TILE_SIZE / 2;
            const cz = y * TILE_SIZE + TILE_SIZE / 2;
            const material = this.terrainMaterial(tile, x, y);
            const geom = tile.type === TileType.WATER ? this.geometries.water : this.geometries.tile;
            const tileMesh = new THREE.Mesh(geom, material);
            const height = tile.type === TileType.MOUNTAIN ? 4 : tile.type === TileType.WATER ? -2 : 0;
            tileMesh.position.set(cx, height, cz);
            tileMesh.scale.y = tile.type === TileType.MOUNTAIN ? 1.8 : tile.type === TileType.FOREST ? 1.15 : 1;
            tileMesh.receiveShadow = true;
            tileMesh.castShadow = tile.type === TileType.MOUNTAIN;
            this.mapGroup.add(tileMesh);

            if (tile.type === TileType.FOREST) {
              this.addTree(cx - 5, cz + 2, 1.05);
              if ((x + y) % 3 === 0) this.addTree(cx + 7, cz - 5, 0.78);
            } else if (tile.type === TileType.MOUNTAIN) {
              const peak = new THREE.Mesh(this.geometries.mountain, this.materials.mountain);
              peak.position.set(cx - 2, 18, cz);
              peak.rotation.y = Math.PI / 4;
              peak.castShadow = true;
              const rock = new THREE.Mesh(this.geometries.rock, this.materials.mountainDark);
              rock.position.set(cx + 8, 8, cz + 7);
              rock.scale.set(1.1, 0.8, 0.9);
              rock.castShadow = true;
              this.mapGroup.add(peak, rock);
            } else if (tile.type === TileType.WATER) {
              const waveA = new THREE.Mesh(this.geometries.wave, this.materials.waterFoam);
              waveA.position.set(cx - 4, 0.2, cz - 6);
              waveA.rotation.y = ((x + y) % 4) * 0.25;
              const waveB = new THREE.Mesh(this.geometries.wave, this.materials.waterFoam);
              waveB.position.set(cx + 5, 0.3, cz + 7);
              waveB.rotation.y = 0.35;
              this.mapGroup.add(waveA, waveB);
            } else if (tile.type === TileType.PLAIN && (x * 7 + y * 11) % 11 === 0) {
              const flower = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3), flowerMat);
              flower.position.set(cx + 5, 3, cz - 4);
              this.mapGroup.add(flower);
            } else if (tile.type === TileType.PLAIN && (x * 5 + y * 13) % 7 === 0) {
              const grass = new THREE.Mesh(this.geometries.grassBlade, reedMat);
              grass.position.set(cx - 7, 5, cz + 5);
              grass.rotation.z = 0.25;
              grass.castShadow = true;
              this.mapGroup.add(grass);
            }
          }
        }
      }

      terrainMaterial(tile, x, y) {
        if (tile.type === TileType.PLAIN) return (x * 3 + y * 5) % 2 ? this.materials.plain : this.materials.plainAlt;
        if (tile.type === TileType.FOREST) return (x + y) % 2 ? this.materials.forest : this.materials.forestDark;
        if (tile.type === TileType.MOUNTAIN) return this.materials.mountainDark;
        if (tile.type === TileType.WATER) return this.materials.water;
        return this.materials.plain;
      }

      addTree(x, z, scale) {
        const trunk = new THREE.Mesh(this.geometries.treeTrunk, this.materials.wood);
        trunk.position.set(x, 7 * scale, z);
        trunk.scale.set(scale, scale, scale);
        trunk.castShadow = true;
        const lower = new THREE.Mesh(this.geometries.treeTop, this.materials.forest);
        lower.position.set(x, 18 * scale, z);
        lower.scale.set(scale, scale, scale);
        lower.castShadow = true;
        const upper = new THREE.Mesh(this.geometries.treeTopSmall, this.materials.forestDark);
        upper.position.set(x, 29 * scale, z);
        upper.scale.set(scale, scale, scale);
        upper.castShadow = true;
        this.mapGroup.add(trunk, lower, upper);
      }

      rebuildDynamicGroups() {
        this.clearGroup(this.buildingGroup);
        this.clearGroup(this.unitGroup);
        this.clearGroup(this.effectGroup);
        this.clearGroup(this.overlayGroup);

        this.drawWatchTowerVision();
        this.game.buildings.forEach(b => this.drawBuilding(b));
        this.game.units.forEach(u => { if (u.hp > 0) this.drawUnit(u); });
        this.game.effects.forEach(effect => this.drawEffect(effect));
        this.game.commandEffects.forEach(effect => this.drawCommandEffect(effect));
        this.drawSelectionBox();
      }

      drawWatchTowerVision() {
        for (const b of this.game.buildings.filter(item => item.type === BuildingType.WATCH && item.faction.id !== "neutral")) {
          const radius = (3 + WATCH_TOWER_VISION_BONUS) * TILE_SIZE;
          // 세력 색상 material은 캐시에서 가져옴 (투명 버전이 별도 필요하므로 vision 전용 캐시 사용)
          const key = "vision_" + b.faction.color;
          if (!this.factionMatCache.has(key)) {
            this.factionMatCache.set(key, new THREE.MeshBasicMaterial({
              color: new THREE.Color(b.faction.color),
              transparent: true,
              opacity: 0.22,
              side: THREE.DoubleSide
            }));
          }
          const material = this.factionMatCache.get(key);
          const ring = new THREE.Mesh(this.geometries.watchVisionRing, material);
          ring.position.set(b.px, 2.5, b.py);
          ring.rotation.x = -Math.PI / 2;
          ring.scale.set(radius, radius, radius);
          this.overlayGroup.add(ring);
        }
      }

      drawBuilding(b) {
        // 건물 타입별 고정 material은 사전 캐시에서 가져옴 (매 프레임 new 하지 않음)
        const typeStyle = this.buildingTypeMats[b.type];
        const bodyMat   = typeStyle.body;
        const accentMat = typeStyle.accent;
        const height    = typeStyle.height;

        // 세력 color material은 faction 캐시에서 가져옴
        const factionMat = this._getFactionMat(b.faction.color);

        const x = b.px, z = b.py;
        const plinth = new THREE.Mesh(this.geometries.buildingPlinth, this.materials.stone);
        plinth.position.set(x, 3, z);
        plinth.receiveShadow = true;
        plinth.castShadow = true;
        const base = new THREE.Mesh(this.geometries.buildingBase, bodyMat);
        base.scale.y = height / 22;
        base.position.set(x, height / 2 + 2, z);
        base.castShadow = true;
        base.receiveShadow = true;
        this.addOutline(base, 1.055);

        const roof = new THREE.Mesh(this.geometries.buildingRoof, factionMat);
        roof.position.set(x, height + 12, z);
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        this.addOutline(roof, 1.06);
        const trim = new THREE.Mesh(this.geometries.buildingTrim27, accentMat);
        trim.position.set(x, height + 4, z);
        trim.castShadow = true;
        this.buildingGroup.add(plinth, base, trim, roof);

        const banner = new THREE.Mesh(this.geometries.buildingBanner, factionMat);
        banner.position.set(x, height + 3, z - 14);
        banner.castShadow = true;
        const windowA = new THREE.Mesh(this.geometries.buildingWindowSm, this.materials.dark);
        windowA.position.set(x - 7, height * 0.55, z - 13);
        const windowB = new THREE.Mesh(this.geometries.buildingWindowSm, this.materials.dark);
        windowB.position.set(x + 7, height * 0.55, z - 13);
        this.buildingGroup.add(banner, windowA, windowB);

        if (b.type === BuildingType.BARRACKS) {
          const door = new THREE.Mesh(this.geometries.barracksDoor, this.materials.dark);
          door.position.set(x, 8, z - 13);
          const spearA = new THREE.Mesh(this.geometries.barracksSpear, accentMat);
          spearA.position.set(x - 10, 17, z + 2);
          spearA.rotation.z = 0.35;
          const spearB = new THREE.Mesh(this.geometries.barracksSpear, accentMat);
          spearB.position.set(x + 10, 17, z + 2);
          spearB.rotation.z = -0.35;
          const shield = new THREE.Mesh(this.geometries.barracksShield, accentMat);
          shield.position.set(x, 20, z - 15);
          shield.rotation.x = Math.PI / 2;
          this.buildingGroup.add(door, spearA, spearB, shield);
        }

        if (b.type === BuildingType.HEALER) {
          const crossA = new THREE.Mesh(this.geometries.healerCrossV, accentMat);
          crossA.position.set(x, height + 18, z);
          const crossB = new THREE.Mesh(this.geometries.healerCrossH, accentMat);
          crossB.position.set(x, height + 18, z);
          // healer glow: 색이 고정이므로 materials에 포함
          if (!this.materials.healerGlow) {
            this.materials.healerGlow = new THREE.MeshBasicMaterial({
              color: 0x7fffc1, transparent: true, opacity: 0.35, side: THREE.DoubleSide
            });
          }
          const glow = new THREE.Mesh(this.geometries.healerRing, this.materials.healerGlow);
          glow.position.set(x, 5, z);
          glow.rotation.x = -Math.PI / 2;
          this.buildingGroup.add(crossA, crossB, glow);
        }

        if (b.type === BuildingType.WATCH) {
          const deck = new THREE.Mesh(this.geometries.watchDeck, accentMat);
          deck.position.set(x, height + 10, z);
          this.addOutline(deck, 1.05);
          const mast = new THREE.Mesh(this.geometries.watchMast, factionMat);
          mast.position.set(x, height + 22, z);
          const railA = new THREE.Mesh(this.geometries.watchRail, this.materials.wood);
          railA.position.set(x, height + 15, z - 13);
          const railB = new THREE.Mesh(this.geometries.watchRail, this.materials.wood);
          railB.position.set(x, height + 15, z + 13);
          if (!this.materials.watchBeacon) {
            this.materials.watchBeacon = new THREE.MeshBasicMaterial({ color: 0x8fd3ff });
          }
          const beacon = new THREE.Mesh(this.geometries.watchBeacon, this.materials.watchBeacon);
          beacon.position.set(x, height + 32, z);
          this.buildingGroup.add(deck, mast, railA, railB, beacon);
        }

        if (b.type === BuildingType.MINE) {
          const oreA = new THREE.Mesh(this.geometries.mineOreA, accentMat);
          oreA.position.set(x - 8, 9, z - 13);
          const oreB = new THREE.Mesh(this.geometries.mineOreB, accentMat);
          oreB.position.set(x + 7, 7, z - 14);
          const entrance = new THREE.Mesh(this.geometries.mineEntrance, this.materials.dark);
          entrance.position.set(x, 8, z - 13);
          const cart = new THREE.Mesh(this.geometries.mineCart, this.materials.wood);
          cart.position.set(x + 11, 7, z + 11);
          const wheelA = new THREE.Mesh(this.geometries.mineWheel, this.materials.dark);
          wheelA.position.set(x + 5, 5, z + 16);
          wheelA.rotation.z = Math.PI / 2;
          const wheelB = wheelA.clone();
          wheelB.position.x = x + 17;
          this.buildingGroup.add(oreA, oreB, entrance, cart, wheelA, wheelB);
        }

        if (b.type === BuildingType.FORTRESS) {
          const tower = new THREE.Mesh(this.geometries.fortressTower, bodyMat);
          tower.position.set(x, 38, z);
          tower.castShadow = true;
          this.addOutline(tower, 1.06);
          const towerA = tower.clone();
          towerA.position.set(x - 14, 30, z - 14);
          const towerB = tower.clone();
          towerB.position.set(x + 14, 30, z - 14);
          const battlement = new THREE.Mesh(this.geometries.fortressBattlement, accentMat);
          battlement.position.set(x, 34, z - 12);
          const flag = new THREE.Mesh(this.geometries.fortressFlag, factionMat);
          flag.position.set(x + 9, 56, z);
          this.buildingGroup.add(tower, towerA, towerB, battlement, flag);
        }

        if (b.captureProgress > 0) {
          const back = this.makeBar(x, 35, z + 18, 28, 3, this.materials.hpBack);
          // capture progress bar: captureFaction color material 캐시
          const capColor = b.captureFaction ? b.captureFaction.color : "#ffffff";
          const capKey = "capture_" + capColor;
          if (!this.factionMatCache.has(capKey)) {
            this.factionMatCache.set(capKey, new THREE.MeshBasicMaterial({ color: new THREE.Color(capColor) }));
          }
          const fill = this.makeBar(
            x - 14 + 14 * b.captureProgress / 100, 36, z + 18,
            28 * b.captureProgress / 100, 3,
            this.factionMatCache.get(capKey)
          );
          this.buildingGroup.add(back, fill);
        }
      }

      drawUnit(u) {
        // faction/gear material: 캐시에서 가져옴 (매 프레임 new 하지 않음)
        const factionMat = this._getFactionMat(u.faction.color);
        const gearMat    = this._getGearMat(u.spriteColor);

        const x = u.x, z = u.y;
        const bob = (u.state === "moving" || u.state === "attacking") ? Math.sin(u.animTime * 10) * 1.5 : 0;
        const recoil = Math.sin(u.attackAnim * Math.PI) * 4;
        const sx = x + Math.cos(u.attackAngle) * recoil;
        const sz = z + Math.sin(u.attackAngle) * recoil;

        if (u.moveMarker) {
          const marker = new THREE.Mesh(this.geometries.marker, this.materials.move);
          marker.position.set(u.moveMarker.x, 3, u.moveMarker.y);
          marker.rotation.x = -Math.PI / 2;
          marker.rotation.z = Math.PI / 4;
          this.unitGroup.add(marker);
        }

        const shadow = new THREE.Mesh(this.geometries.unitShadow, this.materials.shadow);
        shadow.position.set(x, 1.5, z);
        shadow.rotation.x = -Math.PI / 2;
        this.unitGroup.add(shadow);

        const ring = new THREE.Mesh(this.geometries.unitRing, factionMat);
        ring.position.set(x, 3, z);
        ring.rotation.x = -Math.PI / 2;
        this.unitGroup.add(ring);

        this.addUnitModel(u, sx, 17 + bob, sz, factionMat, gearMat);

        if (u.selected) {
          const selected = new THREE.Mesh(this.geometries.unitRing, this.materials.selected);
          selected.position.set(x, 5, z);
          selected.rotation.x = -Math.PI / 2;
          selected.scale.set(1.16, 1.16, 1.16);
          this.unitGroup.add(selected);
        }

        if (this.game.flashTarget === u) {
          const flash = new THREE.Mesh(this.geometries.unitRing, this.materials.flashRing);
          flash.position.set(x, 7, z);
          flash.rotation.x = -Math.PI / 2;
          flash.scale.set(1.24, 1.24, 1.24);
          this.unitGroup.add(flash);
        }

        const hpMat = u.hp > 40 ? this.materials.hpGood : this.materials.hpBad;
        this.unitGroup.add(this.makeUnitLabel(u.role, x, 58, z));
        this.unitGroup.add(this.makeBar(x, 40, z, 26, 3, this.materials.hpBack));
        this.unitGroup.add(this.makeBar(x - 13 + 13 * Math.max(0, u.hp) / u.maxHp, 41, z, 26 * Math.max(0, u.hp) / u.maxHp, 3, hpMat));
      }

      addUnitModel(u, x, y, z, factionMat, gearMat) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.rotation.y = this.facingAngle(u);

        const body = new THREE.Mesh(this.geometries.unitBody, factionMat);
        body.position.set(0, 0, 0);
        body.castShadow = true;
        this.addOutline(body, 1.08);
        group.add(body);

        const chest = new THREE.Mesh(this.geometries.unitChest, gearMat);
        chest.position.set(0, 2, -1);
        chest.castShadow = true;
        this.addOutline(chest, 1.08);
        group.add(chest);

        const head = new THREE.Mesh(this.geometries.unitHead, this.materials.skin);
        head.position.set(0, 14, 0);
        head.castShadow = true;
        this.addOutline(head, 1.08);
        group.add(head);

        const hair = new THREE.Mesh(this.geometries.unitHair, gearMat);
        hair.position.set(0, 16.5, -0.7);
        hair.rotation.x = Math.PI;
        hair.castShadow = true;
        group.add(hair);

        const armL = new THREE.Mesh(this.geometries.unitArm, factionMat);
        armL.position.set(-7, 1, 0);
        armL.rotation.z = -0.18;
        const armR = new THREE.Mesh(this.geometries.unitArm, factionMat);
        armR.position.set(7, 1, 0);
        armR.rotation.z = 0.18;
        const legL = new THREE.Mesh(this.geometries.unitLeg, this.materials.leather);
        legL.position.set(-3, -10, 0);
        const legR = new THREE.Mesh(this.geometries.unitLeg, this.materials.leather);
        legR.position.set(3, -10, 0);
        [armL, armR, legL, legR].forEach(part => {
          part.castShadow = true;
          group.add(part);
        });

        const shoulderL = new THREE.Mesh(this.geometries.shoulder, gearMat);
        shoulderL.position.set(-7, 6, 0);
        const shoulderR = new THREE.Mesh(this.geometries.shoulder, gearMat);
        shoulderR.position.set(7, 6, 0);
        shoulderL.castShadow = true;
        shoulderR.castShadow = true;
        group.add(shoulderL, shoulderR);

        this.addClassGear(group, u, gearMat);
        this.unitGroup.add(group);
      }

      addOutline(mesh, scale) {
        const outline = new THREE.Mesh(mesh.geometry, this.materials.outline);
        outline.position.copy(mesh.position);
        outline.rotation.copy(mesh.rotation);
        outline.scale.copy(mesh.scale).multiplyScalar(scale);
        outline.castShadow = false;
        outline.receiveShadow = false;
        mesh.add(outline);
        return outline;
      }

      addClassGear(group, u, gearMat) {
        const swing = Math.sin(u.attackAnim * Math.PI);
        if (u.kind === "swordsman") {
          const blade = new THREE.Mesh(this.geometries.swordsmanBlade, this.materials.metal);
          blade.position.set(10, 5, -2);
          blade.rotation.z = -0.65 + swing * 1.2;
          const guard = new THREE.Mesh(this.geometries.swordsmanGuard, gearMat);
          guard.position.set(8, -4, -2);
          blade.castShadow = true;
          guard.castShadow = true;
          group.add(blade, guard);
        } else if (u.kind === "ninja") {
          const scarf = new THREE.Mesh(this.geometries.ninjaScarf, gearMat);
          scarf.position.set(0, 12, 5);
          const daggerA = new THREE.Mesh(this.geometries.ninjaDagger, this.materials.metal);
          daggerA.position.set(8, 0, -3);
          daggerA.rotation.z = 0.65 + swing;
          group.add(scarf, daggerA);
        } else if (u.kind === "fighter") {
          const gloveL = new THREE.Mesh(this.geometries.fighterGlove, gearMat);
          gloveL.position.set(-10 - swing * 2, -2, -2);
          const gloveR = new THREE.Mesh(this.geometries.fighterGlove, gearMat);
          gloveR.position.set(10 + swing * 2, -2, -2);
          group.add(gloveL, gloveR);
        } else if (u.kind === "mage") {
          // mage orb: radius가 swing에 따라 변하므로 geometry는 매 프레임 생성이 불가피
          // 단, material은 spriteColor 기반으로 캐시 가능 (투명 버전 별도 캐시)
          const orbKey = "mage_orb_" + u.spriteColor;
          if (!this.factionMatCache.has(orbKey)) {
            this.factionMatCache.set(orbKey, new THREE.MeshBasicMaterial({
              color: new THREE.Color(u.spriteColor),
              transparent: true,
              opacity: 0.82
            }));
          }
          const orbMat = this.factionMatCache.get(orbKey);
          const orb = new THREE.Mesh(new THREE.SphereGeometry(5 + swing * 2, 16, 10), orbMat);
          orb.position.set(11, 6, -4);
          const staff = new THREE.Mesh(this.geometries.mageStaff, this.materials.wood);
          staff.position.set(13, -1, -3);
          group.add(orb, staff);
        } else if (u.kind === "guard") {
          const shield = new THREE.Mesh(this.geometries.guardShield, gearMat);
          shield.position.set(-10, 2, -4);
          shield.rotation.x = Math.PI / 2;
          const mace = new THREE.Mesh(this.geometries.guardMace, this.materials.metal);
          mace.position.set(10, 2, -3);
          group.add(shield, mace);
        }
      }

      facingAngle(u) {
        if (u.facing === "up") return Math.PI;
        if (u.facing === "left") return Math.PI / 2;
        if (u.facing === "right") return -Math.PI / 2;
        return 0;
      }

      // ── 유닛 라벨 텍스처 캐시 ────────────────────────────────────
      // role 문자열은 게임 중 변하지 않으므로 최초 1회만 CanvasTexture 생성
      makeUnitLabel(text, x, y, z) {
        if (!this.labelCache.has(text)) {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          canvas.width = 256;
          canvas.height = 72;
          ctx.font = "bold 26px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const labelW = Math.min(238, Math.max(112, ctx.measureText(text).width + 38));
          const labelX = (canvas.width - labelW) / 2;
          ctx.fillStyle = "rgba(6,8,12,.78)";
          ctx.strokeStyle = "rgba(255,255,255,.28)";
          ctx.lineWidth = 3;
          this.roundRect(ctx, labelX, 12, labelW, 40, 10);
          ctx.fill();
          ctx.stroke();
          ctx.lineWidth = 6;
          ctx.strokeStyle = "rgba(8,10,14,.9)";
          ctx.strokeText(text, canvas.width / 2, 32);
          ctx.fillStyle = "#ffffff";
          ctx.fillText(text, canvas.width / 2, 32);
          const texture = new THREE.CanvasTexture(canvas);
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
          this.labelCache.set(text, material);
        }

        const sprite = new THREE.Sprite(this.labelCache.get(text));
        sprite.position.set(x, y, z);
        sprite.scale.set(86, 24, 1);
        return sprite;
      }

      roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
      }

      drawEffect(effect) {
        const alpha = Math.max(0, effect.life / effect.maxLife);
        const mat = new THREE.MeshBasicMaterial({ color: effect.color, transparent: true, opacity: alpha });
        const mesh = new THREE.Mesh(this.geometries.effect, mat);
        mesh.position.set(effect.x, 28 + (1 - alpha) * 18, effect.y);
        mesh.scale.setScalar(1 + (1 - alpha) * 2.5);
        this.effectGroup.add(mesh);
      }

      drawCommandEffect(effect) {
        const progress = 1 - effect.life / effect.maxLife;
        const alpha = Math.max(0, effect.life / effect.maxLife);
        const color = new THREE.Color(effect.color);
        const mat = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: alpha * 0.85,
          side: THREE.DoubleSide,
          depthWrite: false
        });

        const radius = effect.type === "attack" ? 12 + progress * 24 : 10 + progress * 20;
        const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.78, radius, 48), mat);
        ring.position.set(effect.x, 5, effect.y);
        ring.rotation.x = -Math.PI / 2;
        this.effectGroup.add(ring);

        if (effect.type === "move") {
          const marker = new THREE.Mesh(this.geometries.moveCone, mat);
          marker.position.set(effect.x, 15 + progress * 6, effect.y);
          marker.rotation.y = Math.PI / 4;
          this.effectGroup.add(marker);
        } else if (effect.type === "attack") {
          const lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: alpha });
          const size = 16 + progress * 10;
          const pointsA = [
            new THREE.Vector3(effect.x - size, 9, effect.y - size),
            new THREE.Vector3(effect.x + size, 9, effect.y + size)
          ];
          const pointsB = [
            new THREE.Vector3(effect.x + size, 9, effect.y - size),
            new THREE.Vector3(effect.x - size, 9, effect.y + size)
          ];
          this.effectGroup.add(
            new THREE.Line(new THREE.BufferGeometry().setFromPoints(pointsA), lineMat),
            new THREE.Line(new THREE.BufferGeometry().setFromPoints(pointsB), lineMat.clone())
          );
        } else if (effect.type === "capture") {
          const flag = new THREE.Mesh(new THREE.BoxGeometry(18, 10, 2), mat);
          const pole = new THREE.Mesh(new THREE.BoxGeometry(2, 24, 2), mat.clone());
          flag.position.set(effect.x + 6, 23 + progress * 5, effect.y);
          pole.position.set(effect.x - 5, 17 + progress * 5, effect.y);
          this.effectGroup.add(flag, pole);
        }
      }

      drawSelectionBox() {
        const input = this.game.input;
        if (!input.dragging || !input.dragStart || !input.dragEnd) return;
        const minX = Math.min(input.dragStart.x, input.dragEnd.x);
        const maxX = Math.max(input.dragStart.x, input.dragEnd.x);
        const minZ = Math.min(input.dragStart.y, input.dragEnd.y);
        const maxZ = Math.max(input.dragStart.y, input.dragEnd.y);
        const points = [
          new THREE.Vector3(minX, 4, minZ),
          new THREE.Vector3(maxX, 4, minZ),
          new THREE.Vector3(maxX, 4, maxZ),
          new THREE.Vector3(minX, 4, maxZ),
          new THREE.Vector3(minX, 4, minZ)
        ];
        const geom = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geom, this.materials.selectionBox);
        this.overlayGroup.add(line);
      }

      makeBar(x, y, z, w, h, material) {
        const mesh = new THREE.Mesh(this.geometries.bar, material);
        mesh.position.set(x, y, z);
        mesh.scale.set(Math.max(0.01, w), h, 1.5);
        return mesh;
      }

      // ── clearGroup: 공유 캐시 대상은 dispose 하지 않음 ─────────────
      // 캐시된 material/geometry 집합을 미리 계산해 두고, 그 외의 것만 dispose
      _isCachedMaterial(mat) {
        if (!mat) return false;
        // this.materials, buildingTypeMats, factionMatCache, gearMatCache, labelCache 내부 material 포함
        if (Object.values(this.materials).includes(mat)) return true;
        for (const ts of Object.values(this.buildingTypeMats)) {
          if (ts.body === mat || ts.accent === mat) return true;
        }
        if (this.factionMatCache && [...this.factionMatCache.values()].includes(mat)) return true;
        if (this.gearMatCache && [...this.gearMatCache.values()].includes(mat)) return true;
        if (this.labelCache && [...this.labelCache.values()].includes(mat)) return true;
        return false;
      }

      _isCachedGeometry(geom) {
        if (!geom) return false;
        return Object.values(this.geometries).includes(geom);
      }

      _disposeObject(obj) {
        // 자식 먼저 재귀 처리
        if (obj.children && obj.children.length) {
          // 역순 복사 후 처리 (children은 live array)
          const kids = [...obj.children];
          for (const child of kids) this._disposeObject(child);
        }
        if (obj.geometry && !this._isCachedGeometry(obj.geometry)) {
          obj.geometry.dispose();
        }
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const mat of mats) {
            if (!this._isCachedMaterial(mat)) {
              if (mat.map) mat.map.dispose();
              mat.dispose();
            }
          }
        }
      }

      clearGroup(group) {
        while (group.children.length) {
          const child = group.children.pop();
          this._disposeObject(child);
        }
      }
    }
