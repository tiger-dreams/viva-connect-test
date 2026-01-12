# Beta 테스트 가이드

이 문서는 새로운 기능을 Beta 환경에서 테스트하는 방법을 설명합니다.

---

## 🎯 Beta/Production 분리 전략

이 프로젝트는 **Beta와 Production을 완전히 분리**하여 안전하게 새로운 기능을 테스트합니다.

### 환경 구분

| 환경 | URL 경로 | 목적 | 사용자 영향 |
|------|---------|------|------------|
| **Beta** | `/beta/*` | 새 기능 테스트 | ❌ 실사용자 영향 없음 |
| **Production** | `/` | 안정화된 서비스 | ✅ 실사용자 서비스 |

### 주요 특징

**Beta 환경**:
- ✅ 새 기능을 자유롭게 테스트
- ✅ Production과 완전히 분리된 컴포넌트 트리
- ✅ main 브랜치 push 시 자동 배포
- ✅ 실사용자에게 영향 없음

**Production 환경**:
- ✅ 검증된 안정 기능만 배포
- ✅ Beta 테스트 완료 후에만 업데이트
- ✅ 명시적 승인 후 배포

---

## 📋 Beta 테스트 프로세스

### Step 1: Beta URL 접속

#### 1-1. Beta Conference Call 테스트

**Beta LIFF URL 생성**:
```
https://liff.line.me/{LIFF_ID}?liff.state=%2Fbeta%2Fsetup
```

**예시**:
```
https://liff.line.me/1234567890-abcdefgh?liff.state=%2Fbeta%2Fsetup
```

**접속 방법**:
1. LINE 앱을 열기
2. 본인에게 위 URL을 메시지로 전송
3. 링크를 탭하여 Beta LIFF 브라우저 열기

#### 1-2. Beta Agent Call 테스트 (선택사항)

**Beta Agent Call Trigger URL**:
```
https://liff.line.me/{LIFF_ID}?liff.state=%2Fbeta%2Fagent-call%2Ftrigger
```

**Beta Agent Call Meeting URL**:
```
https://liff.line.me/{LIFF_ID}?liff.state=%2Fbeta%2Fagent-call%2Fmeeting
```

---

### Step 2: Beta 기능 테스트

#### 2-1. Conference Call 테스트 체크리스트

**기본 기능**:
- [ ] LINE 로그인 정상 동작
- [ ] User ID/Display Name 자동 입력 확인
- [ ] Room 선택 (Japan, Korea, Taiwan, Thailand)
- [ ] Environment 선택 (Evaluation/Real)
- [ ] "Start Conference" 버튼 동작
- [ ] 카메라/마이크 권한 요청 및 허용

**Conference 화면**:
- [ ] 본인 영상 정상 표시
- [ ] Top Bar 정보 확인 (통화 시간, 참가자 수, 방 이름)
- [ ] Bottom Controls 동작 확인:
  - [ ] 카메라 On/Off 버튼
  - [ ] 마이크 Mute/Unmute 버튼
  - [ ] 통화 종료 버튼

**다자간 통화** (2명 이상):
- [ ] 다른 디바이스에서 동일 Room 접속
- [ ] 참가자 영상 정상 표시
- [ ] 비디오 그리드 레이아웃 확인:
  - [ ] 1명: Full screen
  - [ ] 2명: Vertical split (50/50)
  - [ ] 3-4명: 2×2 grid
- [ ] Speaking indicator (말하는 사람 테두리 강조)
- [ ] 참가자 추가/제거 시 UI 업데이트

**신규 기능** (Version 1.3.0):
- [ ] "Invite" 버튼 표시 확인
- [ ] LINE Share Picker 동작 확인
- [ ] Friends/Groups/Chatrooms 선택 가능
- [ ] 초대 메시지 발송 확인
- [ ] 초대받은 사람이 링크 탭 시:
  - [ ] OA 친구 추가 프롬프트 표시 (필요 시)
  - [ ] Conference room 자동 입장
  - [ ] 정상적으로 통화 연결

**통화 종료**:
- [ ] 종료 버튼 클릭
- [ ] Setup 페이지로 자동 리다이렉트
- [ ] 카메라/마이크 리소스 정상 해제

---

#### 2-2. Agent Call 테스트 체크리스트 (선택사항)

**Call Trigger**:
- [ ] Agent Call Trigger 페이지 접속
- [ ] 대상 User ID 입력 (또는 자동 입력)
- [ ] "Start Call" 버튼 클릭
- [ ] LIFF 창 2초 후 자동 닫힘

**Call Receive**:
- [ ] LINE 푸시 알림 수신 확인
- [ ] 알림 내용 확인:
  - [ ] "📞 전화가 왔습니다!" (한국어)
  - [ ] "📞 Incoming call!" (영어)
  - [ ] "60초 이내에 수락해주세요" 표시
- [ ] "Accept Call" 버튼 탭
- [ ] Agent Call Meeting 페이지 자동 열림
- [ ] 오디오 연결 확인

**Call Timeout & Retry**:
- [ ] 60초 동안 전화 받지 않기
- [ ] 타임아웃 알림 수신
- [ ] "Retry in 5 min" 버튼 표시
- [ ] Retry 버튼 클릭 → 확인 메시지
- [ ] 5분 후 자동 재발신 확인
- [ ] 최대 3회 재시도 제한 확인

**Call End**:
- [ ] 통화 종료 버튼 클릭
- [ ] Setup 페이지로 자동 리다이렉트
- [ ] 마이크 리소스 정상 해제

---

### Step 3: 버그 및 이슈 리포트

Beta 테스트 중 발견한 문제는 다음 정보를 포함하여 리포트하세요:

#### 버그 리포트 템플릿

```markdown
## 버그 요약
[한 줄로 문제 설명]

## 재현 단계
1. [첫 번째 단계]
2. [두 번째 단계]
3. [세 번째 단계]

## 예상 동작
[어떻게 동작해야 하는지]

## 실제 동작
[실제로 어떻게 동작했는지]

## 환경
- 디바이스: [iPhone 15 / Galaxy S24 / Desktop Chrome]
- OS: [iOS 17.5 / Android 14 / macOS 14.5]
- 브라우저: [LINE In-App / Safari / Chrome]
- Beta URL: [접속한 Beta URL]

## 스크린샷 (선택사항)
[스크린샷 첨부]

## 추가 정보
[기타 참고 사항]
```

#### GitHub Issue 등록 방법

1. [GitHub Issues](https://github.com/tiger-dreams/viva-connect-test/issues) 접속
2. "New Issue" 클릭
3. Title: `[Beta] 버그 요약`
4. Label: `bug`, `beta` 추가
5. 위 템플릿을 사용하여 상세 내용 작성
6. "Submit new issue" 클릭

---

### Step 4: 피드백 제출

Beta 테스트 완료 후 다음 정보를 공유해주세요:

#### 피드백 체크리스트

**기능 동작**:
- [ ] 모든 기능이 정상적으로 동작함
- [ ] 일부 기능에서 문제 발견 (Issue 등록 필요)
- [ ] 치명적인 버그로 테스트 불가

**사용자 경험**:
- [ ] UI/UX가 직관적이고 사용하기 쉬움
- [ ] 일부 UI 개선 필요 (구체적으로 명시)
- [ ] 모바일 최적화 만족

**성능**:
- [ ] 연결 속도 빠름 (3초 이내)
- [ ] 영상/음성 품질 우수
- [ ] 배터리 소모 적절

**추가 의견**:
```
[자유 형식으로 작성]
```

---

## 🔄 Beta → Production 배포 프로세스

Beta 테스트가 성공적으로 완료되면 다음 단계를 거쳐 Production에 배포됩니다.

### 배포 조건

✅ **배포 가능 조건**:
1. 모든 주요 기능이 정상 동작
2. 치명적인 버그 없음
3. 최소 2명 이상의 테스터 검증 완료
4. 사용자 피드백 긍정적

❌ **배포 불가 조건**:
1. 치명적인 버그 존재
2. UX 개선 필요 사항이 많음
3. 성능 문제 발생
4. 테스트 미완료

### 배포 승인 프로세스

1. **Beta 테스트 완료 보고**:
   - 테스트 결과 요약
   - 발견된 버그 목록
   - 피드백 종합

2. **배포 승인 대기**:
   - 프로젝트 관리자 검토
   - 버그 수정 완료 확인
   - Production 배포 승인

3. **Production 배포**:
   - Beta 코드를 Production 컴포넌트에 복사
   - Vercel 자동 배포
   - Production URL에서 최종 확인

4. **릴리즈 노트 업데이트**:
   - `docs/RELEASE_NOTES.md` 업데이트
   - 버전 번호 증가
   - 새 기능 및 개선 사항 문서화

---

## 🛠️ Beta 환경 아키텍처

### Beta 컴포넌트 구조

```
src/
├── pages/
│   ├── SetupPage.tsx              # Production
│   ├── BetaSetupPage.tsx          # Beta 전용 ✅
│   ├── PlanetKitMeeting.tsx       # Production
│   ├── BetaPlanetKitMeeting.tsx   # Beta 전용 ✅
│   ├── AgentCallTrigger.tsx       # Production
│   ├── BetaAgentCallTrigger.tsx   # Beta 전용 ✅
│   ├── AgentCallMeeting.tsx       # Production
│   └── BetaAgentCallMeeting.tsx   # Beta 전용 ✅
├── components/
│   ├── PlanetKitMeetingArea.tsx   # Shared (Beta/Production 공통)
│   └── TileView.tsx               # Shared (Beta/Production 공통)
```

### 라우팅 구조

**Production Routes**:
```
/                      → SetupPage
/meeting               → PlanetKitMeeting
/agent-call/trigger    → AgentCallTrigger
/agent-call/meeting    → AgentCallMeeting
```

**Beta Routes**:
```
/beta/setup            → BetaSetupPage
/beta/meeting          → BetaPlanetKitMeeting
/beta/agent-call/trigger → BetaAgentCallTrigger
/beta/agent-call/meeting → BetaAgentCallMeeting
```

---

## 📞 Beta 테스트 지원

### 문의 채널

**기술 문제**:
- GitHub Issues: [프로젝트 Issues](https://github.com/tiger-dreams/viva-connect-test/issues)
- Label: `beta`, `question`

**긴급 버그**:
- GitHub Issues with `critical` label
- 제목에 `[URGENT]` 표시

**기능 요청**:
- GitHub Issues with `enhancement` label

---

## 📝 Beta 테스트 FAQ

### Q1. Beta URL과 Production URL의 차이점은?

**Beta URL**: `/beta/*` 경로로 시작하며, 새로운 기능이 포함됩니다.
**Production URL**: `/` 경로로 시작하며, 검증된 안정 버전입니다.

### Q2. Beta 테스트 중 데이터는 안전한가요?

네, Beta 환경은 Production과 완전히 분리되어 있습니다. Beta에서 발생한 문제가 Production 사용자에게 영향을 주지 않습니다.

### Q3. Beta 테스트는 누구나 할 수 있나요?

네, LIFF ID가 있고 LINE 계정이 있다면 누구나 Beta URL로 접속하여 테스트할 수 있습니다.

### Q4. Beta에서 발견한 버그는 Production에도 있나요?

아니요, Beta의 버그는 Beta에만 존재합니다. Production은 별도의 코드베이스를 사용합니다.

### Q5. Beta 테스트는 얼마나 자주 하나요?

새로운 기능이 개발될 때마다 Beta 환경에 먼저 배포되며, 평균적으로 주 1-2회 Beta 업데이트가 있습니다.

### Q6. Production 배포는 언제 이루어지나요?

Beta 테스트가 성공적으로 완료되고, 프로젝트 관리자의 승인이 있은 후에만 Production에 배포됩니다.

### Q7. Beta와 Production의 환경 변수는 다른가요?

아니요, 동일한 환경 변수를 사용합니다. Beta와 Production의 차이는 **코드 버전**입니다.

---

## 🎉 Beta 테스터 역할

Beta 테스터는 다음과 같은 중요한 역할을 합니다:

1. **품질 검증**: 새 기능이 정상적으로 동작하는지 확인
2. **버그 발견**: Production 배포 전에 문제점 발견
3. **UX 피드백**: 사용자 경험 개선 제안
4. **성능 모니터링**: 속도, 안정성, 배터리 소모 확인

여러분의 피드백은 더 나은 제품을 만드는 데 큰 도움이 됩니다! 🙏

---

## 📚 추가 리소스

- [SETUP_GUIDE.md](./SETUP_GUIDE.md) - 프로젝트 설정 가이드
- [RELEASE_NOTES.md](./docs/RELEASE_NOTES.md) - 릴리즈 노트
- [CLAUDE.md](./CLAUDE.md) - 아키텍처 문서
- [GitHub Issues](https://github.com/tiger-dreams/viva-connect-test/issues) - 버그 리포트 및 문의

---

**Happy Beta Testing! 🚀**

*마지막 업데이트: 2026-01-09*
