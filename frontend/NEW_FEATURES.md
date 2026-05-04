# New Features: Real-Time Behavioral Analysis & Peer Mock Interviews

## 🎯 Overview

InterviewPilot now includes two groundbreaking features that make mock interviews dramatically more realistic and valuable:

### 1. 🎥 Real-Time Behavioral Analysis with Webcam

Analyzes non-verbal communication patterns during interviews, providing actionable feedback on:

**Metrics Tracked:**
- **Eye Contact**: Measures attention and engagement (0-100%)
- **Confidence Level**: Gauges speaker confidence and composure (0-100%)
- **Speaking Pace**: Classifies speed (slow/normal/fast)
- **Emotion State**: Detects emotional state (neutral/positive/nervous/stressed)

**How It Works:**
1. Enable during interview setup
2. Grant webcam permission
3. AI analyzes video feed in real-time (every 3 seconds)
4. Receives live feedback overlay on the screen
5. Complete analysis stored with interview history
6. Post-interview communication report with improvements

**Benefits:**
- Identifies nervous habits and speaking patterns
- Helps practice non-verbal communication
- Provides metrics like traditional interview coaches
- Track improvement across multiple interviews

---

### 2. 👥 Peer Mock Interview Sessions

Practice interviewing with real candidates, not just AI. Two users interview each other:

**How It Works:**
1. **Candidate** starts interview setup and chooses "Peer Mode"
2. Session enters waiting lobby
3. **Interviewer** finds waiting candidates in the lobby
4. **Interviewer** joins the peer session
5. AI facilitates: generates questions, evaluates answers from both perspectives
6. Each participant gets scored and feedback

**Peer Session Flow:**
- **Candidate**: Answers interview questions (behavioral + technical)
- **Interviewer**: Watches, can ask follow-up questions
- **AI Role**: Generates questions, evaluates both candidate's answers AND interviewer's questioning quality
- **Post-Session**: Both get detailed feedback

**Scoring Both Sides:**
- **Candidate Score**: Content, clarity, depth (0-10)
- **Interviewer Score**: Question quality, listening skills, follow-ups (0-10)
- **Interaction Score**: Communication and professionalism between peers (0-10)

**Benefits:**
- More realistic than AI interviews (human element)
- Learn interviewing skills as well
- Build confidence with real people
- Practice handling unexpected questions
- Get peer insights on your answers

---

## 📊 Data Models

### New Fields in Interview Schema

```typescript
interviewMode: 'timed' | 'untimed' | 'peer'
peerSessionId: ObjectId
isAIPeerSession: boolean
behavioralAnalysis: {
  isEnabled: boolean
  metrics: Array<{
    timestamp: Date
    eyeContact: number (0-100)
    confidence: number (0-100)
    speakingPace: 'slow' | 'normal' | 'fast'
    emotionState: 'neutral' | 'positive' | 'nervous' | 'stressed'
  }>
  averageEyeContact: number
  averageConfidence: number
  overallEmotionTrend: string
  communicationFeedback: string
}
```

### New PeerSession Model

```typescript
{
  candidateId: ObjectId (User)
  interviewerId: ObjectId (User, optional for AI)
  candidateInterviewId: ObjectId
  interviewerInterviewId: ObjectId
  status: 'waiting' | 'active' | 'completed'
  role: string
  experienceLevel: string
  startedAt: Date
  completedAt: Date
  duration: number (seconds)
  interviewerFeedback: {
    overallScore: number
    communication: string
    technicalDepth: string
    strengths: string[]
    improvements: string[]
  }
  isAIPaired: boolean
}
```

---

## 🔧 New API Endpoints

### Peer Session Management

**GET /api/peer-sessions**
- Fetch all waiting peer sessions
- Returns: Array of available sessions

**POST /api/peer-sessions**
- Create new peer session (candidate)
- Body: `{ role, experienceLevel, interviewId }`
- Returns: New peer session object

**POST /api/peer-sessions/{sessionId}/join**
- Join an existing peer session (interviewer)
- Body: `{ interviewId }`
- Returns: Updated peer session with both participants

### Behavioral Analysis

**POST /api/interviews/{id}/behavioral-metrics**
- Submit behavioral metrics during interview
- Body: `{ metrics: Array<BehavioralMetric> }`
- Returns: Updated behavioral analysis

---

## 🖥️ New UI Components

### BehavioralAnalysisOverlay
- Fixed position camera feed (bottom-right)
- Live metrics display
- Current emotion, eye contact, confidence
- Speaking pace indicator
- Real-time frame counter
- Stops when interview ends

### PeerLobby
- Browse available peer sessions
- Filter by role and experience level
- Join buttons with error handling
- Auto-refresh every 10 seconds
- Loading and empty states

---

## 🚀 Usage Flow

### For Behavioral Analysis
1. During interview setup, check "Enable Behavioral Analysis"
2. Grant webcam permission when prompted
3. Start interview
4. Overlay appears in bottom-right corner
5. Live metrics update as you interview
6. After completion, view communication report in history

### For Peer Interviews
1. Choose "Peer Mode" during setup
2. Configure role and experience level
3. Enter waiting lobby
4. Other candidates can see your session
5. When someone joins, interview starts
6. Ask and answer questions
7. Get scored as both candidate and interviewer
8. Compare performance with peer feedback

---

## 🎯 Key Differentiators

1. **Behavioral Feedback**: No other platform provides real-time non-verbal analysis
2. **Peer Learning**: Learn interviewing skills while practicing as candidate
3. **Realistic Practice**: Practice with real people, not just AI
4. **Dual Scoring**: Get feedback on both communication AND content
5. **Metrics-Driven**: Data-backed insights to track improvement

---

## 📱 Technical Implementation

- **Webcam Access**: Uses WebRTC MediaDevices API
- **Real-time Analysis**: 3-second frame analysis intervals
- **AI Evaluation**: NVIDIA NIM LLaMA integration for feedback generation
- **Real-time Communication**: WebSocket-ready architecture (future: add video streaming)
- **Data Persistence**: All metrics stored in MongoDB for history tracking

---

## 🔮 Future Enhancements

- WebRTC video/audio streaming for peer sessions
- ML model for real facial expression detection
- Company-specific interviewer profiles
- Peer rating and reputation system
- AI as backup interviewer when peer not available
- Schedule peer sessions in advance
