import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface Team {
  id: number;
  teamName: string;
}

interface WaitingItem {
  userId: number;
  chzzkName: string;
  imgUrl: string | null;
  position: string;
  tier: string;
  role: string;
}

export function AdminTeamAssignmentDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [waitingItems, setWaitingItems] = useState<WaitingItem[]>([]);
  
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);

  const fetchAssignmentData = async () => {
    setIsLoading(true);
    try {
      const [teamsRes, waitingItemsRes] = await Promise.all([
        api.get<Team[]>('/auction/teams'),
        api.get<WaitingItem[]>('/auction/waiting-items')
      ]);
      setTeams(teamsRes.data);
      setWaitingItems(waitingItemsRes.data);
    } catch (error) {
      console.error('Failed to fetch assignment data', error);
      toast.error('데이터를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setSelectedTeamId('');
      setSelectedUserId('');
      fetchAssignmentData();
    }
  };

  const handleAssign = async () => {
    if (!selectedTeamId || !selectedUserId || selectedTeamId === 'empty-teams' || selectedUserId === 'empty-items') {
      toast.error('팀과 매물을 모두 선택해주세요.');
      return;
    }

    try {
      await api.post('/auction/assign-team', {
        userId: Number(selectedUserId),
        teamId: Number(selectedTeamId),
      });
      toast.success('팀 지정이 완료되었습니다.');
      setIsOpen(false);
    } catch (error) {
      console.error('Assignment failed', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="text-slate-800 border-amber-300 hover:bg-amber-50">
          팀 수동 지정
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>매물 팀 수동 지정</DialogTitle>
          <DialogDescription className="pt-2 text-slate-500 text-xs">
            어드민 직접 지정 시, 팀 내 동일 포지션 보유 불가 제약조건이 적용되지 않습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">대상 매물</label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={isLoading || waitingItems.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? "불러오는 중..." : (waitingItems.length === 0 ? "대기 중인 매물이 없습니다." : "매물을 선택하세요")} />
              </SelectTrigger>
              <SelectContent>
                {waitingItems.map(item => (
                  <SelectItem key={item.userId} value={item.userId.toString()}>
                    {item.chzzkName} [{item.position}] - {item.tier}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">배정할 팀</label>
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId} disabled={isLoading || teams.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? "불러오는 중..." : (teams.length === 0 ? "조회된 팀이 없습니다." : "팀을 선택하세요")} />
              </SelectTrigger>
              <SelectContent>
                {teams.map(team => (
                  <SelectItem key={team.id} value={team.id.toString()}>
                    {team.teamName} 팀
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>취소</Button>
          <Button onClick={handleAssign} disabled={!selectedTeamId || !selectedUserId || selectedTeamId === 'empty-teams' || selectedUserId === 'empty-items' || isLoading}>
            지정하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
