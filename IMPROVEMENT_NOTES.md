# Improvement Notes

## 우선 수정 필요

### 1. `#gameShell` grid 레이아웃 복구

- 위치: `styles.css`
- 현재 `#gameShell`의 `display: grid`가 주석 처리되어 있다.
- `grid-template-columns`, `grid-template-rows`, `grid-column`, `grid-row` 설정은 모두 grid 레이아웃을 전제로 한다.
- 이 상태에서는 캔버스, 오른쪽 패널, 하단 패널이 의도한 위치에 배치되지 않을 수 있다.

권장 수정:

- `#gameShell`에 `display: grid;`를 복구한다.
- 복구 후 1600 x 760 기준에서 캔버스 1450 x 640, 사이드 패널 150px, 하단 패널 72px 배치가 맞는지 확인한다.

### 2. 대화 상태 정리 로직 추가

- 위치: `scripts/systems.js`, `scripts/entities.js`
- 대화 시작 시 speaker와 target의 state가 `talking`으로 바뀐다.
- 회유 실패, 선택 해제, 대상 사망, 대화 중단, 성공 이후에 speaker 상태가 안정적으로 `idle`로 돌아간다는 보장이 약하다.
- `Unit.update()`는 `talking` 상태면 바로 return하므로, 상태가 남으면 유닛이 멈춘 채로 남을 수 있다.

권장 수정:

- `DialogueSystem.close()` 또는 `clearActiveDialogue()` 같은 정리 함수를 만든다.
- 정리 함수에서 active target과 speaker의 `talking` 상태를 `idle`로 되돌린다.
- ESC, 새 명령, 대상 사망, 회유 성공/실패 흐름에서 같은 정리 함수를 호출한다.

### 3. 전투 추적 이동에 A* 적용

- 위치: `scripts/entities.js`
- 일반 이동 명령은 `GameMap.findPath()`를 사용한다.
- 하지만 공격 대상이 사거리 밖이면 `moveToward(target.x, target.y)`로 직선 이동한다.
- 이 때문에 전투 추적 중 물 타일 등 이동 불가 지형을 우회하지 못하고 통과하거나 막힐 수 있다.

권장 수정:

- 공격 대상 추적도 일정 주기마다 target tile로 A* 경로를 갱신하도록 바꾼다.
- 매 프레임 A*를 돌리면 비용이 커질 수 있으므로, 추적 경로 재계산 쿨다운을 둔다.
- 대상이 이동했거나 기존 경로가 비었을 때만 재계산하는 방식이 적당하다.

### 4. 건물 점령 progress 전환 규칙 수정

- 위치: `scripts/entities.js`
- 현재 점령 중인 세력이 바뀌어도 `captureProgress`가 그대로 유지된다.
- 예를 들어 적이 90%까지 올린 점령 게이지를 플레이어가 이어받아 바로 점령할 수 있다.

권장 수정:

- `captureFaction`이 바뀌면 `captureProgress`를 초기화한다.
- 또는 기존 점령 게이지를 먼저 감산하고 0이 된 뒤 새 세력이 progress를 쌓도록 만든다.
- 어떤 규칙을 선택하든 UI 게이지 색상과 실제 점령 세력이 일관되게 보여야 한다.

### 5. 랜덤 맵 연결성 검증 추가

- 위치: `scripts/map.js`, `scripts/main.js`
- 맵은 랜덤 생성되지만 walkable 영역 연결성을 보장하지 않는다.
- 플레이어 시작 위치, 적 시작 위치, 성채, 주요 건물이 서로 도달 불가능한 영역에 생길 수 있다.

권장 수정:

- 맵 생성 후 flood fill 또는 BFS로 walkable component를 계산한다.
- 플레이어 base, enemy base, fortress, 주요 건물이 같은 component에 있는지 확인한다.
- 실패하면 맵을 재생성하거나, 핵심 지점 주변의 물 타일을 평지로 보정한다.

### 6. 유닛 생산 위치 점유 검사

- 위치: `scripts/main.js`
- `spawnUnitNear()`는 주변 타일이 walkable인지 확인하지만, 다른 유닛이나 건물 점유 여부는 확인하지 않는다.
- 병영 생산 유닛이 다른 유닛 또는 건물과 겹쳐 생성될 수 있다.

권장 수정:

- 후보 타일이 walkable인지 확인한다.
- 같은 타일에 건물이 있는지 확인한다.
- 일정 반경 안에 기존 유닛이 있는지 확인한다.
- 모든 후보가 막혀 있으면 생산을 미루거나 로그를 남긴다.

## 중간 우선순위

### 7. 입력 처리 안정화

- 위치: `scripts/systems.js`
- `keydown`은 window 전체에 걸려 있다.
- 버튼에 포커스가 있거나 브라우저 기본 동작이 있는 키에서도 게임 입력이 처리될 수 있다.

권장 수정:

- 게임에서 사용하는 키는 필요한 경우 `preventDefault()`를 호출한다.
- 버튼이나 입력 UI에 포커스가 있을 때는 단축키 처리를 제한한다.
- 시작 전에는 이동/대화/명령 입력을 막을지 정책을 정한다.

### 8. 로그 DOM 갱신 방식 정리

- 위치: `scripts/main.js`
- 로그 출력은 `innerHTML`을 사용한다.
- 현재 로그 문자열은 내부에서 만들어져 위험은 낮지만, 나머지 패널은 DOM API를 쓰고 있어 방식이 섞여 있다.

권장 수정:

- `logLines.replaceChildren(...)` 방식으로 통일한다.
- 로그 메시지가 외부 입력을 포함하게 될 가능성을 낮춰 둔다.

### 9. 감시탑 효과와 시야 시스템 분리

- 위치: `scripts/systems.js`, `scripts/renderer.js`
- 감시탑은 AI 탐지 반경 보너스와 시각적 원 표시만 있다.
- 실제 fog of war나 플레이어 시야 제한 시스템은 아직 없다.

권장 수정:

- 당장은 "AI 탐지 보너스"로 명확히 이름을 붙인다.
- 이후 fog of war를 추가한다면 `VisionSystem`처럼 별도 시스템으로 분리한다.

### 10. 시작 전/게임 종료 후 입력 정책 정리

- 위치: `scripts/main.js`, `scripts/systems.js`
- 시작 전에도 선택, 우클릭 명령, 대화 입력은 받을 수 있다.
- update는 멈춰 있지만 입력 상태는 바뀔 수 있으므로 UX가 애매하다.

권장 수정:

- `InputManager` 또는 `Game.issueRightClick()` 진입부에서 `started && !gameOver`를 확인한다.
- 시작 전에는 카메라 확인과 선택만 허용할지, 모든 입력을 막을지 결정한다.

## 낮은 우선순위

### 11. HTML/CSS 정리

- 위치: `index.html`, `styles.css`
- `index.html`의 `#gameFrame` 내부 들여쓰기가 흐트러져 있다.
- `styles.css` 최상단 일부 규칙에 불필요한 들여쓰기가 많다.

권장 수정:

- 동작 변경 없이 포맷만 정리한다.
- 인라인 `style="display:none"`은 CSS class 또는 초기화 JS로 옮길 수 있다.

### 12. `WORK_LOG.md` 인코딩 확인

- 위치: `WORK_LOG.md`
- 일부 PowerShell/콘솔 환경에서 한글이 깨져 보일 수 있다.
- 파일 자체는 UTF-8일 가능성이 높지만, 협업 환경에서는 명시가 필요하다.

권장 수정:

- `.editorconfig`에 `charset = utf-8`을 추가한다.
- README 또는 작업 로그에 UTF-8 저장을 명시한다.

### 13. 테스트/검증 스크립트 추가

- 위치: 새 테스트 파일 또는 간단한 검증 스크립트
- 현재 검증은 문법 검사 중심이다.
- 실제 플레이 품질은 랜덤 생성과 상태 전환에 크게 좌우된다.

권장 검증:

- `node --check scripts/*.js`
- 랜덤 맵 100회 생성 후 핵심 지점 연결성 검사
- 점령 세력 전환 시 progress 초기화/감산 검사
- 대화 성공/실패/중단 후 유닛 state 복구 검사
- 성채 60초 점령 승패 조건 검사

 