# PlanetKit LIFF 앱 개발 핸즈온 가이드

LINE PlanetKit Web SDK와 LIFF를 활용한 그룹 화상통화 앱 개발 실습

---

## 📋 사전 준비물

### 필수 항목
- [ ] **Node.js 18+** 설치 ([다운로드](https://nodejs.org/))
- [ ] **GitHub 계정** ([가입](https://github.com/signup))
- [ ] **Vercel 계정** ([가입](https://vercel.com/signup))
- [ ] **LINE Developers 계정** ([가입](https://developers.line.biz/))
- [ ] **코드 에디터** (VS Code 권장)

### PlanetKit 인증 정보 발급
1. [LINE Planet Console](https://planet.line-apps.com/) 접속
2. Service 생성
3. **Service ID**, **API Key**, **API Secret** 발급
4. Evaluation 환경 정보 기록

---

## Phase 1: 로컬 개발 및 기본 기능

### Step 1: 프로젝트 셋업

#### 1-1. 프로젝트 클론
```bash
# 템플릿 클론
git clone https://github.com/YOUR_USERNAME/viva-connect-test.git
cd viva-connect-test

# 의존성 설치
npm install
```

#### 1-2. 환경 변수 설정
`.env` 파일 생성:

```env
# PlanetKit Evaluation Environment
VITE_PLANETKIT_EVAL_SERVICE_ID=your-eval-service-id
VITE_PLANETKIT_EVAL_API_KEY=your-eval-api-key
VITE_PLANETKIT_EVAL_API_SECRET=your-eval-api-secret

# LIFF (나중에 추가)
# VITE_LIFF_ID=
```

**✅ 체크포인트**: `.env` 파일에 Service ID, API Key, API Secret이 올바르게 입력되었는지 확인

---

### Step 2: Access Token 인증 개발

PlanetKit은 JWT 기반 인증을 사용합니다. 클라이언트에서 토큰을 생성하는 방법을 알아봅니다.

#### 2-1. 토큰 생성 함수 구조 이해

`src/utils/token-generator.ts` 파일 확인:

```typescript
import * as jose from 'jose';

export async function generatePlanetKitToken(
  serviceId: string,
  apiKey: string,
  userId: string,
  roomId: string,
  expiresIn: number = 3600,
  apiSecret?: string
): Promise<string> {
  // JWT Payload 구성
  const payload = {
    service_id: serviceId,
    user_id: userId,
    room_id: roomId,
    // ... 권한 설정
  };

  // API Secret으로 서명
  const secret = new TextEncoder().encode(apiSecret || apiKey);
  const token = await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(secret);

  return token;
}
```

**💡 핵심 개념**:
- `service_id`: PlanetKit Service 식별
- `user_id`: 사용자 고유 ID (LINE User ID 사용 예정)
- `room_id`: 그룹 통화방 식별
- `HS256` 알고리즘으로 서명

#### 2-2. 토큰 생성 테스트

`src/pages/SetupPage.tsx`에서 토큰 생성 로직 확인:

```typescript
const handleGenerateToken = async () => {
  if (!planetKitConfig.roomId) {
    toast({
      title: "Room 선택 필요",
      description: "참여할 Room을 선택해주세요.",
      variant: "destructive",
    });
    return;
  }

  try {
    const token = await generatePlanetKitToken(
      planetKitConfig.serviceId,
      planetKitConfig.apiKey,
      planetKitConfig.userId,
      planetKitConfig.roomId,
      3600,
      planetKitConfig.apiSecret
    );

    setPlanetKitConfig(prev => ({
      ...prev,
      accessToken: token
    }));

    toast({
      title: "토큰 생성 성공",
      description: "이제 화상회의에 참여할 수 있습니다.",
    });
  } catch (error) {
    toast({
      title: "토큰 생성 실패",
      description: error.message,
      variant: "destructive",
    });
  }
};
```

**✅ 체크포인트**: 토큰 생성 로직의 흐름 이해

---

### Step 3: 기본 웹 서비스 개발

#### 3-1. 로컬 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:8080` 접속

#### 3-2. 화상통화 기본 흐름 이해

**Setup 페이지** (`src/pages/SetupPage.tsx`):
1. 사용자 정보 입력 (userId, displayName)
2. Room ID 선택
3. Access Token 생성
4. 회의 참가

**Meeting 페이지** (`src/pages/PlanetKitMeeting.tsx`):

```typescript
// PlanetKit SDK 초기화
const conference = useMemo(() => {
  if (!PlanetKitManager || !isReady || !config) return null;

  return PlanetKitManager.createConference({
    serviceId: config.serviceId,
    roomId: config.roomId,
  });
}, [PlanetKitManager, isReady, config]);

// 회의 연결
const connectToConference = async () => {
  if (!conference) return;

  try {
    await conference.connect({
      accessToken: config.accessToken,
      myMediaStatus: {
        audio: true,
        video: true,
      },
      userData: {
        displayName: config.displayName,
      },
    });
  } catch (error) {
    console.error('Failed to connect:', error);
  }
};

// 비디오 토글
const toggleVideo = () => {
  if (localVideoEnabled) {
    conference?.muteMyVideo();
  } else {
    conference?.unmuteMyVideo();
  }
  setLocalVideoEnabled(!localVideoEnabled);
};

// 오디오 토글
const toggleAudio = () => {
  if (localAudioEnabled) {
    conference?.muteMyAudio();
  } else {
    conference?.unmuteMyAudio();
  }
  setLocalAudioEnabled(!localAudioEnabled);
};
```

#### 3-3. 테스트 시나리오

**시나리오 1: 단일 사용자 테스트**
1. User ID 입력: `test-user-1`
2. Display Name 입력: `테스터1`
3. Room 선택: `korea`
4. 토큰 생성 → 참여하기
5. 카메라/마이크 권한 허용
6. 비디오가 정상적으로 보이는지 확인

**시나리오 2: 다중 사용자 테스트**
1. 첫 번째 브라우저 탭: `test-user-1` / `korea` 룸 접속
2. 두 번째 브라우저 탭: `test-user-2` / `korea` 룸 접속
3. 서로의 비디오/오디오가 보이는지 확인
4. 비디오/오디오 토글 테스트

**✅ 체크포인트**:
- [ ] 로컬에서 통화 연결 성공
- [ ] 다중 사용자 간 통화 가능
- [ ] 비디오/오디오 토글 정상 작동

---

## Phase 2: 배포 및 PlanetKit 연동

### Step 4: Vercel 배포

#### 4-1. GitHub에 푸시

```bash
# 새 GitHub Repository 생성 후
git remote set-url origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git add .
git commit -m "Initial commit: PlanetKit LIFF app"
git push -u origin main
```

#### 4-2. Vercel 프로젝트 생성

1. [Vercel Dashboard](https://vercel.com/dashboard) 접속
2. **"Add New Project"** 클릭
3. GitHub Repository 선택
4. **Environment Variables** 설정:

```env
VITE_PLANETKIT_EVAL_SERVICE_ID=your-eval-service-id
VITE_PLANETKIT_EVAL_API_KEY=your-eval-api-key
VITE_PLANETKIT_EVAL_API_SECRET=your-eval-api-secret
```

5. **Deploy** 클릭
6. 배포 완료 후 URL 복사 (예: `https://your-app.vercel.app`)

**✅ 체크포인트**:
- [ ] Vercel 배포 성공
- [ ] 배포 URL로 접속 가능

---

### Step 5: CORS 등록 ⚠️ **중요!**

배포된 앱이 PlanetKit API를 호출하려면 CORS 설정이 필수입니다.

#### 5-1. PlanetKit Console에서 CORS 등록

1. [LINE Planet Console](https://planet.line-apps.com/) 접속
2. 해당 Service 선택
3. **Settings** → **CORS Origins** 메뉴
4. Vercel URL 추가:
   ```
   https://your-app.vercel.app
   ```
5. 저장

**💡 참고**:
- `http://localhost:8080`도 함께 등록하면 로컬 개발이 편리합니다
- 와일드카드(`*`)는 보안상 권장하지 않습니다

#### 5-2. CORS 설정 확인

배포된 URL에 접속하여 통화 연결 테스트:

1. `https://your-app.vercel.app` 접속
2. 테스트 계정으로 로그인
3. Room 참여 시도
4. 브라우저 DevTools Console에서 CORS 에러 없는지 확인

**✅ 체크포인트**:
- [ ] CORS origin 등록 완료
- [ ] 배포 URL에서 통화 연결 성공

---

## Phase 3: LINE 플랫폼 연동

### Step 6: LINE Developers 계정 및 채널 생성

#### 6-1. Provider 생성

1. [LINE Developers Console](https://developers.line.biz/console/) 접속
2. **"Create a new provider"** 클릭
3. Provider 이름 입력 (예: `My Company`)

#### 6-2. Messaging API 채널 생성

1. Provider 페이지에서 **"Create a Messaging API channel"** 클릭
2. 채널 정보 입력:
   - **Channel name**: `PlanetKit Video Call`
   - **Channel description**: `Group video conferencing app`
   - **Category**: Communication
   - **Subcategory**: Video call
3. 약관 동의 후 **"Create"** 클릭

**💡 참고**: Messaging API 채널을 만들면 LINE Official Account(OA)가 자동으로 생성됩니다.

#### 6-3. Channel Access Token 발급

1. 생성된 채널 선택
2. **"Messaging API"** 탭으로 이동
3. **"Channel access token (long-lived)"** 섹션에서 **"Issue"** 클릭
4. 토큰 복사 (나중에 사용)

**✅ 체크포인트**:
- [ ] Messaging API 채널 생성 완료
- [ ] Channel Access Token 발급 완료

---

### Step 7: LIFF 앱 등록

#### 7-1. LIFF 앱 추가

1. 채널 페이지에서 **"LIFF"** 탭으로 이동
2. **"Add"** 버튼 클릭
3. LIFF 앱 정보 입력:

```
LIFF app name: PlanetKit Video Call
Size: Full
Endpoint URL: https://your-app.vercel.app
Scope:
  ✅ profile
  ✅ openid
Module mode: Off (권장)
```

4. **"Add"** 클릭
5. **LIFF ID** 복사 (예: `2008742005-3DHkWzkg`)

#### 7-2. LIFF ID 환경변수 추가

**Vercel Dashboard**:
1. 프로젝트 → **Settings** → **Environment Variables**
2. 새 변수 추가:
   ```
   VITE_LIFF_ID=2008742005-3DHkWzkg
   ```
3. **Save** 후 **Redeploy** (재배포 필요!)

**로컬 개발용** (`.env` 파일):
```env
VITE_LIFF_ID=2008742005-3DHkWzkg
```

#### 7-3. LIFF 초기화 코드 확인

`src/contexts/LiffContext.tsx`에서 자동 초기화:

```typescript
useEffect(() => {
  const autoInitLiff = async () => {
    // 1. 환경 변수에서 LIFF ID 확인
    let id = import.meta.env.VITE_LIFF_ID;

    // 2. 없으면 localStorage에서 확인
    if (!id) {
      id = localStorage.getItem('liffId');
    }

    // 3. 둘 다 없으면 사용자 입력 필요
    if (!id) {
      setNeedsLiffId(true);
      return;
    }

    // 4. LIFF ID가 있으면 자동 초기화
    await liff.init({ liffId: id });

    if (liff.isLoggedIn()) {
      // 프로필 정보 가져오기
      const userProfile = await liff.getProfile();
      setProfile({
        userId: userProfile.userId,
        displayName: userProfile.displayName,
        pictureUrl: userProfile.pictureUrl,
      });
    }
  };

  autoInitLiff();
}, []);
```

**✅ 체크포인트**:
- [ ] LIFF 앱 등록 완료
- [ ] LIFF ID 환경변수 추가 완료
- [ ] Vercel 재배포 완료

---

### Step 8: OA 연동 및 테스트

#### 8-1. OA 친구 추가

1. LINE Developers Console → 채널 → **Messaging API** 탭
2. **QR code** 스캔하여 OA 친구 추가

또는:

1. **Bot basic ID** 확인 (예: `@123abcde`)
2. LINE 앱에서 ID로 검색하여 친구 추가

#### 8-2. LIFF 앱 실행 URL 생성

LIFF 앱 URL 형식:
```
https://liff.line.me/{LIFF_ID}
```

예시:
```
https://liff.line.me/2008742005-3DHkWzkg
```

#### 8-3. Rich Menu 또는 버튼으로 LIFF 실행

**방법 1: 직접 URL 공유**
```
LINE 채팅에서 LIFF URL 전송 → 링크 클릭
```

**방법 2: Rich Menu 설정** (권장)
1. LINE Developers Console → 채널 → **Rich menu** 탭
2. **Create** 클릭
3. 메뉴 디자인 및 동작 설정:
   - Action type: `Link`
   - Action URI: `https://liff.line.me/{LIFF_ID}`

#### 8-4. 최종 테스트 시나리오

**시나리오 1: LIFF 로그인 테스트**
1. LINE 앱에서 OA 채팅방 진입
2. LIFF 앱 URL 클릭
3. LIFF 앱이 열리고 자동 로그인 확인
4. 프로필 정보 (이름, 사진) 표시 확인

**시나리오 2: 화상통화 테스트**
1. Room ID 선택 (예: `korea`)
2. 토큰 생성 → 참여하기
3. 카메라/마이크 권한 허용
4. 다른 사용자와 통화 테스트

**시나리오 3: 딥링크 테스트**
1. 딥링크 URL 생성:
   ```
   https://liff.line.me/{LIFF_ID}?liff.state=/setup?room=test-room-123
   ```
2. URL 전송 → 클릭
3. 자동으로 `test-room-123` 룸 선택 확인
4. 토큰 자동 생성 및 참여 확인

**✅ 최종 체크포인트**:
- [ ] LINE 앱에서 LIFF 실행 성공
- [ ] 자동 로그인 및 프로필 표시 확인
- [ ] 화상통화 연결 성공
- [ ] 다중 사용자 통화 테스트 성공
- [ ] 딥링크 자동 입장 테스트 성공

---

## 🎯 주요 체크포인트 요약

### Phase 1: 로컬 개발
- [x] 환경변수 설정 완료
- [x] 로컬에서 통화 연결 성공
- [x] 비디오/오디오 기본 기능 작동

### Phase 2: 배포
- [x] Vercel 배포 성공
- [x] CORS origin 등록 완료
- [x] 배포 URL에서 통화 성공

### Phase 3: LINE 연동
- [x] LINE 채널 생성 완료
- [x] LIFF 앱 등록 완료
- [x] LINE 앱에서 LIFF 실행 성공
- [x] 최종 화상통화 테스트 성공

---

## 🔧 트러블슈팅

### 1. CORS 에러
```
Access to fetch at 'https://...' from origin 'https://your-app.vercel.app'
has been blocked by CORS policy
```

**해결방법**:
- PlanetKit Console에서 Vercel URL을 CORS origin에 추가
- 정확한 URL 형식 확인 (trailing slash 없음)

### 2. LIFF 초기화 실패
```
Error: LIFF ID is not valid
```

**해결방법**:
- LIFF ID 형식 확인 (`숫자-영숫자` 형태)
- 환경변수 이름 확인: `VITE_LIFF_ID`
- Vercel 재배포 후 Hard Refresh (Ctrl+Shift+R)

### 3. 토큰 생성 오류
```
Token generation failed: Invalid signature
```

**해결방법**:
- Service ID, API Key, API Secret 재확인
- 환경변수 오타 확인
- Evaluation vs Real 환경 확인

### 4. 화상통화 연결 실패
```
Failed to connect to conference
```

**해결방법**:
- 브라우저 권한 설정 확인 (카메라/마이크)
- 네트워크 연결 확인
- 브라우저 콘솔에서 상세 에러 확인
- HTTPS 환경에서만 작동 (로컬은 localhost 허용)

---

## 📚 추가 학습 자료

### PlanetKit 공식 문서
- [PlanetKit Web SDK Guide](https://docs.planet.line-apps.com/)
- [Group Call API Reference](https://docs.planet.line-apps.com/api-reference)

### LINE LIFF 공식 문서
- [LIFF Overview](https://developers.line.biz/en/docs/liff/overview/)
- [LIFF API Reference](https://developers.line.biz/en/reference/liff/)

### 이 프로젝트의 주요 파일
- `src/pages/SetupPage.tsx` - 설정 페이지 (Room 선택, 토큰 생성)
- `src/pages/PlanetKitMeeting.tsx` - 화상통화 페이지
- `src/contexts/LiffContext.tsx` - LIFF 상태 관리
- `src/contexts/VideoSDKContext.tsx` - PlanetKit 설정 관리
- `src/utils/token-generator.ts` - JWT 토큰 생성

---

## 🎉 수고하셨습니다!

이제 LINE PlanetKit을 활용한 그룹 화상통화 LIFF 앱 개발의 전체 과정을 완료했습니다.

**다음 단계**:
1. 커스텀 UI 디자인 적용
2. 화면 공유 기능 추가
3. 채팅 기능 통합
4. 프로덕션 배포 (서버 사이드 토큰 생성)
5. 성능 최적화 및 모니터링

질문이나 문제가 있으면 [GitHub Issues](https://github.com/YOUR_USERNAME/YOUR_REPO/issues)에 남겨주세요!
