import axios from 'axios';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/useAuthStore';

// 환경 변수에서 Base URL 가져오기
const baseURL = import.meta.env.VITE_API_BASE_URL;

export const api = axios.create({
  baseURL,
  // HttpOnly 쿠키 등 자격 증명을 포함하여 교차 출처(Cross-Origin) 요청을 보낼 때 필수
  withCredentials: true, 
  headers: {
    'Content-Type': 'application/json',
  },
});

// 향후 요청/응답 인터셉터가 필요하다면 이 아래에 추가합니다.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401 에러 처리 (토큰 만료 / 미인증)
    if (error.response?.status === 401) {
      // 내 정보 조회 등 앱 로딩 시 발생하는 401은 조용히 넘김
      // 하지만 사용자 액션 중 발생한 401은 로그아웃 처리 및 알림
      const originalRequestUrl = error.config?.url;
      if (originalRequestUrl !== '/users/me') {
        toast.error('세션이 만료되었습니다.', {
          description: '다시 로그인해주세요.'
        });
        
        // 전역 상태를 비우고 로그인 페이지로 이동 유도
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    // 서버에서 에러 응답을 보냈을 때 (HTTP 상태 코드가 2xx 범위를 벗어남)
    if (error.response && error.response.data) {
      const errorData = error.response.data;

      // ProblemDetail 형식인지 확인 (type, title, status, detail 등의 속성이 존재하는지)
      if (errorData.title || errorData.detail) {
        // detail이 있으면 detail을, 없으면 title을 표시
        const message = errorData.detail || errorData.title;
        // 커스텀 에러 코드가 있으면 표시 (예: AU0001)
        const errorCode = errorData.errorCode ? `에러 코드: ${errorData.errorCode}` : `HTTP 상태: ${error.response.status}`;
        
        // 401 Unauthorized 제외 (Auth 체크용 등은 조용히 넘어가기 위해)
        if (error.response.status !== 401) {
           toast.error(message, {
             description: errorCode
           });
        }
      } else {
        // ProblemDetail 형식이 아닌 일반 에러일 경우
        toast.error('오류가 발생했습니다.', {
          description: error.message
        });
      }
    } else if (error.request) {
      // 요청이 만들어졌으나 응답을 받지 못한 경우 (네트워크 에러 등)
      toast.error('서버와 통신할 수 없습니다.', {
        description: '네트워크 연결을 확인해주세요.'
      });
    }

    return Promise.reject(error);
  }
);