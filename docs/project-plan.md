# Video SDK 테스트 앱 기획서

## 프로젝트 개요
Agora와 Zoom Video SDK Web 버전을 테스트할 수 있는 개발자용 그룹 화상회의 테스트 앱

## 주요 기능

### 1. SDK 설정 관리
- **Agora 설정**
  - App ID 입력
  - App Certificate 입력 
  - Channel Name 설정
  - UID 설정
- **Zoom 설정**
  - SDK Key 입력
  - SDK Secret 입력
  - Session Name 설정
  - User Name 설정

### 2. Token 생성 기능
- **Agora Token 생성**
  - RTC Token 생성 (채널 접속용)
  - 만료 시간 설정 가능
  - 권한 설정 (Publisher/Subscriber)
- **Zoom Token 생성**
  - JWT Token 생성 (세션 접속용)
  - 세션 정보 포함

### 3. 화상회의 테스트 기능
- **멀티 SDK 지원**
  - Agora와 Zoom SDK 선택 가능
  - 실시간 SDK 전환 테스트
- **기본 화상회의 기능**
  - 카메라 On/Off
  - 마이크 On/Off
  - 화면 공유
  - 참가자 목록 표시
- **테스트 도구**
  - 네트워크 상태 표시
  - 프레임률, 해상도 정보
  - 연결 품질 표시

### 4. 사용자 인터페이스
- **설정 패널**
  - SDK 선택 탭 (Agora/Zoom)
  - 인증 정보 입력 폼
  - Token 생성 버튼
- **회의 화면**
  - 메인 비디오 영역
  - 참가자 그리드 뷰
  - 컨트롤 패널 (음소거, 비디오, 화면공유)
- **디버그 패널**
  - 연결 상태 정보
  - 로그 표시
  - 성능 메트릭

## 기술 스택
- **Frontend**: React + TypeScript + Tailwind CSS
- **Video SDKs**: 
  - Agora Web SDK 4.x
  - Zoom Video SDK for Web
- **Token 생성**: 클라이언트 사이드 JWT 라이브러리
- **상태 관리**: React Context + localStorage

## UI/UX 디자인 방향
- **컬러 스킴**: 
  - Primary: 기술적이고 전문적인 블루 톤 (#2563eb)
  - Secondary: 중성적인 그레이 톤
  - Accent: 성공/오류 표시용 그린/레드
- **레이아웃**: 
  - 좌측 설정 패널, 우측 화상회의 영역
  - 반응형 디자인으로 모바일에서도 테스트 가능
- **애니메이션**: 
  - 부드러운 전환 효과
  - 로딩 상태 표시
  - 연결 상태 시각적 피드백

## 개발 우선순위
1. **Phase 1**: 기본 UI 구조 및 설정 패널
2. **Phase 2**: Agora SDK 통합 및 Token 생성
3. **Phase 3**: Zoom SDK 통합 및 Token 생성  
4. **Phase 4**: 화상회의 기본 기능 구현
5. **Phase 5**: 디버그 도구 및 성능 모니터링

## 보안 고려사항
- API Key/Secret은 localStorage에 저장 (개발용이므로)
- Token은 임시 저장 후 자동 삭제
- 민감 정보 브라우저 콘솔 출력 방지

## 참고 자료
- [Agora Video SDK 샘플](https://github.com/AgoraIO/video-sdk-samples-js)
- [Zoom Video SDK 샘플](https://github.com/zoom/videosdk-web-sample)
- [Agora Token 생성 가이드](https://docs.agora.io/en/Video/token_server?platform=All%20Platforms)
- [Zoom JWT 생성 가이드](https://marketplace.zoom.us/docs/sdk/video/web)