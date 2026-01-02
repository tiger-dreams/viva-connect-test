# Release Notes - LIFF Demo

All release notes for the LIFF Demo project.

---

## 🎉 Version 1.2.0 - January 2, 2026

### 🎨 UI/UX Improvements

**Speaking Indicator Enhancement**
- Video grid now highlights the speaking participant with a prominent border
- Makes it easy to identify who is currently talking at a glance
- Improved visual feedback for better meeting experience

### 🐛 Bug Fixes

**First-Time Room Join Failure Fixed**
- Resolved intermittent connection failure when joining a room for the first time
- Fixed issue occurring with fresh browser sessions or new devices
- Optimized SetupPage rendering to prevent state management conflicts
- Users can now reliably join rooms on their first attempt

### ⚙️ Technical Improvements

**API Consolidation**
- Reduced serverless function count from 15 to 11 (Vercel Hobby plan optimization)
- Consolidated Web Push APIs (3 → 1 unified endpoint with query parameters)
- Consolidated Agent Call APIs (2 → 1 unified endpoint with query parameters)
- Improved deployment stability and response time
- Better resource utilization and cost efficiency

**Performance Optimization**
- Eliminated unnecessary useEffect re-renders in SetupPage
- Improved initial page load stability
- Enhanced token generation reliability
- Reduced console log spam for cleaner debugging

### 🚀 Deployment

**Affected Environments**: Beta and Production
**Platforms**: All browsers (Desktop, Mobile, WebView)
**Deployment URL**: https://viva-connect-test.vercel.app

---

## 🎉 Version 1.1.0 - December 28, 2025

### NEW: Agent Call (Audio Caller)

Make outbound audio calls to LINE users with automatic retry system!

#### 📱 How It Works:

**1. Initiate Call**
- Navigate to `/agent-call` in LIFF
- Call initiated automatically
- LIFF window closes after 2 seconds ✨

**2. Receive Call**
- LINE notification: "📞 Incoming call!"
- **Time limit clearly displayed: "Please accept within 60 seconds"**
- Tap "Accept Call" button
- **Instantly connects to call** (no additional steps needed) ✨

**3. Call Timeout & Retry**
- If unanswered for 60 seconds, notification sent
- Option: "Retry in 5 min" button
- Confirmation: "You will receive a call in about 5 minutes"
- **Automatic retry call after 5 minutes** ✨
- Maximum 3 retry attempts

**4. Call End**
- **Automatically redirects to setup page** ✨

#### 🌍 Multi-Language Support

Now supporting **international users** with English as default!

**Supported Languages:**
- **Korean** (language='ko'): "📞 전화가 왔습니다! 60초 이내에 수락해주세요."
- **English** (default): "📞 Incoming call! Please accept within 60 seconds."

Perfect for users in **Taiwan, Thailand**, and other regions!

#### 🎯 Key Features

**Seamless User Experience**
- ✅ **One-click call acceptance** - No manual steps after tapping button
- ✅ **Clear time limits** - 60-second warning prevents confusion
- ✅ **Smart retry system** - Automatic redialing with 5-minute delay
- ✅ **Auto-close & redirect** - Smooth navigation throughout call flow

**Intelligent Retry System**
- ✅ **User-initiated retry** - Choose when to receive retry call
- ✅ **Immediate confirmation** - Know exactly when to expect the call
- ✅ **Relative time display** - "in about 5 minutes" (no timezone confusion)
- ✅ **Busy detection** - Won't retry if already in another call
- ✅ **Retry limit** - Maximum 3 attempts to prevent spam

#### 🔧 Technical Highlights

**Infrastructure**
- **Upstash QStash** integration for scheduled retries
- **Database-driven** language selection
- **LIFF profile-based** automatic configuration
- **Vercel Serverless Functions** for scalable API

**User Flow Optimization**
```
Initiate → Auto-close (2s)
  ↓
LINE Message → Tap Button → Instant Connection
  ↓
Timeout (60s) → Retry Option → Auto-retry (5 min)
  ↓
End Call → Auto-redirect to Setup
```

#### 📋 Configuration

Required environment variables:
```bash
# PlanetKit Agent Call
VITE_PLANETKIT_EVAL_SERVICE_ID=your-service-id
VITE_PLANETKIT_EVAL_API_KEY=your-api-key
VITE_PLANETKIT_EVAL_API_SECRET=your-api-secret
PLANETKIT_AGENT_CALL_BASE_URL=https://vpnx-stn-api.line-apps-rc.com

# Audio Files (upload to LINE Planet Console first)
VITE_PLANETKIT_AUDIO_FILE_GREETING=contentId-for-greeting

# LINE Messaging API
LINE_CHANNEL_ID=your-channel-id
LINE_CHANNEL_SECRET=your-channel-secret

# Upstash QStash (for retry system)
QSTASH_TOKEN=your-qstash-token
```

#### 🚀 Getting Started

1. **Upload Audio Files**
   - Go to [LINE Planet Console](https://planet.line-apps.com/)
   - Upload greeting audio file
   - Copy the contentId

2. **Configure Environment**
   - Set all required environment variables
   - Deploy to Vercel or your hosting platform

3. **Test the Flow**
   - Open `/agent-call` in LIFF
   - Initiate call
   - Receive and accept call notification
   - Experience seamless connection!

#### 🔒 Privacy & Security

- **Local token generation** (for demo/testing only)
- **Secure API authentication** with PlanetKit credentials
- **LIFF authentication** through LINE Platform
- **User consent required** for all retry attempts

⚠️ **Production Note**: Implement server-side token generation before going live.

#### 📚 Use Cases

Perfect for:
- 🏥 **Healthcare**: Patient appointment reminders with callback option
- 💼 **Customer Service**: Automated outreach with retry for busy customers
- 🎓 **Education**: Class notifications with smart retry system
- 🛍️ **E-commerce**: Order confirmations with callback option

#### 🆕 What's New Summary

| Feature | Description | Status |
|---------|-------------|--------|
| Auto-close LIFF | Window closes after call initiation | ✅ Live |
| Auto-accept call | Instant connection on button tap | ✅ Live |
| 60-second warning | Clear time limit notification | ✅ Live |
| Smart retry system | User-controlled automatic retry | ✅ Live |
| Multi-language | Korean + English support | ✅ Live |
| Auto-redirect | Return to setup after call ends | ✅ Live |

#### 📞 Need Help?

- **Documentation**: [LINE Planet Docs](https://docs.lineplanet.me/)
- **Issues**: [GitHub Issues](https://github.com/tiger-dreams/viva-connect-test/issues)
- **LIFF Guide**: [LINE LIFF Documentation](https://developers.line.biz/en/docs/liff/)

**Deployment**: https://viva-connect-test.vercel.app

---

*Thank you for using LIFF Demo! 🎉*

*- Tiger (LINE Planet Team)*
