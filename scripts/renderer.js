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
        this.mapRef = null;

        this.addLights();
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
          hit: new THREE.MeshBasicMaterial({ color: 0xfff7a8, transparent: true, opacity: 0.9 })
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
          unitBody: new THREE.CapsuleGeometry(5.8, 13, 4, 10),
          unitHead: new THREE.SphereGeometry(5, 12, 8),
          unitArm: new THREE.CapsuleGeometry(2, 10, 3, 6),
          unitLeg: new THREE.CapsuleGeometry(2.2, 8, 3, 6),
          shoulder: new THREE.SphereGeometry(3.2, 8, 6),
          unitRing: new THREE.TorusGeometry(15, 1.2, 6, 36),
          bar: new THREE.BoxGeometry(1, 1, 1),
          marker: new THREE.TorusGeometry(6, 0.8, 5, 4),
          effect: new THREE.SphereGeometry(4, 10, 8)
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
        const geometry = new THREE.RingGeometry(0.94, 1, 72);
        for (const b of this.game.buildings.filter(item => item.type === BuildingType.WATCH && item.faction.id !== "neutral")) {
          const radius = (3 + WATCH_TOWER_VISION_BONUS) * TILE_SIZE;
          const material = new THREE.MeshBasicMaterial({
            color: new THREE.Color(b.faction.color),
            transparent: true,
            opacity: 0.22,
            side: THREE.DoubleSide
          });
          const ring = new THREE.Mesh(geometry, material);
          ring.position.set(b.px, 2.5, b.py);
          ring.rotation.x = -Math.PI / 2;
          ring.scale.set(radius, radius, radius);
          this.overlayGroup.add(ring);
        }
      }

      drawBuilding(b) {
        const typeStyle = {
          [BuildingType.BARRACKS]: { color: 0xb95538, accent: 0xf3c05f, height: 22 },
          [BuildingType.HEALER]: { color: 0xf4f7fb, accent: 0x40d187, height: 20 },
          [BuildingType.WATCH]: { color: 0x8b6f4e, accent: 0x8fd3ff, height: 36 },
          [BuildingType.MINE]: { color: 0x7a6246, accent: 0xffd15a, height: 18 },
          [BuildingType.FORTRESS]: { color: 0x596579, accent: 0xd9e6ff, height: 30 }
        }[b.type];
        const bodyMat = new THREE.MeshStandardMaterial({ color: typeStyle.color, roughness: 0.68, metalness: 0.03 });
        const accentMat = new THREE.MeshStandardMaterial({ color: typeStyle.accent, roughness: 0.45, metalness: 0.08 });
        const factionMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(b.faction.color), roughness: 0.55 });
        const x = b.px, z = b.py;
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(30, 4, 30), this.materials.stone);
        plinth.position.set(x, 3, z);
        plinth.receiveShadow = true;
        plinth.castShadow = true;
        const base = new THREE.Mesh(this.geometries.buildingBase, bodyMat);
        base.scale.y = typeStyle.height / 22;
        base.position.set(x, typeStyle.height / 2 + 2, z);
        base.castShadow = true;
        base.receiveShadow = true;
        this.addOutline(base, 1.055);

        const roof = new THREE.Mesh(this.geometries.buildingRoof, factionMat);
        roof.position.set(x, typeStyle.height + 12, z);
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        this.addOutline(roof, 1.06);
        const trim = new THREE.Mesh(new THREE.BoxGeometry(27, 3, 27), accentMat);
        trim.position.set(x, typeStyle.height + 4, z);
        trim.castShadow = true;
        this.buildingGroup.add(plinth, base, trim, roof);

        const banner = new THREE.Mesh(new THREE.BoxGeometry(28, 4, 4), factionMat);
        banner.position.set(x, typeStyle.height + 3, z - 14);
        banner.castShadow = true;
        const windowA = new THREE.Mesh(new THREE.BoxGeometry(5, 6, 2), this.materials.dark);
        windowA.position.set(x - 7, typeStyle.height * 0.55, z - 13);
        const windowB = new THREE.Mesh(new THREE.BoxGeometry(5, 6, 2), this.materials.dark);
        windowB.position.set(x + 7, typeStyle.height * 0.55, z - 13);
        this.buildingGroup.add(banner, windowA, windowB);

        if (b.type === BuildingType.BARRACKS) {
          const door = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 3), this.materials.dark);
          door.position.set(x, 8, z - 13);
          const spearA = new THREE.Mesh(new THREE.BoxGeometry(3, 24, 3), accentMat);
          spearA.position.set(x - 10, 17, z + 2);
          spearA.rotation.z = 0.35;
          const spearB = new THREE.Mesh(new THREE.BoxGeometry(3, 24, 3), accentMat);
          spearB.position.set(x + 10, 17, z + 2);
          spearB.rotation.z = -0.35;
          const shield = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 2, 16), accentMat);
          shield.position.set(x, 20, z - 15);
          shield.rotation.x = Math.PI / 2;
          this.buildingGroup.add(door, spearA, spearB, shield);
        }

        if (b.type === BuildingType.HEALER) {
          const crossA = new THREE.Mesh(new THREE.BoxGeometry(5, 22, 4), accentMat);
          crossA.position.set(x, typeStyle.height + 18, z);
          const crossB = new THREE.Mesh(new THREE.BoxGeometry(18, 5, 4), accentMat);
          crossB.position.set(x, typeStyle.height + 18, z);
          const glow = new THREE.Mesh(new THREE.RingGeometry(9, 12, 32), new THREE.MeshBasicMaterial({
            color: 0x7fffc1,
            transparent: true,
            opacity: 0.35,
            side: THREE.DoubleSide
          }));
          glow.position.set(x, 5, z);
          glow.rotation.x = -Math.PI / 2;
          this.buildingGroup.add(crossA, crossB, glow);
        }

        if (b.type === BuildingType.WATCH) {
          const deck = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 6, 8), accentMat);
          deck.position.set(x, typeStyle.height + 10, z);
          this.addOutline(deck, 1.05);
          const mast = new THREE.Mesh(new THREE.BoxGeometry(4, 18, 4), factionMat);
          mast.position.set(x, typeStyle.height + 22, z);
          const railA = new THREE.Mesh(new THREE.BoxGeometry(28, 3, 3), this.materials.wood);
          railA.position.set(x, typeStyle.height + 15, z - 13);
          const railB = new THREE.Mesh(new THREE.BoxGeometry(28, 3, 3), this.materials.wood);
          railB.position.set(x, typeStyle.height + 15, z + 13);
          const beacon = new THREE.Mesh(new THREE.SphereGeometry(4, 12, 8), new THREE.MeshBasicMaterial({ color: 0x8fd3ff }));
          beacon.position.set(x, typeStyle.height + 32, z);
          this.buildingGroup.add(deck, mast, railA, railB, beacon);
        }

        if (b.type === BuildingType.MINE) {
          const oreA = new THREE.Mesh(new THREE.DodecahedronGeometry(5), accentMat);
          oreA.position.set(x - 8, 9, z - 13);
          const oreB = new THREE.Mesh(new THREE.DodecahedronGeometry(4), accentMat);
          oreB.position.set(x + 7, 7, z - 14);
          const entrance = new THREE.Mesh(new THREE.BoxGeometry(15, 10, 3), this.materials.dark);
          entrance.position.set(x, 8, z - 13);
          const cart = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 9), this.materials.wood);
          cart.position.set(x + 11, 7, z + 11);
          const wheelA = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 2, 12), this.materials.dark);
          wheelA.position.set(x + 5, 5, z + 16);
          wheelA.rotation.z = Math.PI / 2;
          const wheelB = wheelA.clone();
          wheelB.position.x = x + 17;
          this.buildingGroup.add(oreA, oreB, entrance, cart, wheelA, wheelB);
        }

        if (b.type === BuildingType.FORTRESS) {
          const tower = new THREE.Mesh(new THREE.BoxGeometry(10, 32, 10), bodyMat);
          tower.position.set(x, 38, z);
          tower.castShadow = true;
          this.addOutline(tower, 1.06);
          const towerA = tower.clone();
          towerA.position.set(x - 14, 30, z - 14);
          const towerB = tower.clone();
          towerB.position.set(x + 14, 30, z - 14);
          const battlement = new THREE.Mesh(new THREE.BoxGeometry(30, 5, 8), accentMat);
          battlement.position.set(x, 34, z - 12);
          const flag = new THREE.Mesh(new THREE.BoxGeometry(16, 9, 2), factionMat);
          flag.position.set(x + 9, 56, z);
          this.buildingGroup.add(tower, towerA, towerB, battlement, flag);
        }

        if (b.captureProgress > 0) {
          const back = this.makeBar(x, 35, z + 18, 28, 3, this.materials.hpBack);
          const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(b.captureFaction ? b.captureFaction.color : "#ffffff") });
          const fill = this.makeBar(x - 14 + 14 * b.captureProgress / 100, 36, z + 18, 28 * b.captureProgress / 100, 3, mat);
          this.buildingGroup.add(back, fill);
        }
      }

      drawUnit(u) {
        const factionMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(u.faction.color), roughness: 0.55 });
        const gearMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(u.spriteColor), roughness: 0.45 });
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

        const shadow = new THREE.Mesh(new THREE.CircleGeometry(13, 24), this.materials.shadow);
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
          const flash = new THREE.Mesh(this.geometries.unitRing, new THREE.MeshBasicMaterial({ color: 0xff2b2b }));
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

        const chest = new THREE.Mesh(new THREE.BoxGeometry(11, 7, 7), gearMat);
        chest.position.set(0, 2, -1);
        chest.castShadow = true;
        this.addOutline(chest, 1.08);
        group.add(chest);

        const head = new THREE.Mesh(this.geometries.unitHead, this.materials.skin);
        head.position.set(0, 14, 0);
        head.castShadow = true;
        this.addOutline(head, 1.08);
        group.add(head);

        const hair = new THREE.Mesh(new THREE.SphereGeometry(5.3, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), gearMat);
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
          const blade = new THREE.Mesh(new THREE.BoxGeometry(3, 26, 3), this.materials.metal);
          blade.position.set(10, 5, -2);
          blade.rotation.z = -0.65 + swing * 1.2;
          const guard = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 3), gearMat);
          guard.position.set(8, -4, -2);
          blade.castShadow = true;
          guard.castShadow = true;
          group.add(blade, guard);
        } else if (u.kind === "ninja") {
          const scarf = new THREE.Mesh(new THREE.BoxGeometry(18, 4, 3), gearMat);
          scarf.position.set(0, 12, 5);
          const daggerA = new THREE.Mesh(new THREE.BoxGeometry(3, 14, 3), this.materials.metal);
          daggerA.position.set(8, 0, -3);
          daggerA.rotation.z = 0.65 + swing;
          group.add(scarf, daggerA);
        } else if (u.kind === "fighter") {
          const gloveL = new THREE.Mesh(new THREE.BoxGeometry(7, 7, 7), gearMat);
          gloveL.position.set(-10 - swing * 2, -2, -2);
          const gloveR = new THREE.Mesh(new THREE.BoxGeometry(7, 7, 7), gearMat);
          gloveR.position.set(10 + swing * 2, -2, -2);
          group.add(gloveL, gloveR);
        } else if (u.kind === "mage") {
          const orb = new THREE.Mesh(new THREE.SphereGeometry(5 + swing * 2, 16, 10), new THREE.MeshBasicMaterial({
            color: new THREE.Color(u.spriteColor),
            transparent: true,
            opacity: 0.82
          }));
          orb.position.set(11, 6, -4);
          const staff = new THREE.Mesh(new THREE.BoxGeometry(3, 26, 3), this.materials.wood);
          staff.position.set(13, -1, -3);
          group.add(orb, staff);
        } else if (u.kind === "guard") {
          const shield = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 3, 18), gearMat);
          shield.position.set(-10, 2, -4);
          shield.rotation.x = Math.PI / 2;
          const mace = new THREE.Mesh(new THREE.BoxGeometry(4, 18, 4), this.materials.metal);
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

      makeUnitLabel(text, x, y, z) {
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
        const sprite = new THREE.Sprite(material);
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

      weaponGeometry(u) {
        if (u.kind === "mage") return new THREE.SphereGeometry(5, 12, 8);
        if (u.kind === "fighter") return new THREE.BoxGeometry(9, 9, 9);
        if (u.kind === "guard") return new THREE.BoxGeometry(9, 16, 3);
        return new THREE.BoxGeometry(4, 22, 4);
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
          const marker = new THREE.Mesh(new THREE.ConeGeometry(7, 18, 4), mat);
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
        const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: 0x9bd3ff }));
        this.overlayGroup.add(line);
      }

      makeBar(x, y, z, w, h, material) {
        const mesh = new THREE.Mesh(this.geometries.bar, material);
        mesh.position.set(x, y, z);
        mesh.scale.set(Math.max(0.01, w), h, 1.5);
        return mesh;
      }

      clearGroup(group) {
        while (group.children.length) {
          const child = group.children.pop();
          if (child.geometry && !Object.values(this.geometries).includes(child.geometry)) child.geometry.dispose();
          if (child.material && !Object.values(this.materials).includes(child.material)) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => {
                if (mat.map) mat.map.dispose();
                mat.dispose();
              });
            } else {
              if (child.material.map) child.material.map.dispose();
              child.material.dispose();
            }
          }
        }
      }
    }
