# 개발 일지

## 📅 2025년 12월 31일

### 📋 작업 요약

Speaking Indicator (말하는 참가자 시각적 표시) 기능 완성 - Issue #10

---

### 🎯 주요 구현 사항

#### 1. Speaking Indicator 기능 (Issue #10)

**목표**: 회의 중 말하고 있는 참가자를 시각적으로 표시 (초록색 테두리)

##### 1.1 초기 구현 시도 및 문제점

**첫 번째 접근**: `evtPeersTalkingStatusUpdated` 이벤트만 사용
- **문제**: 혼자 있는 방에서 자신이 말할 때 표시 안됨
- **원인**: PlanetKit은 2명 이상일 때만 원격 참가자 talking 이벤트 발생
- **발견**: 사용자 테스트를 통해 "혼자 말할 때 테두리 안 나온다" 확인
- **커밋**: `2fc5227`

##### 1.2 수동 오디오 모니터링 시도

**두 번째 접근**: WebRTC AudioContext로 로컬 오디오 레벨 직접 감지
- **구현**:
  - `navigator.mediaDevices.getUserMedia`로 마이크 스트림 획득
  - `AudioContext` + `AnalyserNode`로 주파수 데이터 분석
  - `requestAnimationFrame`으로 실시간 오디오 레벨 체크
  - 임계값(threshold) 기반 talking 상태 판단
- **문제점**:
  1. **낮은 오디오 레벨**: PlanetKit이 이미 마이크 사용 중이라 별도 스트림 레벨이 낮음
  2. **임계값 조정 필요**: 처음 30 → 20으로 조정했으나 여전히 불안정
  3. **깜빡임 현상**: threshold 경계에서 true/false 반복
- **디버깅 과정**:
  - 상세 로그 추가: 1초마다 평균 오디오 레벨 출력
  - 사용자 로그 분석: 말할 때 레벨 14~26, threshold 30은 너무 높음
  - Threshold 조정: 30 → 20
- **커밋**: `6ff6b76`, `f1653f7`, `0d8b22a`

##### 1.3 최종 해결: PlanetKit 네이티브 이벤트 사용

**공식 데모 분석**: `/Users/ad03179589/Documents/planet-kit-demoapp-web`
- **발견**: 공식 데모는 **`evtMyTalkingStatusUpdated`** 이벤트를 사용!
- **올바른 구현**:
  - 로컬 사용자(나): `evtMyTalkingStatusUpdated` (boolean 파라미터)
  - 원격 참가자: `evtPeersTalkingStatusUpdated` ({active: [], inactive: []})

**최종 구현**:
```typescript
// 로컬 사용자 (혼자 있을 때도 작동)
evtMyTalkingStatusUpdated: (isActive: boolean) => {
  setParticipants(prev => prev.map(p => {
    if (p.id === config.userId) {
      return { ...p, isTalking: isActive, isSpeaking: isActive };
    }
    return p;
  }));
},

// 원격 참가자들
evtPeersTalkingStatusUpdated: (talkingInfoArray: any) => {
  const { active, inactive } = talkingInfoArray;
  setParticipants(prev => prev.map(p => {
    if (active.includes(p.id)) {
      return { ...p, isTalking: true, isSpeaking: true };
    } else if (inactive.includes(p.id)) {
      return { ...p, isTalking: false, isSpeaking: false };
    }
    return p;
  }));
}
```

**장점**:
- ✅ PlanetKit SDK의 네이티브 기능 활용
- ✅ 혼자 있을 때도 정상 작동
- ✅ 코드 간결화 (111줄 제거, 16줄 추가)
- ✅ 더 정확하고 안정적인 감지
- ✅ Threshold 조정 불필요

**커밋**: `d96061d`

##### 1.4 UI/UX 개선

**시각적 강화**:
- 초기: `border-2 emerald-400` (얇고 연함)
- 개선: `border-4 emerald-500` + `shadow-lg shadow-emerald-500/50` (발광 효과)
- **사용자 피드백**: "표시가 되는데 눈에 띄지 않는다"
- **결과**: 두껍고 밝은 초록색 발광 테두리로 명확한 시각적 피드백

**커밋**: `7a7018b`

---

#### 2. 타입 정의 추가

**Participant 인터페이스 확장**:
```typescript
export interface Participant {
  // ... 기존 필드들
  isTalking?: boolean;   // Speaking indicator용
  isLocal?: boolean;     // 로컬/원격 참가자 구분
}
```

**파일**: `src/types/video-sdk.ts`

---

#### 3. 디버깅 과정 요약

**문제 해결 흐름**:
1. ❌ 혼자 말할 때 표시 안됨 → 로컬 감지 필요 발견
2. ❌ AudioContext 레벨 너무 낮음 → Threshold 조정
3. ❌ 여전히 불안정 → 공식 데모 분석
4. ✅ `evtMyTalkingStatusUpdated` 발견 → 완벽 해결

**학습 포인트**:
- 공식 데모 앱이 가장 정확한 참고 자료
- SDK가 제공하는 네이티브 기능을 먼저 확인
- 수동 구현은 최후의 수단

---

### 🔧 수정된 파일 목록

1. `src/types/video-sdk.ts` - Participant 타입에 isTalking, isLocal 추가
2. `src/components/PlanetKitMeetingArea.tsx` - evtMyTalkingStatusUpdated 이벤트 추가
3. `src/components/TileView.tsx` - Speaking indicator UI (발광 효과)

---

### 📊 커밋 히스토리

```
d96061d - fix: Use PlanetKit native evtMyTalkingStatusUpdated event
7a7018b - feat: Make speaking indicator more visible
0d8b22a - fix: Lower audio monitoring threshold from 30 to 20
f1653f7 - debug: Add detailed audio monitoring logs for speaking indicator
6ff6b76 - feat: Add local audio level monitoring for self-talking indicator
421c49a - fix: Correct talking status event handling and local participant ID
72206c8 - debug: Add event proxy to log all talking-related PlanetKit events
2fc5227 - feat: Add speaking indicator for conference participants (Issue #10)
```

---

## 📅 2025년 12월 29-30일

### 📋 작업 요약

Beta/Production 환경 완전 분리 및 문서화 개선

---

### 🎯 주요 구현 사항

#### 1. Beta/Production 환경 완전 분리

**목적**: 프로덕션 사용자에게 영향 없이 신규 기능 테스트

**구현 내용**:
- **Beta 전용 페이지**: `BetaSetupPage`, `BetaPlanetKitMeeting`, `BetaAgentCallTrigger` 등
- **별도 라우팅**: `/beta/*` 경로로 완전 독립
- **독립적인 컴포넌트 트리**: Production 코드와 완전 분리

**라우팅 구조**:
```
Production:
- / → SetupPage
- /planetkit_meeting → PlanetKitMeeting
- /agent-call → AgentCallTrigger

Beta (완전 독립):
- /beta → BetaSetupPage
- /beta/planetkit_meeting → BetaPlanetKitMeeting
- /beta/agent-call → BetaAgentCallTrigger
```

**커밋**: `fdcab52`, `1d39801`, `cea460e`, `12d79c3`

---

#### 2. 문서화 대폭 개선

##### 2.1 README 영문 통합
- **기존**: 한국어/영어 분리된 README
- **개선**: 단일 영문 README로 통합
- **추가**: LINE Official Account 링크
- **커밋**: `b992d0b`

##### 2.2 아키텍처 문서 추가
- **신규 파일**: `docs/architecture.md`
- **내용**:
  - 시스템 구조도
  - 주요 컴포넌트 설명
  - Agent Call 플로우
  - 데이터베이스 스키마
- **커밋**: `b9d75a4`

---

#### 3. 보안 개선

**Service ID 노출 제거**:
- `.env.example`에서 실제 Service ID 제거
- 플레이스홀더로 대체
- **커밋**: `56ebf70`

**불필요한 파일 정리**:
- `cron-disabled/` 폴더 제거 (미사용)
- **커밋**: `61f4d3c`

---

#### 4. Agent Call 미디어 정리 개선

**문제**: 통화 종료 후 미디어 리소스 누수
**해결**:
- 모든 MediaStream tracks 정리
- Video elements detach
- PlanetKit conference cleanup
- **커밋**: `87b4ac0`

---

### 🔧 수정된 파일 목록

#### Frontend
1. `src/pages/BetaSetupPage.tsx` - Beta 전용 셋업 페이지
2. `src/pages/BetaPlanetKitMeeting.tsx` - Beta 전용 미팅 페이지
3. `src/pages/BetaAgentCallTrigger.tsx` - Beta Agent Call 발신
4. `src/pages/BetaAgentCallMeeting.tsx` - Beta Agent Call 수신
5. `src/pages/BetaScheduleRetryPage.tsx` - Beta 재시도 페이지
6. `src/App.tsx` - Beta 라우팅 추가

#### Documentation
7. `README.md` - 영문 통합 및 개선
8. `docs/architecture.md` - 아키텍처 문서 신규 작성

#### Configuration
9. `.env.example` - Service ID 노출 제거

---

### 📊 커밋 히스토리

```
cea460e - fix: Update BetaSetupPage manual join to navigate to Beta Conference
1d39801 - fix: Add Beta PlanetKit Conference page for complete isolation
fdcab52 - feat: Add complete Beta/Production separation for Agent Call system
12d79c3 - feat: Add /beta paths for testing Agent Call features
56ebf70 - security: Remove exposed PlanetKit service ID from .env.example
61f4d3c - chore: Remove unused cron-disabled folder
87b4ac0 - fix: Improve Agent Call media cleanup on disconnect
b992d0b - docs: Unify README to English and add LINE Official Account link
b9d75a4 - docs: Add architecture documentation and update README
```

---

## ✅ 전체 테스트 체크리스트

### Speaking Indicator (Issue #10)
- [x] 혼자 말할 때 초록 테두리 표시
- [x] 2명 이상일 때 말하는 사람 모두 표시
- [x] 원격 참가자 speaking 표시
- [x] 시각적으로 명확한 표시 (발광 효과)
- [x] 마이크 꺼져있을 때 표시 안함

### Beta/Production 분리
- [x] Beta 페이지 독립 동작
- [x] Production 페이지 정상 동작
- [x] 라우팅 충돌 없음
- [x] 각 환경 독립적 설정 가능

---

## 🔮 향후 개선 사항

### Speaking Indicator 관련
1. **애니메이션 개선**
   - Pulse 효과 추가 (말하는 동안 미묘하게 깜빡임)
   - Smooth transition

2. **추가 UI 피드백**
   - 말하는 시간 카운터 (선택적)
   - 오디오 레벨 바 (선택적)

### Beta 환경 관련
1. **Feature Flags**
   - 환경별 기능 토글
   - A/B 테스팅 기반 구축

2. **테스트 자동화**
   - Beta 환경 자동 테스트
   - Production 배포 전 Beta 검증 파이프라인

---

## 📚 참고 문서

- [LINE PlanetKit Official Demo](https://github.com/line/planet-kit-demoapp-web)
- [PlanetKit Conference Events](https://docs.lineplanet.me/conference/events)
- [WebRTC AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext)

---

# 이전 작업 내역

---

## 📅 2025년 12월 28일

### 📋 작업 요약

Agent Call (오디오 발신) 기능의 UX 개선 및 자동 재시도 시스템 완성

---

### 🎯 주요 구현 사항

#### 1. 타임아웃 알림 재시도 시스템 마무리

##### 시간 표시 개선
- **문제**: 재시도 확인 메시지에 표시되는 시간이 UTC 기준으로 표시되어 사용자에게 혼란을 줌
  - 예: "10:27에 전화 올 예정" (실제로는 서버 UTC 시간)
- **해결**: 절대 시간 대신 상대 시간 표현으로 변경
  - Before: `${timeString}에 통화 요청이 도착합니다`
  - After: `약 5분 후에 통화 요청이 도착합니다`
- **파일**: `api/schedule-retry.ts` (204-206줄)

##### 불필요한 버튼 제거
- **개선**: 타임아웃 알림 메시지에서 "확인" 버튼 제거
  - 아무 기능도 없는 버튼 (단순히 메시지 닫기)
  - 사용자가 자연스럽게 메시지를 닫거나 무시할 수 있음
- **결과**: "5분 후 다시 받기" 버튼만 남겨서 더 깔끔한 UX
- **파일**: `api/one-to-one-call-callback.ts` (303-332줄)

##### 60초 제한 시간 안내 추가
- **개선**: Incoming call 메시지에 "60초 이내에 수락해주세요" 안내 추가
- **목적**: 사용자에게 통화 수락 시간 제한을 명확히 전달
- **파일**: `api/notify-callback.ts` (112-114줄)

##### 다국어 지원 강화 (국제화 대응)
- **문제**: 기존에는 type 기반으로 언어 선택 (비디오=영어, 오디오=한국어)
- **해결**: DB의 language 필드 기반으로 메시지 언어 선택
- **기본값**: 영어 (대만, 태국 등 국제 사용자 고려)
- **지원 언어**:
  - 한국어 (language='ko'): "📞 전화가 왔습니다! 60초 이내에 수락해주세요."
  - 영어 (기본값): "📞 Incoming call! Please accept within 60 seconds."
- **파일**: `api/notify-callback.ts` (60-105줄)

---

#### 2. Agent Call UX 대폭 개선

##### 2.1 발신 후 자동 웹뷰 종료
- **구현**: Agent Call 발신 성공 시 2초 후 LIFF 창 자동 닫기
- **사용자 플로우**:
  1. 사용자가 "전화 걸기" 클릭
  2. 성공 메시지 표시 (2초)
  3. LIFF 창 자동으로 닫힘 ✨
- **파일**: `src/pages/AgentCallTrigger.tsx` (73-79줄)

```typescript
// Auto-close LIFF window after 2 seconds
setTimeout(() => {
  if (liff?.isInClient()) {
    console.log('[AgentCallTrigger] Auto-closing LIFF window');
    liff.closeWindow();
  }
}, 2000);
```

##### 2.2 Accept Call 버튼 클릭 시 자동 통화 진입
- **문제**: LINE 메시지에서 "Accept Call" 버튼을 눌러도 추가로 버튼을 눌러야 통화 시작
- **해결**:
  1. 딥링크에 `autoAccept=true` 파라미터 추가
  2. LIFF 페이지 로드 시 자동으로 통화 연결 시작
- **파일**:
  - `api/notify-callback.ts` (97줄): 딥링크 생성
  - `src/components/PlanetKitMeetingArea.tsx` (46줄, 102-107줄): autoAccept 처리

```typescript
// notify-callback.ts
const deepLink = `https://liff.line.me/${liffId}/agent-call-meeting?sid=${encodeURIComponent(String(sid))}&cc_param=${encodeURIComponent(String(param))}&autoAccept=true`;

// PlanetKitMeetingArea.tsx
useEffect(() => {
  if (isAgentCall && autoAccept && !connectionStatus.connected && !connectionStatus.connecting) {
    console.log('[Agent Call] Auto-accepting call due to autoAccept parameter');
    connectToConference();
  }
}, [isAgentCall, autoAccept, connectionStatus.connected, connectionStatus.connecting]);
```

##### 2.3 통화 종료 시 자동 리다이렉트
- **구현**: 통화 종료 시 자동으로 셋업 페이지로 이동
- **파일**:
  - `src/components/PlanetKitMeetingArea.tsx` (213-216줄): `onDisconnect` 콜백 호출
  - `src/pages/AgentCallMeeting.tsx` (51-54줄): `/setup`으로 이동

---

#### 3. 자동 수락 설정 오류 수정

##### 3.1 문제 발견
- **증상**: "Accept Call" 버튼 클릭 후 "설정 오류" 발생
- **원인**: LIFF로 진입 시 `planetKitConfig`에 `userId`와 `accessToken` 없음
- **로그**:
  ```
  [AgentCallMeeting] Rendering with sessionId: 6f253b4e-84d6-41c9-8db5-219bd9af0a4d
  [Agent Call] Auto-accepting call due to autoAccept parameter
  ```

##### 3.2 해결 방법
- **구현**: `AgentCallMeeting` 컴포넌트에 LIFF 프로필 기반 설정 초기화 추가
- **프로세스**:
  1. LIFF 프로필 로드 대기
  2. JWT 토큰 생성 (`generatePlanetKitToken`)
  3. `planetKitConfig` 업데이트 (userId, displayName, accessToken)
  4. 초기화 완료 후 `PlanetKitMeetingArea` 렌더링
  5. `autoAccept`가 자동으로 연결 시작
- **파일**: `src/pages/AgentCallMeeting.tsx` (전체 리팩토링)

```typescript
useEffect(() => {
  const initializeConfig = async () => {
    if (isLoggedIn && profile) {
      const token = await generatePlanetKitToken(
        planetKitConfig.serviceId,
        planetKitConfig.apiKey,
        profile.userId,
        sessionId || '',
        3600,
        planetKitConfig.apiSecret
      );

      setPlanetKitConfig({
        ...planetKitConfig,
        userId: profile.userId,
        displayName: profile.displayName,
        accessToken: token,
        environment: 'eval'
      });

      setIsInitializing(false);
    }
  };

  initializeConfig();
}, [isLoggedIn, profile, sessionId]);
```

##### 3.3 빌드 오류 수정
- **문제**: `generateToken` 함수가 존재하지 않음
- **원인**: 실제 함수명은 `generatePlanetKitToken`이고 async 함수임
- **수정**:
  - Import 수정: `generateToken` → `generatePlanetKitToken`
  - Async/await 처리 추가
- **커밋**: `8231749`

---

## 🔧 수정된 파일 목록

### Backend (API)
1. `api/schedule-retry.ts` - 시간 표시를 상대 시간으로 변경
2. `api/one-to-one-call-callback.ts` - "확인" 버튼 제거
3. `api/notify-callback.ts` - 딥링크에 `autoAccept=true` 추가

### Frontend
4. `src/pages/AgentCallTrigger.tsx` - 발신 성공 시 LIFF 창 자동 닫기
5. `src/pages/AgentCallMeeting.tsx` - LIFF 프로필 기반 설정 초기화 추가
6. `src/components/PlanetKitMeetingArea.tsx` - autoAccept 파라미터 처리 및 자동 연결

---

## 📊 커밋 히스토리

```
4081518 - fix: Change time display from absolute to relative in retry confirmation
a1d7639 - feat: Improve Agent Call UX with auto-close and auto-accept
3d92750 - refactor: Remove unnecessary 'OK' button from timeout notification
a8c0add - fix: Initialize PlanetKit config when accepting Agent Call from LINE
8231749 - fix: Correct token generator import in AgentCallMeeting
1de961c - feat: Add 60-second timeout notice to incoming call message
b0f8b8c - feat: Use session language for multi-language notifications (default: English)
```

---

## 🎉 최종 사용자 플로우

### 발신 플로우
1. 사용자가 Agent Call 시작 → LIFF 열림
2. 성공 메시지 표시 (2초)
3. **LIFF 창 자동 닫기** ✨

### 수신 플로우
1. LINE 메시지 도착: "📞 Incoming call!"
2. "Accept Call" 버튼 클릭
3. **즉시 통화 화면 진입 (버튼 클릭 불필요)** ✨
4. 통화 진행
5. **통화 종료 시 자동으로 셋업 페이지로 이동** ✨

### 타임아웃 & 재시도 플로우
1. 60초 동안 응답 없음 → 타임아웃
2. LINE 메시지: "통화 수락 대기가 종료되었습니다. 5분 후 다시 전화를 받으실 수 있습니다."
3. **"5분 후 다시 받기" 버튼만 표시** (확인 버튼 제거)
4. 버튼 클릭 시 즉시 확인 메시지: **"약 5분 후에 통화 요청이 도착합니다"** (상대 시간)
5. 5분 후 자동으로 재발신
6. 자동 수락 및 통화 진입

---

## 🐛 해결된 이슈

### Issue 1: 타임아웃 시간 표시 혼란
- **증상**: "10:27에 전화 올 예정"이라고 표시되지만 실제 사용자 시간대와 다름
- **원인**: 서버 UTC 시간을 로컬 시간으로 변환하지 않음
- **해결**: 절대 시간 대신 상대 시간 표현 사용 ("약 5분 후에")

### Issue 2: 자동 수락 시 설정 오류
- **증상**: Accept Call 버튼 클릭 후 "설정 오류" 메시지
- **원인**: LIFF로 진입 시 planetKitConfig에 userId와 accessToken 없음
- **해결**: AgentCallMeeting 컴포넌트에서 LIFF 프로필 로드 후 설정 초기화

### Issue 3: 빌드 오류
- **증상**: `"generateToken" is not exported by "src/utils/token-generator.ts"`
- **원인**: 함수명이 `generatePlanetKitToken`이고 async 함수임
- **해결**: Import 수정 및 async/await 처리

---

## 📝 기술적 하이라이트

### 1. LIFF 프로필 기반 동적 설정
- LIFF Context와 VideoSDK Context 통합
- 프로필 로드 완료 시 JWT 토큰 자동 생성
- 로딩 상태 관리로 사용자 경험 개선

### 2. URL 파라미터 기반 자동화
- `autoAccept=true` 파라미터로 자동 연결 제어
- 딥링크에 필요한 모든 정보 포함 (sid, cc_param, autoAccept)
- 사용자 추가 액션 없이 원클릭 통화 시작

### 3. 타임존 문제 우회
- 절대 시간 → 상대 시간 표현으로 변경
- 서버/클라이언트 시간대 불일치 문제 완전 회피

---

## 🚀 배포 상태

- **Vercel**: ✅ 성공적으로 배포됨
- **Production URL**: https://viva-connect-test.vercel.app
- **테스트 환경**: LINE Eval Environment

---

## ✅ 테스트 체크리스트

- [x] Agent Call 발신 후 LIFF 자동 닫기
- [x] Accept Call 버튼 클릭 시 자동 통화 진입
- [x] 통화 종료 시 셋업 페이지 리다이렉트
- [x] 타임아웃 알림 메시지 (버튼 1개)
- [x] 재시도 확인 메시지 (상대 시간 표시)
- [x] LIFF 프로필 기반 설정 초기화
- [x] 60초 제한 시간 안내 표시
- [x] 다국어 지원 (한국어/영어, 기본값: 영어)
- [x] 빌드 및 배포 성공

---

## 🔮 향후 개선 사항

1. **에러 핸들링 강화**
   - LIFF 초기화 실패 시 fallback 처리
   - Token 생성 실패 시 재시도 로직

2. **사용자 피드백 개선**
   - 로딩 상태에 진행률 표시
   - 자동 연결 중 취소 버튼 추가

3. **모니터링**
   - 자동 수락 성공률 추적
   - 타임아웃 재시도 성공률 분석

---

## 📚 참고 문서

- [LINE LIFF Documentation](https://developers.line.biz/en/docs/liff/)
- [PlanetKit Web SDK](https://docs.lineplanet.me/)
- [Upstash QStash](https://upstash.com/docs/qstash)

---

**작성자**: Claude Code
**프로젝트**: viva-connect-test (LINE PlanetKit Video Conferencing)
**최종 업데이트**: 2025년 12월 31일
