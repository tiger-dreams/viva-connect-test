# Setup Guide - LINE PlanetKit LIFF Demo

이 문서는 프로젝트를 처음 시작하는 엔지니어를 위한 상세 설정 가이드입니다.

## 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [사전 요구사항](#사전-요구사항)
3. [환경 변수 설정 가이드](#환경-변수-설정-가이드)
4. [기능별 필수 환경 변수](#기능별-필수-환경-변수)
5. [단계별 설정 프로세스](#단계별-설정-프로세스)
6. [테스트 방법](#테스트-방법)
7. [문제 해결](#문제-해결)

---

## 프로젝트 개요

LINE LIFF 기반의 영상 통화 및 음성 발신 애플리케이션입니다.

### 주요 기능

1. **Conference Call (그룹 영상 통화)** 🎥
   - LINE 로그인 후 다자간 영상 통화
   - 최대 4명까지 동시 통화 (UI 최적화)
   - 4개 지역 방 선택 (일본, 한국, 대만, 태국)

2. **Agent Call (음성 발신)** 📞
   - LINE 사용자에게 자동 음성 전화 발신
   - 푸시 알림 연동
   - 자동 재시도 기능

---

## 사전 요구사항

### 1. 개발 환경
- Node.js 18 이상
- npm 또는 yarn
- Git

### 2. LINE Developer 계정
- LINE Developers Console 접근 권한
- Provider 생성 권한

### 3. PlanetKit 계정
- LINE Planet Console 접근 권한
- Service 생성 권한

### 4. 배포 환경 (선택사항)
- Vercel 계정 (배포용)
- Upstash 계정 (Agent Call 재시도 기능용)

---

## 환경 변수 설정 가이드

### 우선순위별 분류

#### 🔴 **필수 (Conference Call 최소 동작)**

```env
VITE_LIFF_ID=
VITE_PLANETKIT_EVAL_SERVICE_ID=
VITE_PLANETKIT_EVAL_API_KEY=
VITE_PLANETKIT_EVAL_API_SECRET=
```

#### 🟡 **권장 (프로덕션 배포용)**

```env
VITE_PLANETKIT_REAL_SERVICE_ID=
VITE_PLANETKIT_REAL_API_KEY=
VITE_PLANETKIT_REAL_API_SECRET=
```

#### 🟢 **선택 (Agent Call 기능용)**

```env
LINE_CHANNEL_ID=
LINE_CHANNEL_SECRET=
PLANETKIT_AGENT_CALL_BASE_URL=
VITE_PLANETKIT_AUDIO_FILE_GREETING=
VITE_PLANETKIT_AUDIO_FILE_RINGING=
VITE_PLANETKIT_AUDIO_FILE_WAITING=
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=
CRON_SECRET=
```

---

## 환경 변수 상세 설명

### 📱 LINE LIFF 설정

#### `VITE_LIFF_ID`

**용도**: LINE 로그인 인증 및 사용자 프로필 조회

**발급 방법**:
1. [LINE Developers Console](https://developers.line.biz/console/) 접속
2. Provider 선택 또는 생성
3. "LIFF" 탭에서 "Create" 클릭
4. LIFF 앱 설정:
   - **Name**: 앱 이름 (예: "PlanetKit Video Call")
   - **Size**: Full
   - **Endpoint URL**: 배포 URL (예: `https://your-app.vercel.app`)
     - 로컬 테스트: `http://localhost:8080` (개발 중 임시 설정 가능)
   - **Scopes**: `profile`, `openid` 선택
5. LIFF ID 복사 (형식: `1234567890-abcdefgh`)

**코드에서 사용되는 위치**:
- `src/contexts/LiffContext.tsx` - LIFF SDK 초기화
- `src/hooks/use-liff.ts` - 로그인 상태 관리

**예시**:
```env
VITE_LIFF_ID=1234567890-abcdefgh
```

---

### 🎥 PlanetKit Conference (평가 환경)

#### `VITE_PLANETKIT_EVAL_SERVICE_ID`

**용도**: PlanetKit Conference API 서비스 식별자 (테스트 환경)

**발급 방법**:
1. [LINE Planet Console](https://console.lineplanet.me/) 접속
2. "Services" 메뉴 클릭
3. "Create Service" 버튼 클릭
4. 서비스 설정:
   - **Service Name**: 서비스 이름 (예: "Video Call Demo")
   - **Environment**: **Evaluation** 선택 ⚠️
   - **Service Type**: Conference
5. Service ID 복사 (예: `your-service-id`)

**코드에서 사용되는 위치**:
- `src/utils/token-generator.ts` - JWT Access Token 생성 시 `sub` claim
- `src/components/PlanetKitMeetingArea.tsx` - Conference 초기화

**예시**:
```env
VITE_PLANETKIT_EVAL_SERVICE_ID=your-eval-service-id
```

---

#### `VITE_PLANETKIT_EVAL_API_KEY`

**용도**: PlanetKit API 인증 키 (평가 환경)

**발급 방법**:
1. LINE Planet Console에서 생성한 Service 선택
2. "API Keys" 탭 클릭
3. "Generate API Key" 클릭
4. API Key 복사 (형식: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

**코드에서 사용되는 위치**:
- `src/utils/token-generator.ts` - JWT 서명 시 `iss` claim
- `api/agent-call.ts` - Agent Call API 인증 (서버사이드)

**보안 주의사항**:
- ⚠️ **절대 커밋하지 말 것**: `.env` 파일은 `.gitignore`에 포함됨
- 🔒 **클라이언트 노출**: 현재는 클라이언트에서 JWT 생성 (개발/테스트용)
- 🚀 **프로덕션 권장**: 서버사이드에서 토큰 생성

**예시**:
```env
VITE_PLANETKIT_EVAL_API_KEY=12345678-1234-1234-1234-123456789abc
```

---

#### `VITE_PLANETKIT_EVAL_API_SECRET`

**용도**: PlanetKit JWT 서명용 비밀 키 (평가 환경)

**발급 방법**:
1. API Key 생성 시 함께 발급됨
2. API Secret은 **생성 직후에만 표시**되므로 반드시 저장

**코드에서 사용되는 위치**:
- `src/utils/token-generator.ts` - JWT 서명 (HS256 알고리즘)

**보안 주의사항**:
- 🔴 **매우 중요**: 절대 공개 저장소에 커밋하지 말 것
- 🔒 **서버사이드 필수**: 프로덕션에서는 반드시 백엔드에서만 사용

**예시**:
```env
VITE_PLANETKIT_EVAL_API_SECRET=your-secret-key-here-keep-it-safe
```

---

### 🚀 PlanetKit Conference (프로덕션 환경)

#### `VITE_PLANETKIT_REAL_SERVICE_ID`
#### `VITE_PLANETKIT_REAL_API_KEY`
#### `VITE_PLANETKIT_REAL_API_SECRET`

**용도**: 실제 프로덕션 서비스용 PlanetKit 인증 정보

**발급 방법**:
- 평가 환경과 동일한 방법
- 단, Service 생성 시 **Environment: Real** 선택

**차이점**:
- **Evaluation**: 무료 테스트 환경, 제한된 리소스
- **Real**: 유료 프로덕션 환경, 안정적인 성능 보장

**언제 필요한가**:
- Conference Call 설정 화면에서 "Real Environment" 선택 시
- 실제 고객에게 서비스할 때

**코드에서 사용되는 위치**:
- `src/pages/SetupPage.tsx` - 환경 선택 UI
- `src/contexts/VideoSDKContext.tsx` - 환경별 설정 저장

**예시**:
```env
VITE_PLANETKIT_REAL_SERVICE_ID=your-real-service-id
VITE_PLANETKIT_REAL_API_KEY=12345678-1234-1234-1234-123456789abc
VITE_PLANETKIT_REAL_API_SECRET=your-real-secret-key
```

---

### 📞 Agent Call (음성 발신 기능)

Agent Call 기능을 사용하지 않는다면 이 섹션은 건너뛸 수 있습니다.

#### `LINE_CHANNEL_ID`

**용도**: LINE Messaging API를 통한 푸시 알림 발송

**발급 방법**:
1. [LINE Developers Console](https://developers.line.biz/console/) 접속
2. Provider 선택
3. "Messaging API" 채널 생성
4. "Basic settings" 탭에서 Channel ID 확인

**코드에서 사용되는 위치**:
- `api/agent-call.ts` - OAuth 토큰 발급
- LINE 푸시 알림 전송

**주의사항**:
- 🔐 **서버사이드 전용**: `VITE_` 접두사 없음 (클라이언트 노출 안됨)
- Vercel 환경 변수에 등록 필요

**예시**:
```env
LINE_CHANNEL_ID=1234567890
```

---

#### `LINE_CHANNEL_SECRET`

**용도**: LINE Messaging API OAuth 인증

**발급 방법**:
1. LINE Developers Console의 Messaging API 채널
2. "Basic settings" 탭에서 Channel Secret 확인

**코드에서 사용되는 위치**:
- `api/agent-call.ts` - OAuth 2.0 토큰 발급

**보안 주의사항**:
- 🔴 **매우 중요**: 절대 공개하지 말 것
- Vercel 환경 변수에만 저장

**예시**:
```env
LINE_CHANNEL_SECRET=abcdef1234567890abcdef1234567890
```

---

#### `PLANETKIT_AGENT_CALL_BASE_URL`

**용도**: PlanetKit Agent Call API 엔드포인트

**설정 방법**:
- **평가 환경**: `https://vpnx-stn-api.line-apps-rc.com`
- **프로덕션 환경**: `https://vpnx-stn-api.line-apps.com`

**코드에서 사용되는 위치**:
- `api/agent-call.ts` - Agent Call API 호출

**기본값**:
```env
PLANETKIT_AGENT_CALL_BASE_URL=https://vpnx-stn-api.line-apps-rc.com
```

---

#### `VITE_PLANETKIT_AUDIO_FILE_GREETING`
#### `VITE_PLANETKIT_AUDIO_FILE_RINGING`
#### `VITE_PLANETKIT_AUDIO_FILE_WAITING`

**용도**: Agent Call 시 재생할 오디오 파일 ID

**발급 방법**:
1. [LINE Planet Console](https://console.lineplanet.me/) 접속
2. Service 선택
3. "Audio Files" 메뉴 클릭
4. 오디오 파일 업로드 (MP3, WAV 등)
5. Content ID 복사

**오디오 용도**:
- **GREETING**: 전화 연결 시 인사 멘트 (예: "안녕하세요")
- **RINGING**: 상대방 호출 중 벨소리
- **WAITING**: 대기 중 음악

**코드에서 사용되는 위치**:
- `src/pages/AgentCallTrigger.tsx` - UI에서 오디오 선택
- `api/agent-call.ts` - Agent Call 요청에 포함

**예시**:
```env
VITE_PLANETKIT_AUDIO_FILE_GREETING=audio-content-id-1234
VITE_PLANETKIT_AUDIO_FILE_RINGING=audio-content-id-5678
VITE_PLANETKIT_AUDIO_FILE_WAITING=audio-content-id-9012
```

**선택사항**:
- 설정하지 않으면 기본 벨소리 사용
- 필수는 아님

---

#### `QSTASH_TOKEN`
#### `QSTASH_CURRENT_SIGNING_KEY`
#### `QSTASH_NEXT_SIGNING_KEY`

**용도**: Agent Call 자동 재시도 기능 (Upstash QStash)

**발급 방법**:
1. [Upstash Console](https://console.upstash.com/) 가입
2. QStash 메뉴 클릭
3. "API Keys" 탭에서 확인:
   - **QSTASH_TOKEN**: API 토큰
   - **QSTASH_CURRENT_SIGNING_KEY**: 현재 서명 키
   - **QSTASH_NEXT_SIGNING_KEY**: 다음 서명 키 (키 로테이션용)

**코드에서 사용되는 위치**:
- `api/agent-call.ts` - 재시도 스케줄 등록
- `api/cron/retry-agent-calls.ts` - 스케줄된 작업 실행

**기능 설명**:
- 전화 미수신 시 5분 후 자동 재발신
- 최대 3회 재시도

**선택사항**:
- Agent Call 재시도 기능을 사용하지 않으면 불필요

**예시**:
```env
QSTASH_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
QSTASH_CURRENT_SIGNING_KEY=sig_xxxxxxxxxxxxx
QSTASH_NEXT_SIGNING_KEY=sig_yyyyyyyyyyyyy
```

---

#### `CRON_SECRET`

**용도**: Cron Job API 엔드포인트 보안

**생성 방법**:
```bash
openssl rand -base64 32
```

**코드에서 사용되는 위치**:
- `api/cron/retry-agent-calls.ts` - Cron Job 인증

**설정 이유**:
- Vercel Cron Job 엔드포인트는 공개 URL
- 무단 접근 방지를 위한 비밀 토큰

**예시**:
```env
CRON_SECRET=YourRandomSecretKeyGeneratedWithOpenSSL123456==
```

---

#### `VITE_ADMIN_UIDS`

**용도**: Admin 로그 페이지 접근 제어

**설정 방법**:
1. LINE LIFF로 로그인
2. 브라우저 콘솔에서 User ID 확인:
   ```javascript
   liff.getProfile().then(profile => console.log(profile.userId));
   ```
3. User ID를 쉼표로 구분하여 나열

**코드에서 사용되는 위치**:
- `src/pages/AdminLogsPage.tsx` - 접근 권한 체크

**예시**:
```env
VITE_ADMIN_UIDS=U1234567890abcdef,Uabcdef1234567890
```

**선택사항**:
- Admin 페이지 사용 안하면 불필요

---

### 🗄️ Database (Vercel Postgres)

#### `POSTGRES_URL`

**용도**: Agent Call 세션 및 이벤트 로깅

**발급 방법**:
1. Vercel 프로젝트 대시보드
2. "Storage" 탭 클릭
3. "Create Database" → "Postgres" 선택
4. 자동으로 환경 변수 추가됨

**코드에서 사용되는 위치**:
- `api/agent-call.ts` - 세션 저장
- `api/init-agent-call-db.ts` - 테이블 초기화

**주의사항**:
- 🟢 **자동 설정**: Vercel이 자동으로 주입
- 로컬 개발 시 Vercel CLI 사용 필요: `vercel env pull .env.local`

**예시** (Vercel이 자동 생성):
```env
POSTGRES_URL=postgres://username:password@host:5432/database
```

---

## 기능별 필수 환경 변수

### 1. Conference Call (그룹 영상 통화) 최소 구성

✅ **필수 (4개)**:
```env
VITE_LIFF_ID=
VITE_PLANETKIT_EVAL_SERVICE_ID=
VITE_PLANETKIT_EVAL_API_KEY=
VITE_PLANETKIT_EVAL_API_SECRET=
```

이 4개만 설정하면 Conference Call 기본 동작 가능합니다.

---

### 2. Conference Call (프로덕션 배포)

✅ **필수 (7개)**:
```env
# 평가 환경 (개발/테스트)
VITE_LIFF_ID=
VITE_PLANETKIT_EVAL_SERVICE_ID=
VITE_PLANETKIT_EVAL_API_KEY=
VITE_PLANETKIT_EVAL_API_SECRET=

# 프로덕션 환경
VITE_PLANETKIT_REAL_SERVICE_ID=
VITE_PLANETKIT_REAL_API_KEY=
VITE_PLANETKIT_REAL_API_SECRET=
```

---

### 3. Agent Call (음성 발신) 전체 기능

✅ **필수 (15개)**:
```env
# Conference Call 기본 (위 4개)
VITE_LIFF_ID=
VITE_PLANETKIT_EVAL_SERVICE_ID=
VITE_PLANETKIT_EVAL_API_KEY=
VITE_PLANETKIT_EVAL_API_SECRET=

# LINE Messaging API
LINE_CHANNEL_ID=
LINE_CHANNEL_SECRET=

# Agent Call 설정
PLANETKIT_AGENT_CALL_BASE_URL=https://vpnx-stn-api.line-apps-rc.com

# 오디오 파일 (선택사항)
VITE_PLANETKIT_AUDIO_FILE_GREETING=
VITE_PLANETKIT_AUDIO_FILE_RINGING=
VITE_PLANETKIT_AUDIO_FILE_WAITING=

# QStash (재시도 기능)
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=

# Cron 보안
CRON_SECRET=

# Database (Vercel 자동)
POSTGRES_URL=
```

---

## 단계별 설정 프로세스

이 섹션은 **실제 구현 순서**에 따라 작성되었습니다. 처음부터 끝까지 순서대로 진행하세요.

---

### Step 1: 코드 다운로드 및 의존성 설치

```bash
# 저장소 클론
git clone https://github.com/tiger-dreams/viva-connect-test.git
cd viva-connect-test

# 의존성 설치
npm install
```

**완료 확인**:
```bash
ls -la
# package.json, src/, api/ 등이 보이면 성공
```

---

### Step 2: Vercel 가입 및 프로젝트 연결

Frontend를 배포하기 위해 Vercel을 먼저 준비합니다.

#### 2-1. Vercel 가입

1. [Vercel](https://vercel.com) 접속
2. "Sign Up" 클릭
3. GitHub 계정으로 가입 (권장)

#### 2-2. Vercel 프로젝트 생성

1. Vercel Dashboard에서 "Add New..." → "Project" 클릭
2. GitHub 저장소 연결:
   - "Import Git Repository" 선택
   - `viva-connect-test` 저장소 선택
   - "Import" 클릭
3. 프로젝트 설정:
   - **Framework Preset**: Vite 자동 감지됨
   - **Build Command**: `npm run build` (기본값)
   - **Output Directory**: `dist` (기본값)
   - **Install Command**: `npm install` (기본값)
4. "Deploy" 클릭 (환경 변수는 나중에 설정)

**배포 실패해도 괜찮습니다**: 환경 변수가 없어서 실패하지만, URL을 확보하는 것이 목적입니다.

#### 2-3. Frontend URL 확보

배포가 완료되면 (또는 실패해도) URL을 확인합니다:

**형식**: `https://your-project-name.vercel.app`

**URL 확인 방법**:
1. Vercel Dashboard → 프로젝트 선택
2. "Domains" 탭에서 기본 도메인 확인
3. 이 URL을 **메모장에 복사** (다음 단계에서 사용)

**예시**:
```
https://viva-connect-test.vercel.app
```

---

### Step 3: LINE Developers Console 설정

#### 3-1. Provider 생성

1. [LINE Developers Console](https://developers.line.biz/console/) 접속
2. LINE 비즈니스 계정으로 로그인
3. "Create" 버튼 클릭 → "Create a new provider" 선택
4. Provider 이름 입력 (예: "My Video Call App")
5. "Create" 클릭

---

### Step 4: LINE Login 채널 생성

#### 4-1. LINE Login 채널 생성

1. Provider 선택
2. "Create a LINE Login channel" 클릭
3. 채널 정보 입력:
   - **Channel name**: 앱 이름 (예: "PlanetKit Video Call")
   - **Channel description**: 설명 (예: "Video conferencing app")
   - **App types**: "Web app" 선택
4. 이메일 주소 입력
5. "Create" 클릭

#### 4-2. Channel ID 확보

1. 생성된 LINE Login 채널 선택
2. "Basic settings" 탭 클릭
3. **Channel ID** 복사 → 메모장에 저장

**형식**: `1234567890` (숫자 10자리)

---

### Step 5: LIFF 앱 생성 및 설정

#### 5-1. LIFF 앱 추가

1. LINE Login 채널 페이지에서 "LIFF" 탭 클릭
2. "Add" 버튼 클릭
3. LIFF 앱 설정:

**필수 설정**:
- **LIFF app name**: 앱 이름 (예: "Video Call")
- **Size**: **Full** 선택 ✅
- **Endpoint URL**: **Step 2-3에서 확보한 Vercel URL 입력**
  ```
  https://viva-connect-test.vercel.app
  ```
- **Scope**:
  - ✅ `profile` 선택
  - ✅ `openid` 선택
  - ✅ `email` 선택 (선택사항)

**중요 설정**:
- **Scan QR**: Off
- **Module mode**: Off (기본값)

**Bot 연결 설정 (Agent Call 기능용)**:

4. 하단의 "Add friend option" 섹션:
   - **Linked OA (Official Account)**: 아직 선택 안함 (Step 6에서 설정)
   - **On / Off button**: Off (기본값)
   - **Add friend option**:
     - ✅ **Displayed** 선택 (사용자가 친구 추가 가능)
     - "Display in top 30 tabs" → 선택 해제

5. "Add" 버튼 클릭

#### 5-2. LIFF ID 확보

1. LIFF 탭에서 생성된 LIFF 앱 확인
2. **LIFF ID** 복사 → 메모장에 저장

**형식**: `1234567890-abcdefgh`

---

### Step 6: LINE Official Account 생성 및 연결 (Agent Call 기능용)

⚠️ **Conference Call만 사용한다면 이 단계는 건너뛸 수 있습니다.**

Agent Call 기능을 사용하려면 LINE Official Account가 필요합니다.

#### 6-1. LINE Official Account (Messaging API 채널) 생성

1. Provider 페이지로 돌아가기
2. "Create a Messaging API channel" 클릭
3. 채널 정보 입력:
   - **Channel name**: Bot 이름 (예: "Video Call Bot")
   - **Channel description**: 설명
   - **Category**: "Entertainment" 등 적절한 카테고리 선택
   - **Subcategory**: 적절한 하위 카테고리 선택
4. 이메일 주소 입력
5. 약관 동의
6. "Create" 클릭

#### 6-2. Messaging API 설정

1. 생성된 Messaging API 채널 선택
2. "Messaging API" 탭 클릭
3. **Channel access token (long-lived)** 발급:
   - "Issue" 버튼 클릭
   - 토큰 복사 → 메모장에 저장
4. **Webhook URL 설정** (나중에 Step 8에서 업데이트)
   - 일단 비워두기
5. **Use webhooks**: On으로 설정
6. **Allow bot to join group chats**: Off (기본값)
7. **Auto-reply messages**: Off로 설정 (중요!)
8. **Greeting messages**: Off로 설정

#### 6-3. Channel ID와 Secret 확보

1. "Basic settings" 탭 클릭
2. **Channel ID** 복사 → 메모장에 저장 (숫자 10자리)
3. **Channel secret** 복사 → 메모장에 저장

#### 6-4. LIFF와 Official Account 연결

1. **Step 5에서 생성한 LINE Login 채널**로 돌아가기
2. "LIFF" 탭 클릭
3. 생성한 LIFF 앱 선택 (Edit)
4. "Add friend option" 섹션에서:
   - **Linked OA**: 드롭다운에서 **Step 6-1에서 생성한 Messaging API 채널** 선택
5. "Update" 버튼 클릭

**연결 확인**:
- LIFF 앱 설정에서 "Linked OA"에 Bot 이름이 표시되면 성공

---

### Step 7: LINE Planet Console 설정

#### 7-1. LINE Planet Service 생성

1. [LINE Planet Console](https://console.lineplanet.me/) 접속
2. LINE 비즈니스 계정으로 로그인 (LINE Developers와 동일 계정)
3. 좌측 메뉴에서 "Services" 클릭
4. "Create Service" 버튼 클릭
5. Service 정보 입력:
   - **Service Name**: 서비스 이름 (예: "Video Call Demo")
   - **Environment**: **Evaluation** 선택 ✅ (무료 테스트 환경)
   - **Service Type**: **Conference** 선택
6. "Create" 클릭

#### 7-2. Service ID 확보

생성된 Service 페이지에서:
- **Service ID** 표시됨 → 메모장에 복사

**형식**: `your-service-id` (문자열)

#### 7-3. API Key 생성

1. Service 페이지에서 "API Keys" 탭 클릭
2. "Generate API Key" 버튼 클릭
3. **API Key** 복사 → 메모장에 저장
4. ⚠️ **API Secret** 복사 → 메모장에 저장 (생성 직후에만 표시됨!)

**형식**:
- **API Key**: `12345678-1234-1234-1234-123456789abc` (UUID)
- **API Secret**: `your-secret-key-keep-it-safe` (긴 문자열)

---

### Step 8: LINE Planet Callback URL 설정

#### 8-1. Vercel Callback URL 확인

Vercel이 자동으로 제공하는 Serverless Function URL입니다:

**형식**:
```
https://your-project-name.vercel.app/api/agent-call
```

**예시**:
```
https://viva-connect-test.vercel.app/api/agent-call
```

이 URL은 Agent Call API 엔드포인트입니다.

#### 8-2. LINE Planet Console에 Callback URL 등록

1. LINE Planet Console의 Service 페이지
2. "Settings" 탭 클릭
3. "Callback URLs" 섹션:
   - **Callback URL** 입력란에 위 Vercel URL 입력
   - "Add" 버튼 클릭
4. "Save" 클릭

**주의**:
- Agent Call을 사용하지 않는다면 이 단계는 건너뛸 수 있습니다.
- Callback URL은 Agent Call 이벤트(연결됨, 종료됨 등)를 받는 엔드포인트입니다.

---

### Step 9: Vercel 환경 변수 설정

이제 Step 4~7에서 확보한 모든 ID와 키를 Vercel에 등록합니다.

#### 9-1. Vercel 환경 변수 추가

1. Vercel Dashboard → 프로젝트 선택
2. "Settings" 탭 클릭
3. "Environment Variables" 메뉴 클릭

#### 9-2. 필수 환경 변수 입력 (Conference Call 기본 동작)

다음 4개 변수를 추가합니다:

| Key | Value | Environment |
|-----|-------|-------------|
| `VITE_LIFF_ID` | Step 5-2에서 확보한 LIFF ID | Production, Preview, Development |
| `VITE_PLANETKIT_EVAL_SERVICE_ID` | Step 7-2에서 확보한 Service ID | Production, Preview, Development |
| `VITE_PLANETKIT_EVAL_API_KEY` | Step 7-3에서 확보한 API Key | Production, Preview, Development |
| `VITE_PLANETKIT_EVAL_API_SECRET` | Step 7-3에서 확보한 API Secret | Production, Preview, Development |

**추가 방법**:
1. "Add New" 버튼 클릭
2. **Key**: 변수 이름 입력 (예: `VITE_LIFF_ID`)
3. **Value**: 복사한 값 붙여넣기
4. **Environments**:
   - ✅ Production
   - ✅ Preview
   - ✅ Development
   모두 선택
5. "Save" 클릭
6. 나머지 3개 변수도 동일하게 추가

#### 9-3. Agent Call 환경 변수 추가 (선택사항)

Agent Call 기능을 사용한다면 추가로 다음 변수를 입력합니다:

| Key | Value | Environment |
|-----|-------|-------------|
| `LINE_CHANNEL_ID` | Step 6-3에서 확보한 Channel ID | Production, Preview, Development |
| `LINE_CHANNEL_SECRET` | Step 6-3에서 확보한 Channel Secret | Production, Preview, Development |
| `PLANETKIT_AGENT_CALL_BASE_URL` | `https://vpnx-stn-api.line-apps-rc.com` | Production, Preview, Development |

⚠️ **주의**:
- `LINE_CHANNEL_ID`와 `LINE_CHANNEL_SECRET`은 **`VITE_` 접두사 없음** (서버사이드 전용)
- Agent Call을 사용하지 않는다면 이 변수들은 생략 가능

#### 9-4. 로컬 개발 환경 변수 설정 (선택사항)

로컬에서 개발할 때는 `.env` 파일을 생성합니다:

```bash
# 프로젝트 루트에서
cp .env.example .env
```

`.env` 파일 편집:

```env
# Step 5-2: LIFF ID
VITE_LIFF_ID=1234567890-abcdefgh

# Step 7-2, 7-3: PlanetKit Evaluation
VITE_PLANETKIT_EVAL_SERVICE_ID=your-service-id
VITE_PLANETKIT_EVAL_API_KEY=12345678-1234-1234-1234-123456789abc
VITE_PLANETKIT_EVAL_API_SECRET=your-secret-key

# (선택) Step 6-3: LINE Messaging API
LINE_CHANNEL_ID=1234567890
LINE_CHANNEL_SECRET=abcdef1234567890abcdef1234567890
PLANETKIT_AGENT_CALL_BASE_URL=https://vpnx-stn-api.line-apps-rc.com
```

---

### Step 10: Vercel 재배포 및 확인

환경 변수를 설정했으므로 다시 배포합니다.

#### 10-1. 재배포

**방법 1: GitHub에 push (권장)**
```bash
git add .
git commit -m "Add environment variables"
git push origin main
```
Vercel이 자동으로 재배포합니다.

**방법 2: Vercel Dashboard에서 수동 재배포**
1. Vercel Dashboard → 프로젝트 선택
2. "Deployments" 탭
3. 최신 배포 선택 → "..." 메뉴 → "Redeploy"

#### 10-2. 배포 성공 확인

1. Vercel Dashboard에서 "Visit" 버튼 클릭
2. 브라우저에서 앱이 로드되는지 확인
3. 에러가 없으면 성공!

---

### Step 11: LIFF 앱 테스트

#### 11-1. LINE 앱에서 LIFF URL 열기

LIFF URL 생성:
```
https://liff.line.me/{LIFF_ID}
```

**예시**:
```
https://liff.line.me/1234567890-abcdefgh
```

**테스트 방법**:
1. 본인의 LINE 계정으로 위 URL을 메시지로 전송 (나에게 보내기)
2. 메시지의 링크를 탭
3. LIFF 브라우저가 열리면서 앱이 로드됨

#### 11-2. Conference Call 테스트

1. LINE 로그인 자동 완료
2. Setup 화면에서:
   - User ID와 Display Name이 자동 입력되어 있는지 확인
   - Room 선택 (예: Korea)
   - Environment: Evaluation 선택
   - "Start Conference" 버튼 클릭
3. 카메라/마이크 권한 허용
4. 본인의 영상이 화면에 표시되면 성공!

#### 11-3. 다자간 테스트 (선택사항)

두 개의 다른 디바이스에서:
1. 동일한 LIFF URL 접속
2. 동일한 Room 선택
3. Conference 시작
4. 서로의 영상이 보이는지 확인

---

### 완료! 🎉

축하합니다! 이제 LINE PlanetKit LIFF Video Call 앱이 정상적으로 동작합니다.

**다음 단계**:
- [테스트 방법](#테스트-방법) 섹션에서 더 자세한 테스트 가이드 확인
- Agent Call 기능 테스트 (Step 6 완료한 경우)
- 프로덕션 환경 설정 (Real Environment)

---

## 테스트 방법

### Conference Call 테스트

1. **단일 사용자 테스트**:
   - LIFF 브라우저에서 접속
   - Room 선택 후 Conference 시작
   - 카메라/마이크 권한 허용
   - 본인 영상이 표시되는지 확인

2. **다자간 테스트** (2명 이상):
   - 두 개의 다른 디바이스에서 접속
   - 동일한 Room 선택
   - 서로의 영상이 보이는지 확인

3. **UI 테스트**:
   - 카메라 On/Off 버튼
   - 마이크 Mute/Unmute 버튼
   - 통화 종료 버튼
   - 참가자 수 표시
   - 통화 시간 표시

---

### Agent Call 테스트

1. **발신 테스트**:
   - `/agent-call/trigger` 페이지 접속
   - 대상 LINE User ID 입력
   - "Start Call" 클릭
   - LINE 앱에서 푸시 알림 확인

2. **수신 테스트**:
   - 푸시 알림에서 "Accept" 버튼 클릭
   - `/agent-call/meeting` 페이지로 이동
   - 오디오 연결 확인

3. **재시도 테스트**:
   - 전화를 받지 않고 60초 대기
   - 5분 후 자동 재발신 확인
   - 최대 3회 재시도 동작 확인

---

## 문제 해결

### 1. LIFF 초기화 실패

**증상**: "LIFF initialization failed" 에러

**원인**:
- 잘못된 LIFF ID
- Endpoint URL 불일치

**해결**:
1. `.env`의 `VITE_LIFF_ID` 확인
2. LINE Developers Console에서 Endpoint URL 확인
3. LIFF 앱의 Scope 설정 확인 (`profile`, `openid`)

---

### 2. PlanetKit Conference 연결 실패

**증상**: "Failed to connect to conference" 에러

**원인**:
- 잘못된 Service ID/API Key
- JWT 토큰 생성 실패
- 네트워크 방화벽

**해결**:
1. `.env`의 PlanetKit 환경 변수 확인
2. 브라우저 콘솔에서 토큰 확인:
   ```javascript
   localStorage.getItem('conference-token')
   ```
3. PlanetKit Service가 활성화되어 있는지 확인

---

### 3. 환경 변수가 적용되지 않음

**증상**: `undefined` 또는 `your-xxx-here` 값이 그대로 표시됨

**원인**:
- `.env` 파일 미생성
- 서버 재시작 안함
- Vite 환경 변수 접두사 누락

**해결**:
1. `.env` 파일이 프로젝트 루트에 있는지 확인
2. 개발 서버 재시작:
   ```bash
   npm run dev
   ```
3. 클라이언트 환경 변수는 반드시 `VITE_` 접두사 사용

---

### 4. Agent Call 푸시 알림 미수신

**증상**: Agent Call 시작했지만 LINE 알림이 오지 않음

**원인**:
- LINE_CHANNEL_ID/SECRET 오류
- Messaging API 비활성화
- 대상 사용자가 친구 추가 안함

**해결**:
1. LINE Developers Console에서 Messaging API 설정 확인
2. Bot을 친구 추가했는지 확인
3. Vercel 환경 변수 확인:
   ```bash
   vercel env ls
   ```

---

### 5. Database 연결 실패

**증상**: "Database connection failed" 에러

**원인**:
- Vercel Postgres 미생성
- 환경 변수 미설정

**해결**:
1. Vercel 대시보드에서 Postgres 생성
2. 로컬 개발 시:
   ```bash
   vercel env pull .env.local
   ```
3. `POSTGRES_URL` 환경 변수 확인

---

### 6. QStash 재시도 동작 안함

**증상**: Agent Call 미수신 후 재시도 안됨

**원인**:
- QStash 토큰 오류
- Cron Job 미설정
- Database 연결 실패

**해결**:
1. Upstash Console에서 QStash 토큰 확인
2. Vercel 환경 변수 확인
3. Vercel Cron Job 설정 확인 (`vercel.json`)

---

## 추가 리소스

### 공식 문서

- [LINE Developers](https://developers.line.biz/)
- [LINE LIFF Documentation](https://developers.line.biz/en/docs/liff/overview/)
- [LINE Planet (PlanetKit)](https://docs.lineplanet.me/)
- [Vercel Documentation](https://vercel.com/docs)
- [Upstash QStash](https://upstash.com/docs/qstash)

### 프로젝트 문서

- [README.md](./README.md) - 프로젝트 개요
- [CLAUDE.md](./CLAUDE.md) - 아키텍처 및 기술 스택
- [DEPLOYMENT.md](./DEPLOYMENT.md) - 배포 가이드
- [DEV_LOG.md](./DEV_LOG.md) - 개발 히스토리

---

## 문의

프로젝트 관련 문의:
- GitHub Issues: [프로젝트 Issues 페이지](https://github.com/tiger-dreams/viva-connect-test/issues)

LINE/PlanetKit 관련 문의:
- LINE Planet Support: dl_planet_help@linecorp.com
