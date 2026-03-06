import { create } from 'zustand';
import { Client } from '@stomp/stompjs';
import type { IMessage } from '@stomp/stompjs';
import { useAuctionStore } from './useAuctionStore';
import confetti from 'canvas-confetti';

interface SocketState {
  client: Client | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  sendMessage: (destination: string, body: Record<string, unknown> | string) => void;
}

const getWebSocketUrl = () => {
  // 운영 환경(.env.production)에서 명시적 WS URL이 주어지면 그것을 사용 (예: wss://api.es-auction.com/ws)
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  
  // 로컬 개발 환경(Vite Proxy)일 때는 기존처럼 현재 브라우저 호스트를 사용
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/ws`;
};

export const useSocketStore = create<SocketState>((set, get) => ({
  client: null,
  isConnected: false,

  connect: () => {
    if (get().client && get().isConnected) return;

    const client = new Client({
      brokerURL: getWebSocketUrl(),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      
      onConnect: () => {
        set({ isConnected: true });

        // 공통 메시지 핸들러 함수
        const handleMessage = (message: IMessage) => {
          try {
            const data = JSON.parse(message.body);

            // 이벤트 타입에 따른 전역 상태 업데이트
            const type = data.messageType || data.type; 
            const payload = data.data || data.payload;

            switch (type) {
              case 'JUST_MESSAGE': {
                // 단순 사용자 표시용 메시지 (payload 자체가 문자열일 수도 있고 객체일 수도 있음)
                const msg = typeof payload === 'string' ? payload : payload?.message;
                if (msg) {
                  useAuctionStore.getState().addLogMessage(msg, false);
                }
                break;
              }
              case 'PREPARE_BIDDING': {
                // 입찰 시작 전 대기(카운트다운) 이벤트
                useAuctionStore.getState().setAuctionStatus('COUNTDOWN', 5); // 5초 대기
                const msg = typeof payload === 'string' ? payload : payload?.message;
                if (msg) {
                  useAuctionStore.getState().addLogMessage(msg, true);
                }
                break;
              }
              case 'BIDDING_STARTED': {
                // 입찰 시작 이벤트
                useAuctionStore.getState().setAuctionStatus('IN_PROGRESS', payload?.bidRemainSeconds);
                useAuctionStore.getState().clearLogs(); // 이전 매물의 로그 클리어
                const msg = typeof payload === 'string' ? payload : payload?.message;
                if (msg) {
                  useAuctionStore.getState().addLogMessage(msg, true);
                }
                break;
              }
              case 'BIDDING_END': {
                // 입찰 종료 이벤트
                useAuctionStore.getState().clearBiddingInfo();
                const msg = typeof payload === 'string' ? payload : payload?.message;
                if (msg) {
                  useAuctionStore.getState().addLogMessage(msg, true);
                  // 메시지에 '낙찰'이 포함되어 있으면 폭죽 효과 실행
                  if (msg.includes('낙찰')) {
                    confetti({
                      particleCount: 150,
                      spread: 80,
                      origin: { y: 0.6 },
                      colors: ['#10b981', '#fbbf24', '#f59e0b', '#3b82f6'],
                      zIndex: 9999,
                    });
                  }
                }
                break;
              }
              case 'BIDDING_INFO':
                // 입찰 대상/현재 입찰가 등 데이터 동기화
                // 이 이벤트가 PREPARE_AUCTION 및 BID 업데이트 역할을 모두 수행
                useAuctionStore.getState().updateBiddingInfo(payload);
                break;
              case 'PLAYER_INFOS':
                // 전체 팀 현황 및 대기열 데이터 동기화
                useAuctionStore.getState().updatePlayersInfo(payload);
                break;
              case 'AUCTION_TYPE': {
                // 경매 타입(팀장 경매, 플레이어 경매 등) 업데이트
                const auctionType = typeof payload === 'string' ? payload : payload?.type || payload?.auctionType;
                if (auctionType === 'LEADER_AUCTION' || auctionType === 'PLAYER_AUCTION' || auctionType === 'FINISHED') {
                   useAuctionStore.getState().setAuctionType(auctionType);
                }
                break;
              }
              default:
                console.warn('알 수 없는 소켓 이벤트 타입:', type);
            }
          } catch (e) {
            console.error('소켓 메시지 파싱 에러:', e);
          }
        };

        // 1. 글로벌 채널 구독 (전체 사용자 공통 이벤트)
        client.subscribe('/sub/auction', handleMessage);

        // 2. 개인용 채널 구독 (내게만 오는 이벤트, 예: "포인트가 부족합니다")
        client.subscribe('/user/sub/auction', handleMessage);
      },
      onDisconnect: () => {
        set({ isConnected: false });
      },
      onStompError: (frame) => {
        console.error('⚠️ STOMP: 브로커 에러 발생:', frame.headers['message']);
      },
      onWebSocketError: (event) => {
        console.error('⚠️ STOMP: 웹소켓 통신 에러 발생:', event);
      },
    });

    client.activate();
    set({ client });
  },

  disconnect: () => {
    const { client } = get();
    if (client) {
      client.deactivate();
      set({ client: null, isConnected: false });
    }
  },

  sendMessage: (destination: string, body: Record<string, unknown> | string) => {
    const { client, isConnected } = get();
    if (client && isConnected) {
      client.publish({
        destination: `/pub${destination}`,
        body: JSON.stringify(body),
      });
    } else {
      console.warn('웹소켓이 연결되어 있지 않아 메시지를 전송할 수 없습니다.');
    }
  },
}));
