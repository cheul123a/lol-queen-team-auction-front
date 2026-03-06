import { create } from 'zustand';
import { api } from '@/lib/api';

// 서버에서 넘겨주는 User 정보의 타입
export interface User {
  userId: number;
  chzzkName: string;
  role: 'ADMIN' | 'QUEEN' | 'PRINCESS' | 'LEADER' | 'PLAYER';
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // 상태 변경 함수들
  setUser: (user: User | null) => void;
  checkAuth: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true, // 초기 로딩 상태

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  
  checkAuth: async () => {
    try {
      set({ isLoading: true });
      // 쿠키를 포함하여 내 정보 조회 API 호출
      const response = await api.get<User>('/users/me'); 
      const userData = response.data;
      
      set({ user: userData, isAuthenticated: true, isLoading: false });
    } catch {
      // 401 Unauthorized 등이 발생하면 로그인되지 않은 것으로 간주
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  logout: () => {
    // 향후 서버 연동 로그아웃 API가 추가되면 여기에 구현합니다.
    set({ user: null, isAuthenticated: false });
  }
}));
