import { create } from 'zustand';

export interface AuctionTarget {
  targetName: string;
  targetPosition: string;
  targetTier: string;
  targetImgUrl: string | null;
}

export interface BiddingInfo {
  targetName: string;
  targetImgUrl: string | null;
  targetTier: string;
  targetPosition: string;
  currentBidderName: string | null;
  currentBidPoint: number;
  bidRemainSeconds: number | null;
}

export interface MemberInfo {
  chzzkName: string;
  imgUrl: string | null;
  position: string;
  tier: string;
  role: 'QUEEN' | 'PRINCESS' | 'LEADER' | 'PLAYER' | 'ADMIN';
  bidFailedCount?: number;
  bidFailedAt?: string | null;
}

export interface TeamInfo {
  members: MemberInfo[];
  point: number;
}

interface AuctionState {
  // 경매장 전역 상태
  status: 'WAITING' | 'PREPARED' | 'IN_PROGRESS' | 'CLOSED';
  auctionType: 'LEADER_AUCTION' | 'PLAYER_AUCTION' | 'FINISHED'; // 현재 경매 타입 (팀장 경매, 플레이어 경매, 종료)
  currentTarget: AuctionTarget | null; // 현재 매물 정보
  highestBid: number;
  highestBidder: string | null;
  bidRemainSeconds: number | null;
  bidLogs: { message: string, isSystem: boolean, time: string }[]; // 입찰 기록
  
  // 팀 및 대기열 정보
  teams: TeamInfo[];
  waitingPlayers: MemberInfo[];
  unbidPlayers: MemberInfo[]; // 유찰된 매물 목록
  
  // 상태 업데이트 액션들
  setAuctionStatus: (status: 'WAITING' | 'PREPARED' | 'IN_PROGRESS' | 'CLOSED', bidRemainSeconds?: number) => void;
  setAuctionType: (type: 'LEADER_AUCTION' | 'PLAYER_AUCTION' | 'FINISHED') => void;
  updateBiddingInfo: (info: BiddingInfo) => void;
  clearBiddingInfo: () => void;
  updatePlayersInfo: (info: { teamInfo: TeamInfo[], playerInfo: MemberInfo[] }) => void;
  addLogMessage: (message: string, isSystem?: boolean) => void;
  clearLogs: () => void;
}

export const useAuctionStore = create<AuctionState>((set) => ({
  status: 'WAITING',
  auctionType: 'LEADER_AUCTION', // 기본값
  currentTarget: null,
  highestBid: 0,
  highestBidder: null,
  bidRemainSeconds: null,
  bidLogs: [],
  teams: [],
  waitingPlayers: [],
  unbidPlayers: [],

  setAuctionStatus: (status, bidRemainSeconds) => set((state) => ({ 
    status,
    bidRemainSeconds: bidRemainSeconds !== undefined ? bidRemainSeconds : state.bidRemainSeconds 
  })),

  setAuctionType: (type) => set({ auctionType: type }),

  clearBiddingInfo: () => set({
    currentTarget: null,
    highestBid: 0,
    highestBidder: null,
    bidRemainSeconds: null,
    status: 'CLOSED'
  }),
  
  updateBiddingInfo: (info) => set((state) => {
    // 만약 서버에서 info 자체를 null 로 보내면(경매가 초기화된 상태 등), 관련 상태를 모두 비웁니다.
    if (!info) {
      return {
        currentTarget: null,
        highestBid: 0,
        highestBidder: null,
        bidRemainSeconds: null,
        status: 'WAITING'
      };
    }

    // bidRemainSeconds 값이 있으면 현재 경매가 진행 중인 상태이므로 IN_PROGRESS로,
    // 없으면 단순히 다음 매물로 대기 중인 상태이므로 PREPARED로 설정합니다.
    let newStatus = state.status;
    if (info.targetName) {
      newStatus = info.bidRemainSeconds !== null && info.bidRemainSeconds !== undefined ? 'IN_PROGRESS' : 'PREPARED';
    }

    return {
      currentTarget: {
        targetName: info.targetName,
        targetImgUrl: info.targetImgUrl,
        targetTier: info.targetTier,
        targetPosition: info.targetPosition,
      },
      highestBid: info.currentBidPoint,
      highestBidder: info.currentBidderName,
      bidRemainSeconds: info.bidRemainSeconds,
      status: newStatus
    };
  }),

  updatePlayersInfo: (info) => set((state) => ({
    teams: info.teamInfo,
    // 서버가 내려준 playerInfo 전체 목록을 순회하여 유찰자와 대기자로 분리합니다.
    // 팀장 경매(LEADER_AUCTION)일 때는 유찰 개념을 화면에 표시하지 않으므로 모두 대기열로 보냅니다.
    // 플레이어 경매(PLAYER_AUCTION)일 때는 bidFailedCount를 기준으로 유찰자를 분리합니다.
    waitingPlayers: info.playerInfo.filter(p => 
      state.auctionType === 'LEADER_AUCTION' || !p.bidFailedCount || p.bidFailedCount === 0
    ),
    unbidPlayers: state.auctionType === 'LEADER_AUCTION' ? [] : info.playerInfo
      .filter(p => p.bidFailedCount && p.bidFailedCount > 0)
      // 정렬 기준: 1. 유찰 횟수가 낮은 순(오름차순) 2. 유찰 횟수가 같으면 유찰 시간이 오래된 순(오름차순, 먼저 유찰된 사람)
      .sort((a, b) => {
        const countA = a.bidFailedCount || 0;
        const countB = b.bidFailedCount || 0;
        if (countA !== countB) {
          return countA - countB; // 횟수 오름차순 (낮은 순)
        }
        
        // 횟수가 같다면 시간 비교
        const timeA = a.bidFailedAt ? new Date(a.bidFailedAt).getTime() : 0;
        const timeB = b.bidFailedAt ? new Date(b.bidFailedAt).getTime() : 0;
        return timeA - timeB; // 시간 오름차순 (과거 시간일수록 숫자가 작으므로 앞으로 옴)
      })
  })),

  addLogMessage: (message, isSystem = false) => set((state) => ({
    bidLogs: [...state.bidLogs, { message, isSystem, time: new Date().toISOString() }]
  })),

  clearLogs: () => set({ bidLogs: [] })
}));