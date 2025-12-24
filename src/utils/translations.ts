import { Language } from '@/contexts/LanguageContext';

export interface Translations {
  // Common
  cancel: string;
  confirm: string;
  save: string;
  close: string;
  error: string;
  success: string;
  loading: string;

  // Setup Page
  setupTitle: string;
  setupDescription: string;
  liffLogin: string;
  liffLoginDescription: string;
  loginWithLine: string;
  logoutFromLine: string;
  configuration: string;
  configurationDescription: string;
  environment: string;
  environmentDescription: string;
  evaluationEnv: string;
  realEnv: string;
  serviceId: string;
  apiKey: string;
  apiSecret: string;
  userId: string;
  displayName: string;
  displayNamePlaceholder: string;
  displayNameDescription: string;
  room: string;
  roomDescription: string;
  roomJapan: string;
  roomKorea: string;
  roomTaiwan: string;
  roomThailand: string;
  tokenGeneration: string;
  tokenGenerationDescription: string;
  generateToken: string;
  tokenGenerated: string;
  tokenNotGenerated: string;
  joinMeeting: string;
  pleaseGenerateToken: string;

  // Meeting Area
  participants: string;
  duration: string;
  connecting: string;
  connected: string;
  disconnected: string;
  connectionFailed: string;
  videoOn: string;
  videoOff: string;
  audioOn: string;
  audioOff: string;
  screenShare: string;
  leaveMeeting: string;
  localUser: string;
  remoteUser: string;
  you: string;
  speaking: string;

  // Config Panel
  planetkitConfig: string;
  planetkitConfigDescription: string;
  requiredFields: string;
  optionalFields: string;
  currentConfig: string;
  notConfigured: string;
  tokenStatus: string;

  // Errors
  tokenGenerationFailed: string;
  connectionError: string;
  mediaDeviceError: string;
  permissionDenied: string;

  // Toast messages
  tokenGeneratedSuccess: string;
  configSaved: string;
  joinedMeeting: string;
  leftMeeting: string;
}

export const translations: Record<Language, Translations> = {
  ko: {
    // Common
    cancel: '취소',
    confirm: '확인',
    save: '저장',
    close: '닫기',
    error: '오류',
    success: '성공',
    loading: '로딩 중...',

    // Setup Page
    setupTitle: 'Viva Connect - 화상회의 설정',
    setupDescription: '화상회의를 시작하기 위해 아래 설정을 완료하세요.',
    liffLogin: 'LINE 로그인',
    liffLoginDescription: 'LINE 계정으로 로그인하여 프로필 정보를 자동으로 가져옵니다.',
    loginWithLine: 'LINE으로 로그인',
    logoutFromLine: 'LINE 로그아웃',
    configuration: '설정',
    configurationDescription: 'PlanetKit 환경 및 방 설정을 구성합니다.',
    environment: '환경',
    environmentDescription: 'Evaluation 환경은 테스트용, Real 환경은 실제 서비스용입니다.',
    evaluationEnv: '평가 환경 (테스트)',
    realEnv: '실제 환경 (프로덕션)',
    serviceId: '서비스 ID',
    apiKey: 'API Key',
    apiSecret: 'API Secret',
    userId: '사용자 ID',
    displayName: '표시 이름',
    displayNamePlaceholder: '표시 이름을 입력하세요',
    displayNameDescription: '다른 참가자에게 표시될 이름입니다. (LINE 프로필 이름이 자동 설정됨)',
    room: '방',
    roomDescription: '참여할 방을 선택하세요. 같은 방의 사용자들끼리 통화할 수 있습니다.',
    roomJapan: '일본',
    roomKorea: '한국',
    roomTaiwan: '대만',
    roomThailand: '태국',
    tokenGeneration: '토큰 생성',
    tokenGenerationDescription: '회의 참여를 위한 액세스 토큰을 생성합니다.',
    generateToken: '토큰 생성',
    tokenGenerated: '토큰이 생성되었습니다',
    tokenNotGenerated: '토큰이 생성되지 않았습니다',
    joinMeeting: '회의 참여',
    pleaseGenerateToken: '먼저 토큰을 생성해주세요.',

    // Meeting Area
    participants: '참가자',
    duration: '통화 시간',
    connecting: '연결 중...',
    connected: '연결됨',
    disconnected: '연결 끊김',
    connectionFailed: '연결 실패',
    videoOn: '비디오 켜기',
    videoOff: '비디오 끄기',
    audioOn: '오디오 켜기',
    audioOff: '오디오 끄기',
    screenShare: '화면 공유',
    leaveMeeting: '회의 나가기',
    localUser: '나',
    remoteUser: '참가자',
    you: '나',
    speaking: '말하는 중',

    // Config Panel
    planetkitConfig: 'PlanetKit 설정',
    planetkitConfigDescription: '환경, 방, 토큰 등을 설정합니다.',
    requiredFields: '필수 항목',
    optionalFields: '선택 항목',
    currentConfig: '현재 설정',
    notConfigured: '설정되지 않음',
    tokenStatus: '토큰 상태',

    // Errors
    tokenGenerationFailed: '토큰 생성에 실패했습니다',
    connectionError: '연결 오류가 발생했습니다',
    mediaDeviceError: '미디어 장치에 접근할 수 없습니다',
    permissionDenied: '권한이 거부되었습니다',

    // Toast messages
    tokenGeneratedSuccess: '토큰이 성공적으로 생성되었습니다',
    configSaved: '설정이 저장되었습니다',
    joinedMeeting: '회의에 참여했습니다',
    leftMeeting: '회의에서 나갔습니다',
  },
  en: {
    // Common
    cancel: 'Cancel',
    confirm: 'Confirm',
    save: 'Save',
    close: 'Close',
    error: 'Error',
    success: 'Success',
    loading: 'Loading...',

    // Setup Page
    setupTitle: 'Viva Connect - Video Conference Setup',
    setupDescription: 'Complete the setup below to start your video conference.',
    liffLogin: 'LINE Login',
    liffLoginDescription: 'Log in with your LINE account to automatically import your profile information.',
    loginWithLine: 'Login with LINE',
    logoutFromLine: 'Logout from LINE',
    configuration: 'Configuration',
    configurationDescription: 'Configure PlanetKit environment and room settings.',
    environment: 'Environment',
    environmentDescription: 'Evaluation environment is for testing, Real environment is for production.',
    evaluationEnv: 'Evaluation (Testing)',
    realEnv: 'Real (Production)',
    serviceId: 'Service ID',
    apiKey: 'API Key',
    apiSecret: 'API Secret',
    userId: 'User ID',
    displayName: 'Display Name',
    displayNamePlaceholder: 'Enter your display name',
    displayNameDescription: 'The name that will be displayed to other participants. (LINE profile name is set automatically)',
    room: 'Room',
    roomDescription: 'Select a room to join. Users in the same room can communicate with each other.',
    roomJapan: 'Japan',
    roomKorea: 'Korea',
    roomTaiwan: 'Taiwan',
    roomThailand: 'Thailand',
    tokenGeneration: 'Token Generation',
    tokenGenerationDescription: 'Generate an access token to join the meeting.',
    generateToken: 'Generate Token',
    tokenGenerated: 'Token has been generated',
    tokenNotGenerated: 'Token has not been generated',
    joinMeeting: 'Join Meeting',
    pleaseGenerateToken: 'Please generate a token first.',

    // Meeting Area
    participants: 'Participants',
    duration: 'Duration',
    connecting: 'Connecting...',
    connected: 'Connected',
    disconnected: 'Disconnected',
    connectionFailed: 'Connection Failed',
    videoOn: 'Turn On Video',
    videoOff: 'Turn Off Video',
    audioOn: 'Turn On Audio',
    audioOff: 'Turn Off Audio',
    screenShare: 'Share Screen',
    leaveMeeting: 'Leave Meeting',
    localUser: 'Me',
    remoteUser: 'Participant',
    you: 'You',
    speaking: 'Speaking',

    // Config Panel
    planetkitConfig: 'PlanetKit Configuration',
    planetkitConfigDescription: 'Configure environment, room, token, etc.',
    requiredFields: 'Required Fields',
    optionalFields: 'Optional Fields',
    currentConfig: 'Current Configuration',
    notConfigured: 'Not Configured',
    tokenStatus: 'Token Status',

    // Errors
    tokenGenerationFailed: 'Failed to generate token',
    connectionError: 'Connection error occurred',
    mediaDeviceError: 'Cannot access media devices',
    permissionDenied: 'Permission denied',

    // Toast messages
    tokenGeneratedSuccess: 'Token generated successfully',
    configSaved: 'Configuration saved',
    joinedMeeting: 'Joined meeting',
    leftMeeting: 'Left meeting',
  },
};

export const getTranslations = (language: Language): Translations => {
  return translations[language];
};
