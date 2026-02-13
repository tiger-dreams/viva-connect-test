# 🚀 Render 배포 가이드 (AI Agent Headless Service)

플랜 B: Render + Headless Chrome 방식 배포 가이드입니다.

## ✅ 구현 완료된 항목

1. **Vercel Frontend**
   - ✅ `/headless-agent` 페이지 생성
   - ✅ Conference 1개 (AI Agent)
   - ✅ Gemini AI 연결
   - ✅ 오디오 라우팅 설정
   - ✅ `window.agentConnected` 신호

2. **Render Service**
   - ✅ Express 서버 (`render-service/server.js`)
   - ✅ Puppeteer 통합
   - ✅ `/join-as-agent` endpoint
   - ✅ `/disconnect-agent` endpoint
   - ✅ Session 관리

## 📋 사용자가 해야 할 작업

### 1단계: Render 계정 생성 (5분)

1. [https://render.com](https://render.com) 접속
2. **"Get Started"** 클릭
3. GitHub 계정으로 로그인
4. GitHub repository 연결 허용

---

### 2단계: Render 서비스 생성 (10분)

#### 2-1. 새 Web Service 생성

1. Render 대시보드에서 **"New +"** 클릭
2. **"Web Service"** 선택
3. **"Build and deploy from a Git repository"** 선택
4. GitHub repository 선택: `viva-connect-test`
5. **"Connect"** 클릭

#### 2-2. 서비스 설정

| 항목 | 값 |
|------|-----|
| **Name** | `viva-connect-ai-agent` |
| **Region** | `Oregon` (또는 Singapore) |
| **Branch** | `main` |
| **Root Directory** | `render-service` ⚠️ **중요!** |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Plan** | `Free` (750 hours/month) |

#### 2-3. 환경 변수 설정

**"Advanced"** 섹션에서 환경 변수 추가:

| Key | Value |
|-----|-------|
| `FRONTEND_URL` | `https://your-app.vercel.app` (실제 Vercel URL로 변경) |
| `NODE_ENV` | `production` |

#### 2-4. 배포 시작

1. **"Create Web Service"** 클릭
2. 배포 진행 (약 5-10분)
3. 로그에서 성공 메시지 확인:
   ```
   [Render Service] 🚀 Server running on port 10000
   ```

---

### 3단계: Render 서비스 URL 복사 (1분)

배포 완료 후:

1. Render 대시보드에서 서비스 URL 복사
   - 예: `https://viva-connect-ai-agent.onrender.com`
2. 이 URL을 메모해두세요 (다음 단계에서 사용)

---

### 4단계: Vercel 환경 변수 설정 (2분)

1. [Vercel Dashboard](https://vercel.com/dashboard) 접속
2. `viva-connect-test` 프로젝트 선택
3. **Settings** → **Environment Variables**
4. 새 변수 추가:
   - **Name**: `RENDER_SERVICE_URL`
   - **Value**: `https://viva-connect-ai-agent.onrender.com` (3단계에서 복사한 URL)
   - **Environment**: `Production`, `Preview`, `Development` 모두 체크
5. **Save** 클릭
6. **Redeploy** (선택사항: 즉시 적용하려면)

---

### 5단계: 테스트 (5분)

#### 5-1. Render 서비스 Health Check

브라우저나 curl로 확인:
```bash
curl https://viva-connect-ai-agent.onrender.com/health
```

예상 응답:
```json
{
  "status": "ok",
  "activeSessions": 0,
  "uptime": 123.45
}
```

#### 5-2. Headless Agent 페이지 테스트

브라우저에서 직접 접속:
```
https://your-app.vercel.app/headless-agent?roomId=test&userId=AI_TEST&lang=ko
```

예상 화면:
- 검은 배경에 초록색 텍스트
- "✅ Connected" 상태 표시
- "✅ Ready (Puppeteer can proceed)" 메시지

---

## 🧪 통합 테스트

### 시나리오 1: AI Agent 자동 참가

**준비:** 2개 디바이스 또는 브라우저

**User A (AI Bridge 호스트):**
1. `/ai-agent-bridge?roomId=test-room` 접속
2. 마이크 권한 허용
3. **예상:** Render에서 자동으로 AI Agent 참가

**User B (일반 참가자):**
1. `/meeting` 접속
2. Room ID 입력: `test-room`
3. **예상:**
   - User A 음성 청취 ✅
   - AI Agent 음성 청취 ✅
   - AI Agent 타일 표시 ✅

---

## 🔧 트러블슈팅

### 문제 1: Render 서비스가 시작되지 않음

**증상:**
```
Error: Cannot find module 'express'
```

**해결:**
1. Render 대시보드에서 **Root Directory**가 `render-service`로 설정되었는지 확인
2. **Build Command**가 `npm install`인지 확인
3. **Redeploy** 클릭

---

### 문제 2: Headless Agent가 연결되지 않음

**증상:**
```
[Headless Page] Error: Timeout waiting for agentConnected
```

**해결:**
1. **FRONTEND_URL** 환경 변수 확인:
   ```
   https://your-app.vercel.app (슬래시 없음)
   ```
2. Vercel 앱이 배포되었는지 확인
3. `/headless-agent` 페이지가 접근 가능한지 브라우저에서 직접 확인

---

### 문제 3: AI Agent 음성이 들리지 않음

**증상:** User B가 AI 음성을 들을 수 없음

**해결:**
1. Render 로그 확인:
   ```
   [Headless Page] [log] [HeadlessAgent] ✅ AI audio stream injected
   ```
2. Gemini API 키 확인 (Vercel 환경 변수)
3. PlanetKit credentials 확인

---

### 문제 4: Render Sleep (30초 대기)

**증상:** 첫 번째 요청 시 30초 대기

**해결 방법 1: Cron Keep-Alive (권장)**

무료 cron 서비스 사용:
1. [cron-job.org](https://cron-job.org) 가입
2. 새 job 생성:
   - **URL**: `https://viva-connect-ai-agent.onrender.com/health`
   - **Interval**: Every 14 minutes
   - **Method**: GET

**해결 방법 2: On-Demand**

첫 요청 시 30초 대기 허용:
- User에게 "AI 준비 중..." 메시지 표시
- 30초 후 자동 재시도

---

## 💰 비용

### Free Plan (현재 설정)
- ✅ 750 hours/month
- ✅ 512 MB RAM
- ✅ Sleep after 15 min
- ✅ 한 달 24/7 가능 (Cron keep-alive 사용 시)

### Starter Plan ($7/month)
- Unlimited hours
- 1 GB RAM
- No sleep

**권장:** Free plan + Cron keep-alive = 완전 무료 24/7 운영

---

## 📊 모니터링

### Render 대시보드
1. 서비스 선택
2. **Logs** 탭 클릭
3. 실시간 로그 확인:
   ```
   [Render Service] Join request: { roomId: 'test-room', ... }
   [Render Service] ✅ Agent connected successfully
   ```

### Active Sessions 확인
```bash
curl https://viva-connect-ai-agent.onrender.com/sessions
```

---

## ✅ 체크리스트

배포 전:
- [ ] Render 계정 생성
- [ ] GitHub repository 연결
- [ ] Root Directory: `render-service` 설정
- [ ] FRONTEND_URL 환경 변수 설정

배포 후:
- [ ] Health check 응답 확인
- [ ] Headless agent 페이지 접속 가능
- [ ] Vercel RENDER_SERVICE_URL 설정
- [ ] User A + User B 통합 테스트

선택사항:
- [ ] Cron keep-alive 설정 (Sleep 방지)
- [ ] 모니터링 대시보드 설정

---

## 🎉 완료!

이제 다음과 같이 작동합니다:

1. User A가 AI Bridge 페이지 접속
2. Render 서비스가 Headless Chrome 실행
3. AI Agent가 PlanetKit Conference 참가
4. User B가 일반 회의로 참가
5. **모든 참가자가 AI 음성 청취 가능!** ✅

---

## 📞 문제 발생 시

1. Render 로그 확인
2. Vercel 함수 로그 확인
3. 브라우저 개발자 도구 콘솔 확인
4. GitHub Issue 생성

---

**다음 단계:**
배포 완료 후 사용자에게 결과 보고하세요! 🚀
