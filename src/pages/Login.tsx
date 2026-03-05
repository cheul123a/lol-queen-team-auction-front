import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Login() {
  const handleChzzkLogin = () => {
    // CSRF 방지를 위한 상태값 생성 (UUID 사용)
    const state = uuidv4();
    
    // 환경 변수 가져오기
    const clientId = import.meta.env.VITE_CHZZK_CLIENT_ID;
    const redirectUri = import.meta.env.VITE_CHZZK_REDIRECT_URI;
    
    // 치지직 로그인 URL 생성
    const chzzkLoginUrl = `https://chzzk.naver.com/account-interlock?clientId=${clientId}&redirectUri=${redirectUri}&state=${state}`;
    
    // 치지직 로그인 페이지로 리다이렉트
    window.location.href = chzzkLoginUrl;
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 px-4">
      <Card className="w-full max-w-md shadow-lg border-slate-200 dark:border-slate-800">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4 shadow-sm">
            {/* 치지직 로고 혹은 게임 관련 아이콘 대체용 (임시) */}
            <span className="text-white font-bold text-2xl">L</span>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            롤 팀 경매장
          </CardTitle>
          <CardDescription className="text-slate-500 dark:text-slate-400">
            치지직 계정으로 간편하게 로그인하고<br />
            경매에 참여해보세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 pb-8 px-8">
          <Button 
            onClick={handleChzzkLogin}
            className="w-full h-12 text-base font-semibold transition-all hover:-translate-y-0.5"
            style={{ backgroundColor: "#00FFA3", color: "#000" }} // 치지직 고유 컬러 적용
          >
            치지직으로 시작하기
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}