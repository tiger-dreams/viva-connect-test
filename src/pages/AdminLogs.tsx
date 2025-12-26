import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Search, Calendar, Users, Activity, Lock, LogIn } from 'lucide-react';
import { StoredPlanetKitEvent } from '@/types/planetkit-callback';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLiff } from '@/contexts/LiffContext';

// 환경 변수에서 허용된 관리자 UID 목록 로드 (쉼표로 구분)
const ALLOWED_ADMIN_UIDS = import.meta.env.VITE_ADMIN_UIDS
  ? import.meta.env.VITE_ADMIN_UIDS.split(',').map((uid: string) => uid.trim())
  : [];

const AdminLogs = () => {
  const { language } = useLanguage();
  const { isLoggedIn, profile, login } = useLiff();
  const [logs, setLogs] = useState<StoredPlanetKitEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [days, setDays] = useState('7');
  const [roomId, setRoomId] = useState('');
  const [eventType, setEventType] = useState('all');
  const [userId, setUserId] = useState('');
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    document.title = language === 'ko' ? 'PlanetKit 이벤트 로그' : 'PlanetKit Event Logs';
  }, [language]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        days,
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (roomId) params.append('roomId', roomId);
      if (eventType && eventType !== 'all') params.append('eventType', eventType);
      if (userId) params.append('userId', userId);

      const response = await fetch(`/api/logs?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setLogs(result.data);
        setTotalCount(result.pagination.total);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [days, roomId, eventType, userId, offset]);

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

  const getEventBadgeColor = (eventType: string) => {
    if (eventType.includes('JOIN')) return 'bg-green-500';
    if (eventType.includes('LEAVE')) return 'bg-orange-500';
    if (eventType.includes('START')) return 'bg-blue-500';
    if (eventType.includes('END')) return 'bg-red-500';
    if (eventType.includes('CREATE')) return 'bg-purple-500';
    if (eventType.includes('DELETE')) return 'bg-gray-500';
    return 'bg-gray-400';
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

  // 관리자 권한이 있는 경우 - 기존 로그 페이지 표시
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              {language === 'ko' ? 'PlanetKit 이벤트 로그' : 'PlanetKit Event Logs'}
            </h1>
            <p className="text-muted-foreground">
              {language === 'ko' ? `총 ${totalCount}개 이벤트` : `Total ${totalCount} events`}
            </p>
          </div>
          <Button onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {language === 'ko' ? '새로고침' : 'Refresh'}
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="w-5 h-5" />
              {language === 'ko' ? '필터' : 'Filters'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Days filter */}
              <div className="space-y-2">
                <Label htmlFor="days" className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {language === 'ko' ? '기간' : 'Period'}
                </Label>
                <Select value={days} onValueChange={setDays}>
                  <SelectTrigger id="days">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">{language === 'ko' ? '1일' : '1 day'}</SelectItem>
                    <SelectItem value="3">{language === 'ko' ? '3일' : '3 days'}</SelectItem>
                    <SelectItem value="7">{language === 'ko' ? '7일' : '7 days'}</SelectItem>
                    <SelectItem value="30">{language === 'ko' ? '30일' : '30 days'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Room ID filter */}
              <div className="space-y-2">
                <Label htmlFor="roomId" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {language === 'ko' ? '룸 ID' : 'Room ID'}
                </Label>
                <Input
                  id="roomId"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder={language === 'ko' ? '전체' : 'All'}
                />
              </div>

              {/* Event Type filter */}
              <div className="space-y-2">
                <Label htmlFor="eventType" className="flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  {language === 'ko' ? '이벤트 타입' : 'Event Type'}
                </Label>
                <Select value={eventType} onValueChange={setEventType}>
                  <SelectTrigger id="eventType">
                    <SelectValue placeholder={language === 'ko' ? '전체' : 'All'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{language === 'ko' ? '전체' : 'All'}</SelectItem>
                    <SelectItem value="GCALL_EVT_USER_JOIN">USER_JOIN</SelectItem>
                    <SelectItem value="GCALL_EVT_USER_LEAVE">USER_LEAVE</SelectItem>
                    <SelectItem value="GCALL_EVT_START">CALL_START</SelectItem>
                    <SelectItem value="GCALL_EVT_END">CALL_END</SelectItem>
                    <SelectItem value="GCALL_EVT_STATUS_CHANGE">STATUS_CHANGE</SelectItem>
                    <SelectItem value="GCALL_EVT_MEDIA_CHANGE">MEDIA_CHANGE</SelectItem>
                    <SelectItem value="GCALL_EVT_CALLBACK">CALLBACK</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* User ID filter */}
              <div className="space-y-2">
                <Label htmlFor="userId">
                  {language === 'ko' ? '사용자 ID' : 'User ID'}
                </Label>
                <Input
                  id="userId"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder={language === 'ko' ? '검색...' : 'Search...'}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>{language === 'ko' ? '이벤트 로그' : 'Event Logs'}</CardTitle>
            <CardDescription>
              {language === 'ko'
                ? `최근 ${days}일간의 이벤트`
                : `Events from the last ${days} days`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  {language === 'ko' ? '로딩 중...' : 'Loading...'}
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {language === 'ko' ? '이벤트가 없습니다' : 'No events found'}
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="border rounded-lg p-4 hover:bg-accent transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={getEventBadgeColor(log.event_type)}>
                            {log.event_type.replace('GCALL_EVT_', '')}
                          </Badge>
                          {log.room_id && (
                            <span className="text-sm text-muted-foreground">
                              📍 {log.room_id}
                            </span>
                          )}
                          {log.user_id && (
                            <span className="text-sm text-muted-foreground">
                              👤 {log.user_id}
                            </span>
                          )}
                          {log.display_name && (
                            <span className="text-sm text-muted-foreground">
                              ({log.display_name})
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(log.created_at)}
                        </div>
                        {log.data && Object.keys(log.data).length > 0 && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                              {language === 'ko' ? '상세 데이터' : 'Details'}
                            </summary>
                            <pre className="mt-2 p-2 bg-muted rounded overflow-auto">
                              {JSON.stringify(log.data, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            {totalCount > limit && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                >
                  {language === 'ko' ? '이전' : 'Previous'}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {offset + 1} - {Math.min(offset + limit, totalCount)} / {totalCount}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setOffset(offset + limit)}
                  disabled={offset + limit >= totalCount}
                >
                  {language === 'ko' ? '다음' : 'Next'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminLogs;
