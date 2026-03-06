# 롤 팀 경매장 프론트엔드 (LoL Queen Team Auction Front) - 개발 가이드 및 인수인계서

이 문서는 다음 AI 어시스턴트가 프로젝트의 구조와 현재 진행 상황을 즉시 파악하고 이어서 작업할 수 있도록 작성된 가이드입니다.

## 1. 프로젝트 개요 및 기술 스택
- **프레임워크:** React 18, TypeScript, Vite
- **라우팅:** React Router DOM v6 (`/` - 경매장 메인, `/login` - 치지직 OAuth 로그인)
- **전역 상태 관리:** Zustand (`useAuthStore`, `useAuctionStore`, `useSocketStore`)
- **실시간 통신:** STOMP over WebSocket (`@stomp/stompjs`)
- **스타일링 & UI:** Tailwind CSS v4, shadcn/ui (Radix UI 기반)
- **API 클라이언트:** Axios (인터셉터 적용, HttpOnly 쿠키 처리용 `withCredentials: true` 활성화)
- **에러 핸들링:** Spring Boot 3 `ProblemDetail` 스펙 기반의 공통 에러 토스트(Sonner) 알림 처리

## 2. 핵심 디렉토리 구조
```text
src/
├── components/
│   ├── AdminTeamAssignmentDialog.tsx # 어드민 전용 '팀 수동 지정' 모달
│   └── ui/                           # shadcn/ui 컴포넌트들 (Avatar, Badge, Card, Dialog, Input, ScrollArea, Select 등)
├── hooks/
│   └── useAuctionTimer.ts            # 프론트엔드 전용 15초 카운트다운 타이머 (서버 bidRemainSeconds 기반 동기화)
├── lib/
│   ├── api.ts                        # Axios 인스턴스 (인터셉터를 통한 401 및 ProblemDetail 공통 에러 처리)
│   └── utils.ts                      # tailwind merge 등 유틸
├── pages/
│   ├── Home.tsx                      # 메인 경매장 대시보드 화면 (가장 복잡한 UI/비즈니스 로직 집약)
│   └── Login.tsx                     # 치지직 로그인 진입점 화면
└── store/
    ├── useAuctionStore.ts            # 경매 상태, 매물 정보, 팀/대기열/유찰자 상태 관리
    ├── useAuthStore.ts               # 로그인 유저 상태 및 권한(Role) 관리
    └── useSocketStore.ts             # STOMP 소켓 연결 및 구독/발행 관리 (메시지 수신 시 useAuctionStore 업데이트)
```

## 3. 핵심 비즈니스 로직 및 상태 관리 (Zustand)

### 3.1 `useSocketStore.ts` (통신)
- **엔드포인트:** Vite 프록시를 통해 `/ws` 로 연결 (개발 환경 CORS 회피 및 HttpOnly 쿠키 전송 위함).
- **구독(Subscribe):**
  - `/sub/auction`: 글로벌 경매 상태 이벤트 수신
  - `/user/sub/auction`: 유저 개인 수신용 이벤트
- **메시지 타입 핸들링 (중요):**
  - `JUST_MESSAGE`: 단순 안내 로그 (화면 우측 보드에 표시)
  - `BIDDING_STARTED`: 경매 시작. 이전 로그 클리어 및 타이머 시작 (bidRemainSeconds 기준).
  - `BIDDING_END`: 경매 종료. 타이머 정지 및 중앙 입찰판 초기화, 낙찰 텍스트가 있으면 폭죽 효과(`canvas-confetti`) 실행.
  - `BIDDING_INFO`: 새로운 입찰 또는 다음 매물 지정 시 수신. `bidRemainSeconds` 존재 여부에 따라 `IN_PROGRESS` 또는 `PREPARED` 상태 판별.
  - `PLAYER_INFOS`: 왼쪽 팀 목록 및 하단 대기열 갱신 데이터. `auctionType`에 따라 유찰자와 대기자를 필터링.
  - `AUCTION_TYPE`: `LEADER_AUCTION`(팀장 경매), `PLAYER_AUCTION`(플레이어 경매), `FINISHED` 등 경매 페이즈 변경.

### 3.2 `useAuctionStore.ts` (상태)
- **`status`:** `WAITING`, `PREPARED`, `IN_PROGRESS`, `CLOSED`
- **유찰자 분리 로직 (`updatePlayersInfo`):**
  - `LEADER_AUCTION` 일 때는 유찰(bidFailedCount)을 무시하고 모두 `waitingPlayers`에 넣음.
  - `PLAYER_AUCTION` 이고 `bidFailedCount > 0` 인 유저는 `unbidPlayers` 배열로 이동.
  - 정렬 기준: 1순위 유찰 횟수 낮은 순(오름차순), 2순위 유찰 시간 오래된 순.

### 3.3 `useAuctionTimer.ts` (훅)
- `setInterval`을 이용한 로컬 타이머이나, 시스템 시간 드리프트 방지를 위해 **서버에서 보내준 `bidRemainSeconds`를 절대적 기준**으로 삼아 15초(또는 잔여 초)부터 카운트다운을 시작함. (의존성 배열에 `highestBid`를 넣어 입찰 시마다 즉각 리셋됨)

## 4. 메인 화면 (`Home.tsx`) 주요 UI 요소
1. **왼쪽 (팀 현황):**
   - 여왕/공주 (`QUEEN`, `PRINCESS`)의 이름으로 팀 이름을 결정.
   - 여왕/공주 -> 팀장(LEADER) -> 일반 팀원(PLAYER) 순으로 렌더링.
   - `TeamMemberRow` 헬퍼 컴포넌트는 타이머 1초마다의 리렌더링 깜빡임 방지를 위해 `React.memo`로 분리됨.
2. **상단 중앙 (현재 매물 & 입찰 보드):**
   - 매물 정보 및 현재 최고 입찰가, 입찰자.
   - `ADMIN`, `QUEEN`, `PRINCESS`, `LEADER` 권한만 입찰 버튼(`+5, +10, ...`) 활성화.
   - 금액 버튼 클릭 시 직접 전송하지 않고 Input 필드에 금액 누적. [입찰] 버튼 클릭 시에만 API 전송.
   - 어드민일 경우 '매물 수동 지정', '경매 시작', '다음 매물 준비', '플레이어 경매로 전환' 컨트롤 패널 렌더링.
3. **하단 (대기열 & 타이머):**
   - `LEADER_AUCTION` 시: 가로 그리드(flex-wrap) 형태로 나열.
   - `PLAYER_AUCTION` 시: [탑, 정글, 미드, 원딜, 서폿, 유찰] 6개의 세로 컬럼(기둥)으로 분리하여 렌더링.
   - 빈 공간은 Radix Select의 `disabled` 이슈를 피하기 위해 UI상으로만 비활성 처리됨.

## 5. 알려진 이슈 및 다음 AI를 위한 당부 사항
1. **타임 드리프트 (Time Drift) 방어:** 타이머는 클라이언트의 `Date.now()` 대신 무조건 서버가 쏴주는 `bidRemainSeconds`를 기준으로 시작해야 오차가 발생하지 않습니다. 로직을 건드릴 때 주의하세요.
2. **렌더링 최적화:** `Home.tsx`는 타이머 때문에 매 초 렌더링이 일어납니다. 무거운 컴포넌트나 함수(`handleBid` 등)는 반드시 `memo`나 `useCallback` 처리가 유지되어야 합니다.
3. **API 에러 규격:** 백엔드는 Spring Boot 3 `ProblemDetail` (RFC 7807) 형식으로 에러를 반환합니다. `lib/api.ts`에서 이를 파싱하여 토스트(`sonner`)로 글로벌 처리하고 있으므로, 개별 컴포넌트에서 에러 alert를 띄울 필요가 없습니다. (단, errorCode 노출은 제거됨)

## 6. 실행 방법
- 패키지 설치: `npm install`
- 개발 서버 실행: `npm run dev`
- (vite.config.ts에 proxy 설정이 되어있어, 로컬 백엔드 `http://localhost:28281`로 API 및 WS 요청이 자동 라우팅됨)
