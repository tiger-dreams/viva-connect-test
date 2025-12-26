import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Send, UserPlus, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CallHistoryUser {
  user_id: string;
  display_name: string;
  last_call_time: string;
  call_count: number;
}

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  currentUserName: string;
  roomId: string;
  liffId: string;
}

export const InviteUserDialog = ({
  open,
  onOpenChange,
  currentUserId,
  currentUserName,
  roomId,
  liffId,
}: InviteUserDialogProps) => {
  const { toast } = useToast();
  const [users, setUsers] = useState<CallHistoryUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  // Fetch call history when dialog opens
  useEffect(() => {
    if (open && currentUserId) {
      fetchCallHistory();
    }
  }, [open, currentUserId]);

  const fetchCallHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/call-history?userId=${encodeURIComponent(currentUserId)}&days=30`);
      const result = await response.json();

      if (result.success) {
        // 추가 안전장치: 프론트엔드에서도 현재 사용자 제외
        const filteredUsers = result.data.filter((user: CallHistoryUser) => user.user_id !== currentUserId);
        setUsers(filteredUsers);
      } else {
        toast({
          title: '통화 이력 조회 실패',
          description: result.error || '알 수 없는 오류가 발생했습니다.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to fetch call history:', error);
      toast({
        title: '통화 이력 조회 실패',
        description: '네트워크 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const sendInvite = async (toUserId: string, toUserName: string) => {
    setSending(toUserId);
    try {
      const response = await fetch('/api/send-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toUserId,
          fromUserName: currentUserName,
          roomId,
          liffId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: '초대 전송 완료',
          description: `${toUserName}님에게 초대 메시지를 보냈습니다.`,
        });
        onOpenChange(false);
      } else {
        toast({
          title: '초대 전송 실패',
          description: result.error || '알 수 없는 오류가 발생했습니다.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to send invite:', error);
      toast({
        title: '초대 전송 실패',
        description: '네트워크 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setSending(null);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins}분 전`;
    } else if (diffHours < 24) {
      return `${diffHours}시간 전`;
    } else {
      return `${diffDays}일 전`;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            통화 초대
          </DialogTitle>
          <DialogDescription>
            함께 통화한 이력이 있는 사용자에게 초대 메시지를 보냅니다.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>통화 이력이 있는 사용자가 없습니다.</p>
            <p className="text-sm mt-2">다른 사용자와 통화한 후 다시 시도해주세요.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.user_id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {user.display_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{user.display_name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{formatTimeAgo(user.last_call_time)}</span>
                        <span>·</span>
                        <span>{user.call_count}회 통화</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => sendInvite(user.user_id, user.display_name)}
                    disabled={sending === user.user_id}
                  >
                    {sending === user.user_id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-1" />
                        초대
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};
