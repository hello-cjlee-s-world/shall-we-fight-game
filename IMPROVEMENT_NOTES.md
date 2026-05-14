# Improvement Notes

## 미완료 항목

### 🔴 높음

#### 7. Three.js CDN 의존성 — 오프라인 환경 및 로드 실패 대응

- 위치: `index.html`
- Three.js를 CDN에서만 로드하므로 오프라인 환경에서 렌더러 전체가 작동하지 않는다.
- CDN 응답 지연 시 `THREE is not defined` 런타임 오류가 발생할 수 있다.

권장 수정:

- `three.min.js`를 `vendor/` 폴더에 포함해 로컬에서 로드한다.
- 또는 로드 실패 시 사용자에게 오류 메시지를 표시하는 fallback 처리를 추가한다.

---

### 🟡 중간


---

### 🟢 낮음

#### 15. `WORK_LOG.md` 인코딩 확인

- 위치: `WORK_LOG.md`
- 일부 PowerShell/콘솔 환경에서 한글이 깨져 보일 수 있다.

권장 수정:

- `.editorconfig`에 `charset = utf-8`을 추가한다.

---

### 🧪 테스트 / 검증

#### 16. 검증 스크립트 추가

- 위치: 새 테스트 파일 또는 간단한 검증 스크립트
- 현재 검증은 문법 검사 중심이다.

권장 검증 항목:

- `node --check scripts/*.js`
- 랜덤 맵 100회 생성 후 핵심 지점 연결성 검사
- 점령 세력 전환 시 progress 초기화/감산 검사
- 대화 성공/실패/중단 후 유닛 state 복구 검사
- 성채 60초 점령 승패 조건 검사

---

## 완료 항목

| 날짜 | # | 항목 | 변경 내용 |
|------|---|------|-----------|
| 2026-04-29 | 1 | 대화 상태 정리 | `DialogueSystem.close()`, `tick()` 신설. ESC·사망·재시작·종료 경로 전체 적용 |
| 2026-04-29 | 2 | 건물 점령 progress 세력 교체 초기화 | `captureFaction` 변경 감지 + 완료 후 null 처리 |
| 2026-04-29 | 3 | 렌더러 메모리 누수 수정 | material/geometry/texture 캐시, `clearGroup` 재귀 dispose |
| 2026-04-30 | 3-2 | renderer 캐시 개선 | 용도별 Map 분리, Set O(1) 조회, effect mesh pool |
| 2026-05-05 | 4 | 전투 추적 이동 A* 적용 | `attacking` 분기에서 일정 주기마다 target tile로 A* 경로 갱신 |
| 2026-05-05 | 5 | 랜덤 맵 연결성 검증 | BFS로 플레이어·적·성채 같은 component 확인, 실패 시 재생성 |
| 2026-05-05 | 6 | resolveCollisions 공간 해시 이중 구성 제거 | `resolveCollisions()` 내부 clear+insert 제거, `update()` 해시 재사용 |
| 2026-05-05 | 8 | 시작 전/종료 후 입력 가드 추가 | `issueRightClick()`, `onKey()` E키에 `started && !gameOver` 체크 |
| 2026-05-06 | 9 | 유닛 생산 위치 점유 검사 | `tileX/tileY` 점유 확인, 실패 시 gold 환급·3초 재시도 |
| 2026-05-08 | 10 | 로그 DOM 갱신 방식 정리 | 로그·건물·유닛 패널 `innerHTML` → `replaceChildren()` 전체 통일 |
| 2026-05-12 | 11 | 입력 처리 안정화 | 방향키·WASD `preventDefault()` 추가, 버튼 포커스 시 게임 단축키 무시 |
| 2026-05-13 | 12 | `weaponGeometry()` 데드코드 제거 | 코드베이스에서 이미 제거된 상태로 확인 — 별도 수정 불필요 |
| 2026-05-13 | 13 | 감시탑 효과 주석 명시 | `_watchVisionBonus()`, `drawWatchTowerVision()`에 AI 탐지 전용·fog of war 미연결 주석 추가 |
| 2026-05-14 | 14 | HTML/CSS 정리 | CSS 불필요 들여쓰기 제거, `restartButton` 인라인 스타일 → `.hidden` 클래스로 교체 |
