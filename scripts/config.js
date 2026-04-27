// ─── 화면 스케일 ───────────────────────────────────────────────
    const UI_BASE_W = 1600;
    const UI_BASE_H = 760;
    const UI_MARGIN = 12;

    function fitGameToWindow() {
      const viewport = window.visualViewport;
      const width = viewport ? viewport.width : (document.documentElement.clientWidth || window.innerWidth);
      const height = viewport ? viewport.height : (document.documentElement.clientHeight || window.innerHeight);
      const availableW = Math.max(1, width - UI_MARGIN);
      const availableH = Math.max(1, height - UI_MARGIN);
      const scale = Math.min(availableW / UI_BASE_W, availableH / UI_BASE_H);
      document.documentElement.style.setProperty("--ui-scale", scale.toString());
    }
    window.addEventListener("resize", fitGameToWindow, { passive: true });
    window.addEventListener("orientationchange", fitGameToWindow, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", fitGameToWindow, { passive: true });
      window.visualViewport.addEventListener("scroll", fitGameToWindow, { passive: true });
    }
    fitGameToWindow();

    // ─── 상수 ────────────────────────────────────────────────────
    const TILE_SIZE = 32;
    const MAP_W = 40;
    const MAP_H = 26;
    const WORLD_W = MAP_W * TILE_SIZE;
    const WORLD_H = MAP_H * TILE_SIZE;
    const GAME_SPEED = 0.5;
    const CAMERA_ZOOM = 0.75;
    const WATCH_TOWER_VISION_BONUS = 3; // 감시탑 시야 반경 타일 보너스

    const TileType = { PLAIN: "plain", FOREST: "forest", WATER: "water", MOUNTAIN: "mountain" };
    const BuildingType = { BARRACKS: "병영", HEALER: "치료소", WATCH: "감시탑", MINE: "금광", FORTRESS: "성채" };

    const factionDefs = {
      player:  { name: "푸른 연맹",   color: "#3297ff" },
      enemyA:  { name: "붉은 화영단", color: "#e44242" },
      neutral: { name: "회색 방랑자", color: "#9aa1aa" }
    };

    const archetypes = [
      { kind: "swordsman", title: "불꽃 검사",   color: "#ff8b33", attack: 17, defense: 5, range: 1.15, persuasion: 11 },
      { kind: "ninja",     title: "바람 그림자", color: "#75e08b", attack: 13, defense: 4, range: 1.25, persuasion: 15 },
      { kind: "fighter",   title: "번개 격투가", color: "#f6e05e", attack: 18, defense: 3, range: 1.05, persuasion:  9 },
      { kind: "mage",      title: "물결 술사",   color: "#58d7ff", attack: 12, defense: 4, range: 3.1,  persuasion: 16 },
      { kind: "guard",     title: "강철 방패병", color: "#cbd5e1", attack: 10, defense: 9, range: 1.05, persuasion:  8 }
    ];

    const namePartsA = ["아렌","세라","류마","카온","미루","테오","라칸","유하","노엘","진"];
    const namePartsB = ["화린","풍각","뇌진","청류","철심","별검","운랑","신월","여명","비천"];


