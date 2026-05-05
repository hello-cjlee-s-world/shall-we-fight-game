# Improvement Notes

## 긴급 — 버그 및 상태 오염

### 1. ~~대화 상태 정리 로직 추가~~ ✅ 완료 (2026-04-29)

- 위치: `scripts/systems.js`, `scripts/main.js`
- **수정 완료.** 아래 내용은 기록 목적으로만 남겨둔다.

변경 내용:

- `DialogueSystem`에 `activeSpeaker` 필드 추가 — speaker를 추적해야 `close()`에서 상태 복구 가능.
- `DialogueSystem.close(reason?)` 공통 정리 함수 신설. speaker/target의 `hp > 0` 여부를 확인한 뒤 `state`를 `idle`로 복구하고 두 참조를 null로 초기화.
- `tryOpen()` — 이미 대화가 열려 있으면 `close()` 먼저 호출 후 새 대화 시작.
- `choose()` — 회유 성공·실패 양쪽에서 `close()` 호출. 성공 시 `textEl`을 미리 설정하고 `close("silent")`로 안내 문구 덮어쓰기 방지.
- `choose()` — 선택지 처리 진입 시 `activeTarget.hp <= 0` 또는 `activeSpeaker.hp <= 0` 이면 즉시 `close()`.
- `DialogueSystem.tick()` 신설 — 매 프레임 target/speaker 생존 여부를 확인해 사망 시 자동 `close()`.
- `Game.update()` — `dialogue.tick()` 호출 추가.
- `InputManager.onKey()` ESC 처리 — 대화 중이면 `dialogue.close()`, 그 외엔 기존 `clearSelection()`.
- `Game.clearSelection()` — 선택 해제 시 `activeSpeaker`가 선택 목록에 있으면 `dialogue.close()` 호출.
- `Game.endGame()` — 게임 종료 시 `dialogue.close("silent")` 호출.
- `Game.restartGame()` — 재시작 전 `dialogue.close("silent")` 호출.

### 2. ~~건물 점령 progress 전환 규칙 수정~~ ✅ 완료 (2026-04-29)

- 위치: `scripts/entities.js` → `Building.update()`
- **수정 완료.** 아래 내용은 기록 목적으로만 남겨둔다.

변경 내용:

- 점령 시도 세력(`incomingFaction`)을 기존 `captureFaction`과 비교해, 세력이 다르면 `captureProgress`를 0으로 초기화한 뒤 새 세력의 progress 누적을 시작.
- 점령 완료(`captureProgress >= 100`) 시 `captureFaction`도 `null`로 초기화 — 직전에는 완료 후에도 참조가 남아 있었음.
- 감산 분기(`contenders` 없음)의 동작은 그대로 유지: 게이지를 dt * 10씩 감산, 0이 되면 `captureFaction = null`.

### 3. ~~렌더러 메모리 누수 수정~~ ✅ 완료 (2026-04-29)
### 3-2. ~~renderer factionMat / labelTexture 캐시 개선~~ ✅ 완료 (2026-04-30)

- 위치: `scripts/renderer.js`
- **수정 완료.** 아래 내용은 기록 목적으로만 남겨둔다.

변경 내용 (2026-04-30 개선):

- **캐시 Map 용도별 분리** — 이전에는 `factionMatCache` 하나에 faction std / vision ring / capture bar / mage orb 등 이종 material을 prefix string key(`"vision_"`, `"mage_orb_"` 등)로 혼재시켰음. 용도마다 전용 Map으로 분리해 코드 가독성과 유지보수성 향상.
  - `_factionStdCache`  — 건물 지붕·배너, 유닛 몸체 (MeshStandardMaterial)
  - `_gearStdCache`     — 유닛 장비·머리카락 (MeshStandardMaterial)
  - `_visionMatCache`   — 감시탑 vision ring (투명 MeshBasicMaterial)
  - `_captureMatCache`  — 점령 게이지 fill (MeshBasicMaterial)
  - `_mageOrbMatCache`  — 마법사 orb (투명 MeshBasicMaterial)
  - `_labelCache`       — 유닛 라벨 `{ texture, material }` (role → SpriteMaterial)
- **`_cachedMatSet: Set`** — 캐시된 material 전체를 하나의 Set으로 관리. `_disposeObject()` 에서 `_isCachedMaterial()` 조회 시 Map 전체를 배열로 변환하던 O(n) 비용을 O(1)로 개선. `_cacheAndRegister(map, key, mat)` 헬퍼로 Map 등록과 Set 등록을 동시에 수행.
- **`_cachedGeomSet: Set`** — geometry도 동일하게 Set 조회로 교체. `Object.values(this.geometries).includes(geom)` → `this._cachedGeomSet.has(geom)`.
- **effect mesh pool** — `drawEffect()`가 매 프레임 `new THREE.MeshBasicMaterial()`을 생성하던 것을 `_effectPool` 배열로 교체. 프레임마다 `_effectPoolIdx`를 0으로 리셋하고 `_acquireEffectMesh()`로 기존 mesh를 빌려와 `material.color`·`material.opacity`만 업데이트해 재사용. pool size가 부족하면 자동 확장.
- **`healerGlow`, `watchBeacon` material** — `drawBuilding()` 내부의 `if (!this.materials.xxx)` 조건부 생성을 `createMaterials()`로 이동해 일괄 초기화.
- **`_labelCache` texture 분리 보관** — 캐시 entry를 `{ texture, material }` 구조로 저장해 추후 texture만 교체하거나 `texture.dispose()`를 독립적으로 호출할 수 있도록 준비.

---

## 높음 — 게임플레이 결함

### ~~4. 전투 추적 이동에 A* 적용~~ ✅ 완료 (2026-05-05)

- 위치: `scripts/entities.js` → `Unit.update()` attacking 분기
- **수정 완료.** 아래 내용은 기록 목적으로만 남겨둔다.

변경 내용:

- 공격 대상 추적에도 일정 주기마다 target tile로 A* 경로를 갱신하도록 수정했다.
- 대상이 이동했거나 기존 경로가 비었을 때만 재계산한다.

### ~~5. 랜덤 맵 연결성 검증 추가~~ ✅ 완료 (2026-05-05)

- 위치: `scripts/map.js` → `GameMap.generate()`, `scripts/main.js` → `createWorld()`
- **수정 완료.** 아래 내용은 기록 목적으로만 남겨둔다.

변경 내용:

- 맵 생성 후 BFS로 walkable component를 계산한다.
- 플레이어 base, enemy base, 성채가 같은 component에 있는지 확인한다.
- 실패하면 맵을 재생성한다.

### ~~6. resolveCollisions 내부 공간 해시 이중 구성 제거~~ ✅ 완료 (2026-05-05)

- 위치: `scripts/main.js` → `update()`, `resolveCollisions()`
- **수정 완료.** 아래 내용은 기록 목적으로만 남겨둔다.

변경 내용:

- `resolveCollisions()` 내부의 `spatialHash.clear()` + `insert` 2줄을 제거했다.
- `update()`에서 이미 구성된 해시를 그대로 사용한다.

### 7. Three.js CDN 의존성 — 오프라인 환경 및 로드 실패 대응

- 위치: `index.html`
- Three.js를 CDN에서만 로드하므로 오프라인 환경에서 렌더러 전체가 작동하지 않는다.
- CDN 응답 지연 시 `THREE is not defined` 런타임 오류가 발생할 수 있다.

권장 수정:

- `three.min.js`를 `vendor/` 폴더에 포함해 로컬에서 로드한다.
- 또는 로드 실패 시 사용자에게 오류 메시지를 표시하는 fallback 처리를 추가한다.

---

## 중간 — UX / 코드 품질

### ~~8. 시작 전 / 게임 종료 후 입력 정책 정리~~ ✅ 완료 (2026-05-05)

- 위치: `scripts/main.js` → `issueRightClick()`, `scripts/systems.js` → `InputManager.onKey()`
- **수정 완료.** 아래 내용은 기록 목적으로만 남겨둔다.

변경 내용:

- `issueRightClick()` 진입부에 `!this.started || this.gameOver` 가드 추가 — 시작 전·종료 후 이동·공격 명령 차단.
- `onKey()` 의 `e` 키 처리에 `started && !gameOver` 조건 추가 — 시작 전·종료 후 대화 명령 차단.
- 카메라 이동과 유닛 선택은 시작 전에도 허용한다.

### 9. 유닛 생산 위치 점유 검사

- 위치: `scripts/main.js` → `spawnUnitNear()`
- walkable 여부만 확인하고, 같은 타일에 이미 유닛이 있는지 확인하지 않는다.
- 병영에서 유닛이 다른 유닛과 겹쳐 생성될 수 있다.

권장 수정:

- 후보 타일이 walkable인지 확인한다.
- 일정 반경 안에 기존 유닛이 있는지 확인한다.
- 모든 후보가 막혀 있으면 생산을 미루거나 로그를 남긴다.

### 10. 로그 DOM 갱신 방식 정리

- 위치: `scripts/main.js` → `updateUI()`
- 유닛/건물 패널은 DOM API를 사용하지만 로그 출력은 `innerHTML`을 사용해 방식이 혼재되어 있다.
- 현재 로그 내용은 내부에서만 생성되므로 XSS 위험은 낮지만, 추후 외부 입력이 포함되면 위험해진다.

권장 수정:

- `logLines.replaceChildren(...)` 방식으로 통일한다.

### 11. 입력 처리 안정화

- 위치: `scripts/systems.js`
- `keydown`은 window 전체에 걸려 있다.
- 버튼에 포커스가 있거나 브라우저 기본 동작이 있는 키에서도 게임 입력이 처리될 수 있다.

권장 수정:

- 게임에서 사용하는 키는 필요한 경우 `preventDefault()`를 호출한다.
- 버튼이나 입력 UI에 포커스가 있을 때는 단축키 처리를 제한한다.

---

## 낮음 — 코드 정리 / 확장성

### 12. `weaponGeometry()` 메서드 데드코드 제거

- 위치: `scripts/renderer.js`
- `weaponGeometry(u)` 메서드가 정의되어 있으나 `addClassGear()` 내부에서 geometry를 직접 생성하므로 실제로 호출되지 않는다.

권장 수정:

- `weaponGeometry()` 메서드를 제거하거나, `addClassGear()`가 이 메서드를 사용하도록 통일한다.

### 13. 감시탑 효과와 시야 시스템 분리 준비

- 위치: `scripts/systems.js` → `AIController`, `scripts/renderer.js` → `drawWatchTowerVision()`
- 감시탑은 AI 탐지 반경 보너스와 시각적 원 표시만 있고, 실제 fog of war나 플레이어 시야 제한 시스템은 없다.

권장 수정:

- 현재 감시탑 효과에 "AI 탐지 보너스"임을 명확히 주석으로 명시한다.
- 이후 fog of war를 추가한다면 `VisionSystem`처럼 별도 시스템으로 분리한다.

### 14. HTML/CSS 정리

- 위치: `index.html`, `styles.css`
- `styles.css` 최상단 일부 규칙에 4칸 들여쓰기가 2칸과 혼재되어 있다.
- `index.html`의 인라인 `style="display:none"`을 CSS class 또는 초기화 JS로 옮길 수 있다.
- `#gameShell`의 `display: grid`가 주석 처리되어 있어 캔버스·패널 레이아웃이 의도한 위치에 배치되지 않을 수 있다.

권장 수정:

- `#gameShell`에 `display: grid;`를 복구하고, 1600×760 기준에서 캔버스 1450×640, 사이드 패널 150px, 하단 패널 72px 배치를 확인한다.
- 들여쓰기와 인라인 스타일을 정리한다.

### 15. `WORK_LOG.md` 인코딩 확인

- 위치: `WORK_LOG.md`
- 일부 PowerShell/콘솔 환경에서 한글이 깨져 보일 수 있다.

권장 수정:

- `.editorconfig`에 `charset = utf-8`을 추가한다.

---

## 테스트 / 검증

### 16. 검증 스크립트 추가

- 위치: 새 테스트 파일 또는 간단한 검증 스크립트
- 현재 검증은 문법 검사 중심이다.

권장 검증 항목:

- `node --check scripts/*.js`
- 랜덤 맵 100회 생성 후 핵심 지점 연결성 검사
- 점령 세력 전환 시 progress 초기화/감산 검사
- 대화 성공/실패/중단 후 유닛 state 복구 검사
- 성채 60초 점령 승패 조건 검사
- 공간 해시 이중 구성 미발생 확인

---

## 완료 항목

| 날짜 | 항목 |
|------|------|
| 2026-04-29 | 렌더러 메모리 누수 수정 (material/geometry/texture 캐시, clearGroup 재귀 dispose) |
| 2026-04-29 | 대화 상태 정리 (DialogueSystem.close(), tick(), ESC·사망·재시작·종료 경로 전체 적용) |
| 2026-04-29 | 건물 점령 progress 세력 교체 시 초기화 (captureFaction 변경 감지 + 완료 후 null 처리) |
| 2026-04-30 | renderer factionMat/labelTexture 캐시 개선 (용도별 Map 분리, Set O(1) 조회, effect pool) |
| 2026-05-05 | 전투 추적 이동 A* 적용 (attacking 분기에서 일정 주기 경로 갱신) |
| 2026-05-05 | 랜덤 맵 연결성 검증 (BFS로 플레이어·적·성채 같은 component 확인, 실패 시 재생성) |
| 2026-05-05 | resolveCollisions 공간 해시 이중 구성 제거 (update()에서 구성한 해시 재사용) |
| 2026-05-05 | 시작 전/종료 후 입력 가드 추가 (issueRightClick, onKey E키에 started && !gameOver 체크) |
