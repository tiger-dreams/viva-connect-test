import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Users, Activity, Lock, LogIn, ExternalLink, Clock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLiff } from '@/contexts/LiffContext';
import { useNavigate } from 'react-router-dom';

// 환경 변수에서 허용된 관리자 UID 목록 로드 (쉼표로 구분)
const ALLOWED_ADMIN_UIDS = import.meta.env.VITE_ADMIN_UIDS
  ? import.meta.env.VITE_ADMIN_UIDS.split(',').map((uid: string) => uid.trim())
  : [];

interface Participant {
  user_id: string;
  display_name: string | null;
  joined_at: string;
}

interface ActiveRoom {
  room_id: string;
  participant_count: number;
  participants: Participant[];
  last_activity: string;
  call_start_time: string | null;
}

const AdminRooms = () => {
  const { language } = useLanguage();
  const { isLoggedIn, profile, login } = useLiff();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<ActiveRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    document.title = language === 'ko' ? '활성 룸 모니터링' : 'Active Rooms Monitor';
  }, [language]);

  const fetchActiveRooms = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin?action=active-rooms&minutes=60');
      const result = await response.json();

      if (result.success) {
        setRooms(result.data);
        setLastUpdate(result.timestamp);
      }
    } catch (error) {
      console.error('Failed to fetch active rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveRooms();
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchActiveRooms();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString(language === 'ko' ? 'ko-KR' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) {
      return language === 'ko' ? '방금 전' : 'Just now';
    } else if (diffMins < 60) {
      return language === 'ko' ? `${diffMins}분 전` : `${diffMins}m ago`;
    } else {
      const diffHours = Math.floor(diffMins / 60);
      return language === 'ko' ? `${diffHours}시간 전` : `${diffHours}h ago`;
    }
  };

  const viewRoomLogs = (roomId: string) => {
    // Navigate to logs page with room filter pre-applied
    navigate(`/admin/logs?roomId=${encodeURIComponent(roomId)}`);
  };

  // 접근 권한 확인
  const isAdmin = isLoggedIn && profile && ALLOWED_ADMIN_UIDS.includes(profile.userId);

  // 로그인되지 않은 경우
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center justify-center mb-4">
              <LogIn className="w-12 h-12 text-primary" />
            </div>
            <CardTitle className="text-center text-2xl">
              {language === 'ko' ? '로그인 필요' : 'Login Required'}
            </CardTitle>
            <CardDescription className="text-center">
              {language === 'ko'
                ? '관리자 페이지에 접근하려면 LINE 로그인이 필요합니다.'
                : 'LINE login is required to access the admin page.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={login} size="lg">
              <LogIn className="w-5 h-5 mr-2" />
              {language === 'ko' ? 'LINE 로그인' : 'Login with LINE'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 권한이 없는 경우
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center justify-center mb-4">
              <Lock className="w-12 h-12 text-destructive" />
            </div>
            <CardTitle className="text-center text-2xl">
              {language === 'ko' ? '접근 권한 없음' : 'Access Denied'}
            </CardTitle>
            <CardDescription className="text-center">
              {language === 'ko'
                ? '이 페이지에 접근할 권한이 없습니다. 관리자 권한이 필요합니다.'
                : 'You do not have permission to access this page. Administrator privileges are required.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground text-center">
                {language === 'ko' ? '현재 사용자' : 'Current User'}
              </p>
              <p className="text-sm font-mono text-center mt-1">
                {profile?.displayName || 'Unknown'}
              </p>
              <p className="text-xs text-muted-foreground text-center mt-1">
                ID: {profile?.userId}
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.location.href = '/'}
            >
              {language === 'ko' ? '홈으로 돌아가기' : 'Back to Home'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 관리자 권한이 있는 경우 - 활성 룸 모니터링 페이지 표시
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              {language === 'ko' ? '활성 룸 모니터링' : 'Active Rooms Monitor'}
            </h1>
            <p className="text-muted-foreground">
              {language === 'ko'
                ? `활성 룸 ${rooms.length}개 · 마지막 업데이트: ${lastUpdate ? formatDate(lastUpdate) : '-'}`
                : `${rooms.length} active rooms · Last update: ${lastUpdate ? formatDate(lastUpdate) : '-'}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={autoRefresh ? 'default' : 'outline'}
              onClick={() => setAutoRefresh(!autoRefresh)}
              size="sm"
            >
              <Activity className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-pulse' : ''}`} />
              {language === 'ko' ? (autoRefresh ? '자동 새로고침' : '수동 모드') : (autoRefresh ? 'Auto Refresh' : 'Manual Mode')}
            </Button>
            <Button onClick={fetchActiveRooms} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {language === 'ko' ? '새로고침' : 'Refresh'}
            </Button>
            <Button variant="outline" onClick={() => navigate('/admin/logs')}>
              {language === 'ko' ? '전체 로그' : 'All Logs'}
            </Button>
          </div>
        </div>

        {/* Active Rooms Grid */}
        {loading && rooms.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {language === 'ko' ? '로딩 중...' : 'Loading...'}
              </p>
            </CardContent>
          </Card>
        ) : rooms.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">
                {language === 'ko' ? '활성 룸이 없습니다' : 'No Active Rooms'}
              </p>
              <p className="text-sm text-muted-foreground">
                {language === 'ko'
                  ? '최근 60분 동안 활성화된 룸이 없습니다.'
                  : 'No rooms have been active in the last 60 minutes.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map((room) => (
              <Card key={room.room_id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate" title={room.room_id}>
                        {room.room_id}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Clock className="w-3 h-3" />
                        {getTimeAgo(room.last_activity)}
                      </CardDescription>
                    </div>
                    <Badge variant={room.participant_count > 0 ? 'default' : 'secondary'}>
                      <Users className="w-3 h-3 mr-1" />
                      {room.participant_count}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Participants List */}
                  {room.participants.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">
                        {language === 'ko' ? '참여자' : 'Participants'}
                      </p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {room.participants.map((participant, idx) => (
                          <div
                            key={participant.user_id || idx}
                            className="text-xs bg-muted p-2 rounded flex items-center justify-between gap-2"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">
                                {participant.display_name || participant.user_id}
                              </p>
                              {participant.display_name && (
                                <p className="text-muted-foreground truncate">
                                  {participant.user_id}
                                </p>
                              )}
                            </div>
                            <span className="text-muted-foreground whitespace-nowrap">
                              {getTimeAgo(participant.joined_at)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-muted-foreground">
                        {language === 'ko'
                          ? '최근 활동이 있었으나 현재 참여자가 없습니다'
                          : 'Recent activity but no current participants'}
                      </p>
                    </div>
                  )}

                  {/* Room Info */}
                  <div className="text-xs text-muted-foreground space-y-1 border-t pt-3">
                    {room.call_start_time && (
                      <div className="flex justify-between">
                        <span>{language === 'ko' ? '시작 시간' : 'Started'}</span>
                        <span>{formatDate(room.call_start_time)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>{language === 'ko' ? '마지막 활동' : 'Last Activity'}</span>
                      <span>{formatDate(room.last_activity)}</span>
                    </div>
                  </div>

                  {/* View Logs Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => viewRoomLogs(room.room_id)}
                  >
                    <ExternalLink className="w-3 h-3 mr-2" />
                    {language === 'ko' ? '상세 로그 보기' : 'View Detailed Logs'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminRooms;
