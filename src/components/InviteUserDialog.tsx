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
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Loader2, Send, UserPlus, Clock, Users, CheckSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CallHistoryUser {
  user_id: string;
  display_name: string;
  last_call_time: string;
  call_count: number;
}

interface OAFollower {
  user_id: string;
  display_name: string;
  picture_url?: string;
  status_message?: string;
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
  const [followers, setFollowers] = useState<OAFollower[]>([]);
  const [loading, setLoading] = useState(false);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);

  // Check admin permission and fetch data when dialog opens
  useEffect(() => {
    if (open && currentUserId) {
      checkAdminPermission();
      fetchCallHistory();
    }
  }, [open, currentUserId]);

  const checkAdminPermission = () => {
    const adminUids = import.meta.env.VITE_ADMIN_UIDS?.split(',').map((id: string) => id.trim()) || [];
    const hasAdminPermission = adminUids.includes(currentUserId);
    setIsAdmin(hasAdminPermission);

    if (hasAdminPermission) {
      fetchFollowers();
    }
  };

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

  const fetchFollowers = async () => {
    setFollowersLoading(true);
    try {
      const response = await fetch(`/api/get-followers?requesterId=${encodeURIComponent(currentUserId)}`);
      const result = await response.json();

      if (result.success) {
        setFollowers(result.data);
      } else {
        console.error('Failed to fetch followers:', result.error);
      }
    } catch (error) {
      console.error('Failed to fetch followers:', error);
    } finally {
      setFollowersLoading(false);
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

  const sendBulkInvites = async () => {
    if (selectedUserIds.size === 0) {
      toast({
        title: '사용자를 선택해주세요',
        description: '초대할 사용자를 선택해주세요.',
        variant: 'destructive',
      });
      return;
    }

    setSending('bulk');
    const allUsers = [...users, ...followers];
    const selectedUsers = allUsers.filter(u => selectedUserIds.has(u.user_id));

    let successCount = 0;
    let failCount = 0;

    for (const user of selectedUsers) {
      try {
        await sendInvite(user.user_id, user.display_name);
        successCount++;
      } catch (error) {
        console.error('Failed to send invite to', user.display_name, error);
        failCount++;
      }
    }

    setSending(null);
    setSelectedUserIds(new Set());

    toast({
      title: '일괄 초대 완료',
      description: `${successCount}명에게 초대를 보냈습니다.${failCount > 0 ? ` (실패: ${failCount}명)` : ''}`,
    });

    if (successCount > 0) {
      onOpenChange(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    const newSelection = new Set(selectedUserIds);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedUserIds(newSelection);
  };

  const toggleSelectAll = (users: Array<CallHistoryUser | OAFollower>) => {
    const userIds = users.map(u => u.user_id);
    const allSelected = userIds.every(id => selectedUserIds.has(id));

    if (allSelected) {
      // Deselect all
      const newSelection = new Set(selectedUserIds);
      userIds.forEach(id => newSelection.delete(id));
      setSelectedUserIds(newSelection);
    } else {
      // Select all
      const newSelection = new Set(selectedUserIds);
      userIds.forEach(id => newSelection.add(id));
      setSelectedUserIds(newSelection);
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

  const renderUserList = (
    users: Array<CallHistoryUser | OAFollower>,
    title: string,
    emptyMessage: string,
    showTimeInfo: boolean = false
  ) => {
    if (users.length === 0) {
      return (
        <div className="text-center py-4 text-muted-foreground text-sm">
          {emptyMessage}
        </div>
      );
    }

    const allSelected = users.every(u => selectedUserIds.has(u.user_id));

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium flex items-center gap-2">
            {title}
            <span className="text-xs text-muted-foreground">({users.length}명)</span>
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleSelectAll(users)}
            className="h-7 text-xs"
          >
            <CheckSquare className="w-3 h-3 mr-1" />
            {allSelected ? '전체 해제' : '전체 선택'}
          </Button>
        </div>
        {users.map((user) => {
          const isCallHistoryUser = 'last_call_time' in user;
          return (
            <div
              key={user.user_id}
              className="flex items-center gap-2 p-3 rounded-lg border hover:bg-accent transition-colors"
            >
              <Checkbox
                checked={selectedUserIds.has(user.user_id)}
                onCheckedChange={() => toggleUserSelection(user.user_id)}
              />
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {user.display_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{user.display_name}</p>
                  {showTimeInfo && isCallHistoryUser && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimeAgo(user.last_call_time)}</span>
                      <span>·</span>
                      <span>{user.call_count}회 통화</span>
                    </div>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => sendInvite(user.user_id, user.display_name)}
                disabled={sending === user.user_id || sending === 'bulk'}
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
          );
        })}
      </div>
    );
  };

  const totalUsers = users.length + followers.length;
  const hasAnyUsers = totalUsers > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            통화 초대
          </DialogTitle>
          <DialogDescription>
            사용자를 선택하여 초대 메시지를 보냅니다. {isAdmin && '(어드민 권한)'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !hasAnyUsers ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>초대할 수 있는 사용자가 없습니다.</p>
            <p className="text-sm mt-2">다른 사용자와 통화한 후 다시 시도해주세요.</p>
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-[450px] pr-4">
              <div className="space-y-4">
                {/* Call History Section */}
                {renderUserList(
                  users,
                  '최근 통화 이력',
                  '통화 이력이 있는 사용자가 없습니다.',
                  true
                )}

                {/* OA Followers Section (Admin Only) */}
                {isAdmin && (
                  <>
                    <Separator className="my-4" />
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Users className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-semibold">OA 팔로워</h3>
                      </div>
                      {followersLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                      ) : (
                        renderUserList(
                          followers,
                          'OA 팔로워 목록',
                          '팔로워가 없습니다.',
                          false
                        )
                      )}
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>

            {/* Bulk Invite Button */}
            {selectedUserIds.size > 0 && (
              <div className="pt-4 border-t">
                <Button
                  onClick={sendBulkInvites}
                  disabled={sending === 'bulk'}
                  className="w-full"
                >
                  {sending === 'bulk' ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  선택한 {selectedUserIds.size}명에게 일괄 초대
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
