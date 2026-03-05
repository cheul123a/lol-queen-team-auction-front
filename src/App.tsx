import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Home from "./pages/Home";
import { useAuthStore } from "./store/useAuthStore";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

function App() {
  const { checkAuth, isLoading, isAuthenticated } = useAuthStore();

  useEffect(() => {
    // 앱이 처음 렌더링될 때 서버에 로그인 상태(쿠키) 확인 요청
    checkAuth();
  }, [checkAuth]);

  // 로딩 중일 때는 로딩 화면 표시 (이 동안 API 응답을 기다림)
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-slate-500 font-medium animate-pulse">인증 정보를 확인하는 중입니다...</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          {/* 인증이 필요한 메인 페이지. 비로그인 상태면 /login 으로 쫓겨남 */}
          <Route 
            path="/" 
            element={isAuthenticated ? <Home /> : <Navigate to="/login" replace />} 
          />
          {/* 로그인 페이지. 이미 로그인된 상태라면 / (메인) 으로 이동 */}
          <Route 
            path="/login" 
            element={!isAuthenticated ? <Login /> : <Navigate to="/" replace />} 
          />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" richColors />
    </TooltipProvider>
  );
}

export default App;