import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useSocketStore } from "@/store/useSocketStore";
import { useAuctionStore } from "@/store/useAuctionStore";
import { useAuctionTimer } from "@/hooks/useAuctionTimer";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { AdminTeamAssignmentDialog } from "@/components/AdminTeamAssignmentDialog";

// 영문 포지션을 한글로 변환하는 헬퍼 함수
const translatePosition = (position: string) => {
  switch (position) {
    case 'JUNGLE': return '정글';
    case 'MIDDLE': return '미드';
    case 'TOP': return '탑';
    case 'BOT': return '원딜';
    case 'SUPPORT': return '서폿';
    default: return position;
  }
};

// 팀원(팀장+플레이어) 정보를 렌더링하는 헬퍼 컴포넌트 (매 초 렌더링 방지를 위해 Home 밖으로 분리)
const TeamMemberRow = ({ name, position, tier, isCaptain = false, imgUrl }: { name: string, position: string, tier: string, isCaptain?: boolean, imgUrl: string | null }) => (
  <div className="flex items-center gap-2 p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
    <Avatar className={`w-8 h-8 ${isCaptain ? 'border-2 border-amber-400' : 'border border-slate-200 dark:border-slate-700'}`}>
      <AvatarImage src={imgUrl || "/default.png"} className="object-cover" />
      <AvatarFallback className="text-[10px] bg-slate-100 text-slate-500">{name.substring(0,2)}</AvatarFallback>
    </Avatar>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5">
        {isCaptain && <span className="text-[10px] bg-amber-100 text-amber-800 px-1 rounded font-bold">팀장</span>}
        <span className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate">{name}</span>
      </div>
      <div className="flex gap-1 mt-0.5">
        <span className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-1 rounded">{translatePosition(position)}</span>
        <span className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-1 rounded truncate">{tier}</span>
      </div>
    </div>
  </div>
);

export default function Home() {
  const { user, logout } = useAuthStore();
  const { connect, disconnect } = useSocketStore();
  // 스토어에서 상태와 타겟, 팀/대기열 정보 가져오기
  const { currentTarget, status, highestBid, highestBidder, bidLogs, teams, waitingPlayers, unbidPlayers, bidRemainSeconds, auctionType } = useAuctionStore();
  
  // 타이머 훅 초기화 (기본 15초)
  const { timeLeft, formattedTime, startOrReset, stop: stopTimer } = useAuctionTimer(15);
  
  // 직접 입력 입찰가 상태
  const [customBid, setCustomBid] = useState<string>("");

  // 새 매물이 준비되거나(타겟 변경) 상태가 바뀔 때 입력창 초기화
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCustomBid("");
  }, [currentTarget?.targetName]);

  // 경매 상태가 IN_PROGRESS로 바뀌거나 입찰/새로고침으로 bidRemainSeconds가 갱신될 때 타이머 동작
  useEffect(() => {
    if (status === 'IN_PROGRESS') {
      // 서버에서 보내준 남은 초를 전적으로 신뢰하여 타이머 세팅 (기기 시간 완전 배제)
      // 새로운 입찰(highestBid 갱신)이 발생하면 같은 15초라도 useEffect가 재실행되어 타이머 리셋됨
      const secondsToRun = typeof bidRemainSeconds === 'number' ? bidRemainSeconds : 15;
      startOrReset(secondsToRun);
    } else if (status === 'CLOSED' || status === 'WAITING') {
      stopTimer();
    }
  }, [status, bidRemainSeconds, highestBid, startOrReset, stopTimer]);

  // 앱 진입 시 소켓 연결, 언마운트 시 해제
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // 권한별 제어를 위한 변수
  const isAdmin = user?.role === "ADMIN";
  const canBid = user?.role === "QUEEN" || user?.role === "LEADER" || user?.role === "ADMIN";
  // 경매가 진행중일때만 입찰 버튼 활성화
  const isBiddingActive = canBid && status === 'IN_PROGRESS';

  // 관리자 전용 기능: 다음 입찰 준비 API 호출
  const handlePrepareBidding = async () => {
    try {
      await api.post('/auction/prepare-bidding');
      toast.success('다음 매물이 준비되었습니다.');
    } catch (error) {
      console.error('❌ 다음 입찰 준비 완료 요청 실패:', error);
    }
  };

  // 관리자 전용 기능: 경매 시작 API 호출
  const handleStartBidding = async () => {
    try {
      await api.post('/auction/start-bidding');
      toast.success('경매가 시작되었습니다!');
    } catch (error) {
      console.error('❌ 경매 시작 요청 실패:', error);
    }
  };

  // 관리자 전용 기능: 플레이어 경매로 전환 API 호출
  const handleChangeToPlayerAuction = async () => {
    try {
      await api.post('/auction/change-to-player-auction');
      toast.success('플레이어 경매로 전환되었습니다!');
    } catch (error) {
      console.error('❌ 플레이어 경매 전환 요청 실패:', error);
    }
  };

  // 입찰 API 호출
  const handleBid = async (amount: number) => {
    try {
      await api.post('/auction/bid', { bidPoint: amount });
      // 성공 후에는 굳이 입력창을 비우지 않거나, 상황에 따라 비울 수 있습니다.
      // 여기서는 다음 입찰을 위해 일단 유지하거나 비우는 것을 선택할 수 있는데, 
      // 깔끔함을 위해 비웁니다.
      setCustomBid("");
    } catch (error) {
      console.error('❌ 입찰 요청 실패:', error);
    }
  };

  // 금액 추가 버튼 클릭 핸들러
  const handleAddAmount = (addValue: number) => {
    // 입력칸이 비어있으면 현재 최고가 + 버튼금액
    // 입력칸에 숫자가 있으면 그 숫자 + 버튼금액
    setCustomBid((prev) => {
      const currentVal = prev === "" ? highestBid : Number(prev);
      return String(currentVal + addValue);
    });
  };

  return (
    <div className="flex min-h-[900px] w-full bg-slate-50 dark:bg-slate-950 p-4 gap-4">
      
      {/* 1. 왼쪽 사이드바 (팀 상태 영역) */}
      <Card className="w-80 flex flex-col border-emerald-200 shadow-sm bg-white dark:bg-slate-900 shrink-0 h-[calc(100vh-2rem)] sticky top-4">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-bold text-emerald-800 dark:text-emerald-400">참가 팀 현황</CardTitle>
          <Button variant="ghost" size="sm" onClick={logout} className="text-xs text-slate-400">
            로그아웃
          </Button>
        </CardHeader>
        <ScrollArea className="flex-1 p-3">
          <div className="space-y-4">
            {teams.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">
                현재 구성된 팀이 없습니다.
              </div>
            ) : (
              teams.map((team, idx) => {
                // 팀에서 역할별로 멤버 분리
                const queenOrPrincess = team.members.find(m => m.role === 'QUEEN' || m.role === 'PRINCESS');
                const leader = team.members.find(m => m.role === 'LEADER');
                const regularMembers = team.members.filter(m => m.role === 'PLAYER');
                
                // 리더의 이름이 있으면 팀 이름으로 사용, 없으면 N팀
                const teamName = queenOrPrincess ? queenOrPrincess.chzzkName : `${idx + 1}`;

                return (
                  <div key={idx} className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{queenOrPrincess?.role === 'QUEEN' ? '👑' : '👸'}</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">{teamName} 팀</span>
                      </div>
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 font-bold">
                        {team.point} pt
                      </Badge>
                    </div>
                    
                    <Separator className="bg-slate-100 dark:bg-slate-800" />
                    
                    <div className="space-y-1">
                      {/* 여왕/공주 렌더링 */}
                      {queenOrPrincess && (
                        <TeamMemberRow 
                          name={queenOrPrincess.chzzkName} 
                          position={queenOrPrincess.position} 
                          tier={queenOrPrincess.tier}
                          imgUrl={queenOrPrincess.imgUrl}
                          isCaptain={false} 
                        />
                      )}

                      {/* 팀장 렌더링 */}
                      {leader ? (
                        <TeamMemberRow 
                          name={leader.chzzkName} 
                          position={leader.position} 
                          tier={leader.tier}
                          imgUrl={leader.imgUrl}
                          isCaptain 
                        />
                      ) : (
                        <div className="text-xs text-slate-400 italic p-1.5 text-center bg-slate-50 dark:bg-slate-800/50 rounded-md border border-dashed border-slate-200 dark:border-slate-700 mt-1">
                          팀장 미정
                        </div>
                      )}
                      
                      {/* 일반 팀원 렌더링 */}
                      {regularMembers.map((player, pIdx) => (
                        <TeamMemberRow 
                          key={`player-${pIdx}`} 
                          name={player.chzzkName} 
                          position={player.position} 
                          tier={player.tier}
                          imgUrl={player.imgUrl}
                        />
                      ))}
                      
                      {/* 빈 슬롯 표시 */}
                      {(!leader && regularMembers.length === 0) && (
                        <div className="text-xs text-slate-400 italic p-1.5 text-center border-t border-dashed border-slate-100 dark:border-slate-800 mt-2 pt-2">
                          아직 낙찰된 선수가 없습니다.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* 메인 콘텐츠 영역 (중앙 상/하단) */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        
        {/* 상단 관리자 전용 컨트롤 패널 (ADMIN일 때만 보임) */}
        {isAdmin && (
          <div className="bg-slate-800 text-slate-200 p-3 rounded-lg flex items-center justify-between shadow-sm border border-slate-700">
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-400">🛡️ 관리자 패널</span>
              <span className="text-sm text-slate-400">경매 진행을 제어합니다.</span>
            </div>
            <div className="flex gap-2">
              <AdminTeamAssignmentDialog />
              {auctionType === 'LEADER_AUCTION' && (
                <Button onClick={handleChangeToPlayerAuction} variant="destructive" className="font-bold">
                  플레이어 경매로 전환
                </Button>
              )}
              <Button onClick={handlePrepareBidding} variant="outline" className="text-slate-800">
                다음 매물 준비
              </Button>
              <Button onClick={handleStartBidding} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                경매 시작하기
              </Button>
            </div>
          </div>
        )}

        {/* 상단 (현재 경매 영역) */}
        <div className="flex-1 flex gap-4 min-h-[400px]">
          
          {/* 2-1. 현재 입찰 대상 프로필 */}
          <Card className="w-1/3 flex flex-col items-center justify-center p-4 border-emerald-300 border-2 bg-emerald-50/50 dark:bg-slate-900 shadow-md relative overflow-hidden">
            {/* 장식용 코너 스타일 (스케치 반영) */}
            <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-emerald-500 rounded-tl-xl m-2 opacity-50"></div>
            <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-emerald-500 rounded-tr-xl m-2 opacity-50"></div>
            
            <Badge className={`absolute top-4 text-sm px-3 py-1 mb-2 shadow-sm ${status === 'IN_PROGRESS' ? 'bg-emerald-600 hover:bg-emerald-700 animate-pulse' : 'bg-slate-500 hover:bg-slate-600'}`}>
              {status === 'WAITING' ? '대기 중' : status === 'PREPARED' ? '입찰 대기' : status === 'CLOSED' ? '종료됨' : '경매 진행중'}
            </Badge>

            {currentTarget ? (
              <>
                <Avatar className="w-36 h-36 border-4 border-white shadow-xl mt-6 mb-4">
                  <AvatarImage src={currentTarget.targetImgUrl || "/default.png"} className="object-cover" />
                  <AvatarFallback className="text-3xl bg-slate-100 text-slate-500">?</AvatarFallback>
                </Avatar>
                
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">
                  {currentTarget.targetName}
                </h2>
                <div className="flex gap-2 mb-4">
                  <Badge variant="outline" className="text-base py-0.5 px-2 border-emerald-200 bg-white dark:bg-slate-800">
                    {translatePosition(currentTarget.targetPosition)}
                  </Badge>
                  <Badge variant="outline" className="text-base py-0.5 px-2 border-emerald-200 bg-white dark:bg-slate-800">{currentTarget.targetTier}</Badge>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400 py-8">
                <span className="text-5xl mb-3">👻</span>
                <p className="text-base font-medium">아직 대기중인 매물이 없습니다.</p>
              </div>
            )}

            <div className="w-full bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center shadow-inner mt-auto">
              <p className="text-xs text-slate-500 mb-1">현재 최고 입찰</p>
              <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                {highestBid} <span className="text-base font-bold text-slate-400">pt</span>
              </div>
              <p className="text-base font-extrabold text-slate-800 dark:text-slate-200 mt-1.5 h-6 flex items-center justify-center">
                {highestBidder ? `👑 입찰자: ${highestBidder}` : '-'}
              </p>
            </div>
          </Card>

          {/* 2-2. 경매 진행 보드 (로그 & 입찰 버튼) */}
          <Card className="flex-1 flex flex-col shadow-md border-slate-200 dark:border-slate-800">
            <CardHeader className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 py-2">
              <CardTitle className="text-base flex justify-between items-center">
                <span>실시간 입찰 보드</span>
                {status === 'IN_PROGRESS' && <Badge variant="destructive" className="animate-pulse text-xs">진행중</Badge>}
              </CardTitle>
            </CardHeader>
            
            {/* 입찰 로그 */}
            <ScrollArea className="flex-1 p-3 bg-white dark:bg-slate-950">
              <div className="space-y-2">
                {status === 'WAITING' && <div className="text-xs text-slate-500 text-center py-6">경매 대기 중입니다.</div>}
                {status === 'PREPARED' && <div className="text-xs text-emerald-600 font-bold text-center py-6">다음 매물이 준비되었습니다! 경매 시작을 기다려주세요.</div>}
                
                {bidLogs.map((log, idx) => (
                  <div key={idx} className={`p-2 rounded-lg border text-sm leading-tight ${log.isSystem ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 text-amber-800 dark:text-amber-300 font-semibold text-center' : 'bg-slate-50 dark:bg-slate-900 border-slate-100'}`}>
                    {log.message.split('\n').map((line: string, i: number) => (
                      <span key={i} className="block">
                        {line}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* 입찰 컨트롤 */}
            <div className="p-3 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
              {isBiddingActive ? (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Button onClick={() => handleAddAmount(5)} variant="outline" className="flex-1 h-10 text-sm font-bold border-emerald-500 text-emerald-700 hover:bg-emerald-50">+ 5</Button>
                    <Button onClick={() => handleAddAmount(10)} variant="outline" className="flex-1 h-10 text-sm font-bold border-emerald-500 text-emerald-700 hover:bg-emerald-50">+ 10</Button>
                    <Button onClick={() => handleAddAmount(50)} variant="outline" className="flex-1 h-10 text-sm font-bold border-emerald-500 text-emerald-700 hover:bg-emerald-50">+ 50</Button>
                    <Button onClick={() => handleAddAmount(100)} variant="outline" className="flex-1 h-10 text-sm font-bold border-emerald-500 text-emerald-700 hover:bg-emerald-50">+ 100</Button>
                  </div>
                  <div className="flex gap-2">
                    <Input 
                      type="number" 
                      placeholder={`현재가(${highestBid}pt)보다 높게 입력`}
                      value={customBid}
                      onChange={(e) => setCustomBid(e.target.value)}
                      className="h-10 border-slate-300 dark:border-slate-700 font-bold text-lg text-emerald-700"
                    />
                    <Button 
                      onClick={() => {
                        const amount = Number(customBid);
                        if (!customBid) {
                           toast.error('입찰할 금액을 입력해주세요.');
                           return;
                        }
                        if (amount > highestBid) handleBid(amount);
                        else toast.error('현재 최고 입찰가보다 큰 금액을 입력해주세요.');
                      }} 
                      className="h-10 w-24 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
                    >
                      입찰
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="h-12 flex items-center justify-center text-slate-500 text-sm font-medium bg-slate-200 dark:bg-slate-800 rounded-md">
                  {canBid ? "현재 입찰 가능한 상태가 아닙니다" : "관전 모드 (입찰 권한이 없습니다)"}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* 3. 하단 (대기열 및 타이머 영역) */}
        <div className="h-80 flex gap-4 shrink-0">
          
          {/* 3-1. 대기칸 (세로 스크롤) */}
          <Card className="flex-1 flex flex-col border-emerald-200 shadow-sm bg-emerald-50/30 dark:bg-slate-900 overflow-hidden min-h-0">
            <div className="px-4 py-2 bg-emerald-100/50 dark:bg-emerald-900/20 border-b border-emerald-100 dark:border-emerald-800/30 font-bold text-emerald-800 dark:text-emerald-400 text-sm shrink-0">
              대기 중인 매물 ({waitingPlayers.length}명)
            </div>
            {/* Flexbox 제약조건을 완벽히 지키는 순수 CSS 세로 스크롤 */}
            <div className="flex-1 overflow-y-auto min-h-0 p-4">
              <div className={auctionType === 'PLAYER_AUCTION' || auctionType === 'FINISHED' ? "flex w-full justify-between gap-4 pb-2" : "flex flex-wrap gap-4 pb-2"}>
                {auctionType === 'PLAYER_AUCTION' || auctionType === 'FINISHED' ? (
                  // 플레이어 경매: 포지션별 세로 정렬 및 유찰자 컬럼 추가 (waitingPlayers가 0이어도 유찰자가 있을 수 있으므로 무조건 렌더링)
                  <>
                    {['TOP', 'JUNGLE', 'MIDDLE', 'BOT', 'SUPPORT'].map(pos => {
                      const playersInPos = waitingPlayers.filter(p => p.position === pos);
                      return (
                        <div key={pos} className="flex-1 flex flex-col gap-3 items-center min-w-0">
                          <div className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">{translatePosition(pos)}</div>
                          {playersInPos.length > 0 ? playersInPos.map((waiter, idx) => (
                            <div key={idx} className="w-full max-w-[140px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex flex-col items-center justify-center shadow-sm hover:shadow-md transition-shadow">
                              <Avatar className="w-12 h-12 mb-2 border border-slate-100">
                                <AvatarImage src={waiter.imgUrl || "/default.png"} className="object-cover" />
                                <AvatarFallback className="bg-slate-100 text-[10px] text-slate-500">대기</AvatarFallback>
                              </Avatar>
                              <div className="text-sm font-bold text-slate-800 dark:text-slate-200 w-full text-center truncate">{waiter.chzzkName}</div>
                              <div className="flex gap-1 mt-1 justify-center w-full">
                                <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">{translatePosition(waiter.position)}</span>
                                <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded truncate max-w-[50px]">{waiter.tier}</span>
                              </div>
                            </div>
                          )) : (
                            <div className="text-[10px] text-slate-400 italic py-2">없음</div>
                          )}
                        </div>
                      );
                    })}

                    {/* 유찰자 컬럼 (오른쪽 끝) */}
                    <div className="w-px bg-slate-200 dark:bg-slate-700 mx-1 shrink-0 hidden md:block"></div>
                    <div className="flex-1 flex flex-col gap-3 items-center min-w-0 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl px-2 pb-2">
                      <div className="text-xs font-bold text-white bg-slate-500 dark:bg-slate-600 px-3 py-1 rounded-full mt-1">유찰</div>
                      {unbidPlayers.length > 0 ? unbidPlayers.map((waiter, idx) => (
                        <div key={`unbid-${idx}`} className="w-full max-w-[140px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex flex-col items-center justify-center shadow-sm hover:shadow-md transition-shadow">
                          <Avatar className="w-12 h-12 mb-2 border border-slate-100">
                            <AvatarImage src={waiter.imgUrl || "/default.png"} className="object-cover" />
                            <AvatarFallback className="bg-slate-100 text-[10px] text-slate-500">유찰</AvatarFallback>
                          </Avatar>
                          <div className="text-sm font-bold text-slate-800 dark:text-slate-300 w-full text-center truncate">{waiter.chzzkName}</div>
                          <div className="flex gap-1 mt-1 justify-center w-full">
                            <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">{translatePosition(waiter.position)}</span>
                            <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded truncate max-w-[50px]">{waiter.tier}</span>
                          </div>
                        </div>
                      )) : (
                        <div className="text-[10px] text-slate-400 italic py-2">없음</div>
                      )}
                    </div>
                  </>
                ) : (
                  // 팀장 경매: 기존 가로 나열(그리드)
                  waitingPlayers.length === 0 ? (
                    <div className="text-slate-400 text-sm italic py-4 w-full text-center">대기 중인 매물이 없습니다.</div>
                  ) : (
                    waitingPlayers.map((waiter, idx) => (
                      <div key={idx} className="w-32 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex flex-col items-center justify-center shadow-sm hover:shadow-md transition-shadow shrink-0">
                        <Avatar className="w-14 h-14 mb-2 border border-slate-100">
                          <AvatarImage src={waiter.imgUrl || "/default.png"} className="object-cover" />
                          <AvatarFallback className="bg-slate-100 text-xs text-slate-500">대기</AvatarFallback>
                        </Avatar>
                        <div className="text-sm font-bold text-slate-800 dark:text-slate-200 w-full text-center truncate">{waiter.chzzkName}</div>
                        <div className="flex gap-1 mt-1 justify-center w-full">
                          <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">{translatePosition(waiter.position)}</span>
                          <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded truncate max-w-[50px]">{waiter.tier}</span>
                        </div>
                      </div>
                    ))
                  )
                )}
              </div>
            </div>
          </Card>

          {/* 3-2. 타이머 영역 */}
          <Card className="w-72 border-2 border-emerald-400 shadow-md bg-white dark:bg-slate-900 flex flex-col items-center justify-center relative overflow-hidden group">
             {/* 타이머 진행바 (배경 애니메이션 효과용) */}
            <div 
              className="absolute bottom-0 left-0 h-1 bg-emerald-500 transition-all duration-100" 
              style={{ width: status === 'IN_PROGRESS' && timeLeft > 0 ? `${(timeLeft / 15) * 100}%` : '0%' }}
            ></div>
            
            <p className="text-slate-500 dark:text-slate-400 font-medium mb-1 tracking-widest">남은 시간</p>
            <div className={`text-6xl font-black tabular-nums tracking-tighter flex items-center gap-2 ${timeLeft <= 3 && status === 'IN_PROGRESS' ? 'text-red-500 animate-pulse' : 'text-slate-900 dark:text-white'}`}>
              {status === 'IN_PROGRESS' ? (
                <>
                  {formattedTime.m}<span className={`${timeLeft > 0 ? 'text-emerald-500 animate-pulse' : 'text-slate-300'}`}>:</span>{formattedTime.s}
                </>
              ) : (
                <>00<span className="text-slate-300">:</span>00</>
              )}
            </div>
            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-bold mt-2 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 rounded-full">
              {status === 'IN_PROGRESS' ? '입찰이 진행 중입니다' : status === 'CLOSED' ? '종료됨' : '대기 중'}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}