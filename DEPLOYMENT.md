# 🚀 배포 가이드

이 Video SDK 테스트 앱을 웹에 배포하는 방법들입니다.

## ⭐ 추천: Vercel (가장 쉬움)

### 1단계: GitHub 푸시
```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

### 2단계: Vercel 배포
1. [vercel.com](https://vercel.com) 접속
2. "Import Project" 클릭
3. GitHub 레포지토리 선택
4. "Deploy" 클릭
5. 몇 분 후 HTTPS 사이트 완성! 🎉

**장점**:
- ✅ 자동 HTTPS
- ✅ 무료 사용
- ✅ Git push 시 자동 재배포
- ✅ WebRTC 완벽 지원

---

## 🟢 대안 1: Netlify

### 방법 A: 드래그 앤 드롭
```bash
npm run build
# dist 폴더를 netlify.com에 드래그 앤 드롭
```

### 방법 B: Git 연동
1. [netlify.com](https://netlify.com) 접속
2. "Import from Git" 선택
3. GitHub 레포지토리 연결

---

## 🟡 대안 2: GitHub Pages

### 설정
1. GitHub 레포지토리 Settings > Pages
2. Source: "GitHub Actions" 선택
3. Git push하면 자동 배포

**주의**: `.github/workflows/deploy.yml` 파일이 이미 생성되어 있습니다.

---

## 🟠 대안 3: Cloudflare Pages

1. [pages.cloudflare.com](https://pages.cloudflare.com) 접속
2. "Create a project" 클릭
3. GitHub 연결
4. Build settings:
   - Build command: `npm run build`
   - Output directory: `dist`

---

## 📱 HTTPS 필수 이유

WebRTC(화상회의)는 보안상 HTTPS가 반드시 필요합니다:
- 카메라/마이크 접근 권한
- P2P 연결 보안
- 브라우저 정책 준수

**localhost**에서는 HTTP로도 작동하지만, **배포 시에는 HTTPS 필수**입니다.

---

## 🎯 추천 순서

1. **Vercel** - 가장 쉽고 빠름
2. **Netlify** - 두 번째 선택
3. **Cloudflare Pages** - 성능 중시
4. **GitHub Pages** - GitHub 생태계 선호 시

모든 옵션이 **무료**이고 **HTTPS를 자동 지원**합니다! 🚀