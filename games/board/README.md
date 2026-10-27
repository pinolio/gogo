# 보드게임 (board)

| 폴더 | 게임 | 판 |
|---|---|---|
| `baduk/` | 바둑 | 9줄 · 덤 6.5 |
| `omok/` | 오목 | 15줄 |
| `janggi/` | 장기 | 9×10 |
| `chess/` | 체스 | 8×8 |
| `alkkagi/` | 장기 알까기 | 장기알 16개씩 |
| `code/` | 숫자 코드 (다빈치 코드 방식) | 0~11 타일 24장 |

- 공통 도구: `games/common/board.js` (도트 원·나무판·터치 처리·컴퓨터 생각 시간)
- 모든 보드게임은 같은 약속을 따릅니다: `create(canvas, hooks)` → `start({ mode: 'ai' | 'local', level })`, `press(버튼id)`
  - 게임이 알려 주는 것: `onTurn`(차례 문구), `onButtons`(게임 버튼), `onOver({ winner: 0 | 1 | -1, message })`
  - 컴퓨터와 둘 때 사람은 항상 먼저 두는 쪽(0)
- `settings.js`에 `board: true` 를 적으면 포털이 대국 화면(방식 고르기 · 차례 · 기권)을 자동으로 붙입니다.
- 다음 단계: 친구와 온라인 대국 (Supabase 실시간 채널 이용 예정)
