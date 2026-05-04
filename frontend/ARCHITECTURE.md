# Architecture & System Design

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React/Next.js)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Interview Setup Page                                            │
│  ├── ✅ Enable Behavioral Analysis (checkbox)                   │
│  ├── ✅ Peer Mode (checkbox)                                    │
│  └── Submit → Create Interview                                  │
│                                                                   │
│  Interview Room                                                  │
│  ├── Main Interview (questions, answers, feedback)              │
│  ├── 📹 BehavioralAnalysisOverlay (if enabled)                 │
│  │   ├── Webcam feed (320x240)                                 │
│  │   ├── Real-time metrics display                             │
│  │   └── Send metrics every 3 seconds                          │
│  └── 👥 PeerLobby Component (if peer mode)                     │
│      ├── Browse waiting sessions                               │
│      ├── Join peer session                                     │
│      └── Switch to peer interview                              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓↓↓
                         (HTTP/REST)
                              ↓↓↓
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (Node.js/Express)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  API Routes                                                      │
│  ├── POST /interviews/start                                     │
│  ├── POST /interviews/{id}/answer                              │
│  ├── POST /interviews/{id}/finish                              │
│  ├── ✨ POST /interviews/{id}/behavioral-metrics                │
│  │   ├── Validate interview ownership                          │
│  │   ├── Store metrics in Interview.behavioralAnalysis         │
│  │   ├── Accumulate until 5+ metrics                           │
│  │   └── Trigger analyzeBehavioralMetrics()                    │
│  ├── ✨ GET /peer-sessions                                      │
│  │   └── Return waiting sessions (not user's own)              │
│  ├── ✨ POST /peer-sessions                                     │
│  │   ├── Create new peer session (status: waiting)             │
│  │   └── Link to candidate's interview                         │
│  └── ✨ POST /peer-sessions/{id}/join                           │
│      ├── Validate session status                               │
│      ├── Add interviewer & interview IDs                       │
│      ├── Change status to active                               │
│      └── Link both interviews to session                       │
│                                                                   │
│  AI Utilities (NVIDIA NIM)                                      │
│  ├── analyzeBehavioralMetrics()                                │
│  │   ├── Calculate: avgEyeContact, avgConfidence              │
│  │   ├── Detect: dominantEmotion from trend                   │
│  │   ├── Call: LLaMA for feedback generation                  │
│  │   └── Return: Analysis summary                             │
│  └── generatePeerInterviewerPrompt()                           │
│      ├── Customize: role + experience level                   │
│      └── Return: System prompt for AI moderator               │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓↓↓
                         (MongoDB)
                              ↓↓↓
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE (MongoDB)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Collections:                                                    │
│  ├── users                                                      │
│  │   └── (existing)                                           │
│  ├── interviews (MODIFIED)                                     │
│  │   ├── _id, user, role, questions[], etc.                   │
│  │   ├── ✨ peerSessionId (references PeerSession)            │
│  │   ├── ✨ isAIPeerSession: boolean                          │
│  │   ├── ✨ interviewMode: 'timed'|'untimed'|'peer'           │
│  │   └── ✨ behavioralAnalysis:                               │
│  │       ├── isEnabled: boolean                               │
│  │       ├── metrics: [                                       │
│  │       │   { timestamp, eyeContact, confidence,            │
│  │       │     speakingPace, emotionState }                   │
│  │       ├── averageEyeContact, averageConfidence            │
│  │       ├── overallEmotionTrend                             │
│  │       └── communicationFeedback                            │
│  └── ✨ peerSessions (NEW)                                    │
│      ├── candidateId, interviewerId                          │
│      ├── candidateInterviewId, interviewerInterviewId        │
│      ├── status: 'waiting'|'active'|'completed'             │
│      ├── role, experienceLevel                              │
│      ├── startedAt, completedAt, duration                   │
│      ├── interviewerFeedback: {                             │
│      │   overallScore, communication, technicalDepth,       │
│      │   strengths[], improvements[]                        │
│      └── isAIPaired: boolean                                │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Diagrams

### 1. Behavioral Analysis Data Flow

```
User Starts Interview with Behavioral Analysis Enabled
            ↓
   BehavioralAnalysisOverlay Component
            ↓
   Request Webcam Permission
            ↓
   Video Stream Captured (320x240)
            ↓
   Every 3 Seconds:
   ├── Analyze video frame
   ├── Extract metrics:
   │   ├── eyeContact (%)
   │   ├── confidence (%)
   │   ├── speakingPace
   │   └── emotionState
   └── Display in overlay
            ↓
   Accumulate metrics array
            ↓
   Every ~5 frames (~15 seconds):
   └── POST /interviews/{id}/behavioral-metrics
            ↓
   Backend Receives Metrics
            ↓
   Store in Interview.behavioralAnalysis.metrics[]
            ↓
   Check if >= 5 metrics collected
            ├── YES: Call analyzeBehavioralMetrics()
            │   ├── Calculate averages
            │   ├── Detect emotion trend
            │   ├── Generate AI feedback (NVIDIA NIM)
            │   └── Update Interview.behavioralAnalysis fields
            └── NO: Continue collecting
            ↓
   Interview Ends
            ↓
   Final Analysis Available in History Page
```

### 2. Peer Interview Flow

```
┌─── CANDIDATE SIDE ───┐          ┌─── INTERVIEWER SIDE ───┐

Setup Interview               Browse Available Sessions
    ↓                                    ↓
Select "Peer Mode"            Get /peer-sessions
    ↓                                    ↓
Submit Form                   See Waiting Candidates
    ↓                                    ↓
POST /peer-sessions           (Candidate appears in list)
    ↓                                    ↓
Create PeerSession                      ↓
(status: waiting)                       ↓
    ↓                          Click "Join" on session
Enter Waiting Lobby                     ↓
    ↓                          POST /peer-sessions/{id}/join
Waiting for Interviewer              with interviewId
    ↓                                    ↓
(PeerSession Status                 Backend Processes:
 still: waiting)              ├── Validate session
                              ├── Add interviewer info
                              ├── Set status: active
                              ├── Link interviews
                              └── Update both Interview records
                                        ↓
                         ← ← ← Connection Established ← ← ←
                                        ↓
      Interview Starts (Both Sides)
            ↓ ↓ ↓
   Candidate Answers Questions
   Interviewer Watches/Evaluates
   AI Generates Questions (both sides)
            ↓ ↓ ↓
      Interview Completes
            ↓ ↓ ↓
   POST /interviews/{id}/finish
            ↓ ↓ ↓
   Generate Scores:
   ├── Candidate: Content + Clarity (0-10)
   ├── Interviewer: Question Quality + Engagement (0-10)
   └── Interaction: Communication Flow (0-10)
            ↓ ↓ ↓
   Store Feedback in PeerSession
            ↓ ↓ ↓
   View Results in History
```

### 3. Component State Management

```
Interview Room Page
    │
    ├── interview: Interview (fetched from API)
    │   ├── questions[]
    │   ├── behavioralAnalysis? (if enabled)
    │   ├── peerSessionId? (if peer mode)
    │   └── interviewMode: 'timed'|'untimed'|'peer'
    │
    ├── BehavioralAnalysisOverlay (if enabled)
    │   ├── isEnabled: boolean
    │   ├── hasPermission: boolean (camera)
    │   ├── metrics: BehavioralMetric[] (local state)
    │   ├── currentState: { eyeContact, confidence, emotion, pace }
    │   └── onMetricsUpdate() → sends to parent & backend
    │
    └── PeerLobby (if peer mode & not started)
        ├── sessions: PeerSession[] (from API)
        ├── loading: boolean
        ├── error: string | null
        ├── onJoinSession() → joins session
        └── auto-refresh every 10 seconds
```

---

## 🔌 API Contract

### Request/Response Examples

#### 1. POST /interviews/{id}/behavioral-metrics

**Request:**
```json
{
  "metrics": [
    {
      "timestamp": "2024-05-04T10:05:00Z",
      "eyeContact": 85,
      "confidence": 78,
      "speakingPace": "normal",
      "emotionState": "positive"
    },
    {
      "timestamp": "2024-05-04T10:05:03Z",
      "eyeContact": 88,
      "confidence": 80,
      "speakingPace": "normal",
      "emotionState": "positive"
    }
  ]
}
```

**Response (200):**
```json
{
  "message": "Metrics recorded",
  "behavioralAnalysis": {
    "isEnabled": true,
    "metrics": [...],
    "averageEyeContact": 86,
    "averageConfidence": 79,
    "overallEmotionTrend": "positive",
    "communicationFeedback": "Excellent eye contact and confident tone throughout..."
  }
}
```

#### 2. GET /peer-sessions

**Response (200):**
```json
[
  {
    "_id": "session_123",
    "candidateId": {
      "_id": "user_456",
      "name": "Alice Johnson",
      "email": "alice@example.com"
    },
    "role": "Frontend Engineer",
    "experienceLevel": "1-3 years",
    "status": "waiting",
    "createdAt": "2024-05-04T10:00:00Z"
  },
  {
    "_id": "session_789",
    "candidateId": { ... },
    ...
  }
]
```

#### 3. POST /peer-sessions/{sessionId}/join

**Request:**
```json
{
  "interviewId": "interview_xyz"
}
```

**Response (200):**
```json
{
  "_id": "session_123",
  "candidateId": "user_456",
  "interviewerId": "user_789",
  "candidateInterviewId": "interview_abc",
  "interviewerInterviewId": "interview_xyz",
  "status": "active",
  "startedAt": "2024-05-04T10:05:00Z",
  "role": "Frontend Engineer",
  "experienceLevel": "1-3 years"
}
```

---

## 📊 Database Schema Relationships

```
User (existing)
├── _id
├── name, email, role, experienceLevel, industryMode
└── ... other fields

    ↓ (creates)
    
Interview (modified)
├── _id
├── user → ObjectId (User)
├── role, experienceLevel, industryMode
├── interviewMode: 'timed'|'untimed'|'peer' ✨
├── questions[]
├── peerSessionId → ObjectId (PeerSession) ✨ optional
├── isAIPeerSession: boolean ✨
├── behavioralAnalysis ✨ optional:
│   ├── isEnabled: boolean
│   ├── metrics[]
│   ├── averageEyeContact, averageConfidence
│   ├── overallEmotionTrend
│   └── communicationFeedback
└── overallFeedback, score, status, etc.

    ↓ (peer interviews link via)
    
PeerSession (new) ✨
├── _id
├── candidateId → ObjectId (User)
├── interviewerId → ObjectId (User) optional
├── candidateInterviewId → ObjectId (Interview)
├── interviewerInterviewId → ObjectId (Interview) optional
├── status: 'waiting'|'active'|'completed'
├── role, experienceLevel
├── startedAt, completedAt, duration
├── interviewerFeedback
└── isAIPaired: boolean
```

---

## 🎯 User Flow Diagram

```
                        ┌─────────────────┐
                        │   Login Page    │
                        └────────┬────────┘
                                 ↓
                        ┌─────────────────┐
                        │   Dashboard     │
                        └────────┬────────┘
                                 ↓
                   ┌─────────────────────────────┐
                   │   Interview Setup Page      │
                   │   (Configure interview)     │
                   └─────┬───────────────────┬───┘
                         ↓                   ↓
              [AI Mode]        [Peer Mode]
                 ↓                        ↓
         ┌──────────────┐        ┌───────────────┐
         │ Start AI     │        │ Peer Lobby    │
         │ Interview    │        │ (wait/find)   │
         └──────┬───────┘        └───────┬───────┘
                ↓                        ↓
         ┌──────────────────────────────────────┐
         │   Interview Room                     │
         │   ├─ Main Interview UI               │
         │   ├─ 📹 Behavioral Overlay (opt)    │
         │   └─ 👥 Peer Interaction (if peer)  │
         └──────┬───────────────────────────────┘
                ↓
         ┌──────────────┐
         │ Complete     │
         │ Interview    │
         └──────┬───────┘
                ↓
         ┌──────────────────────────────┐
         │ History/Results Page         │
         │ ├─ Score, Feedback           │
         │ ├─ 📹 Behavioral Report (if) │
         │ └─ 👥 Peer Feedback (if)    │
         └──────────────────────────────┘
```

---

## 🔐 Security Considerations

```
                    User Request
                         ↓
                   ┌─────────────┐
                   │ Authenticate│
                   │ (verify JWT)│
                   └──────┬──────┘
                          ↓
                    [Valid Token]
                          ↓
                   ┌─────────────────────┐
                   │ Check Ownership     │
                   │ (user._id matches)  │
                   └──────┬──────────────┘
                          ↓
                    [Verified Owner]
                          ↓
              ┌─────────────────────────┐
              │ Process Request         │
              │ & Return Data           │
              └─────────────────────────┘

Peer Sessions:
├── Validate session exists
├── Check status (must be 'waiting' to join)
├── Verify user is not candidate
├── Link interviews only if both exist
└── Handle race conditions (multiple joins)
```

---

## 📈 Scalability Considerations

### Current Implementation
- Polling for peer sessions (10 sec intervals)
- Synchronous metrics storage
- No real-time bidirectional communication

### Future Enhancements for Scale
- **WebSocket** for real-time session updates
- **Redis** for session caching
- **Message Queue** for metrics processing
- **CDN** for video streaming (if added)
- **Load Balancing** for multiple peer session servers

---

## 🧪 Testing Points

```
Behavioral Analysis:
├── ✓ Camera permission handling
├── ✓ Metric collection every 3 seconds
├── ✓ Backend metric storage
├── ✓ Analysis trigger (5+ metrics)
├── ✓ Feedback generation
└── ✓ History display

Peer Sessions:
├── ✓ Session creation (candidate)
├── ✓ Session discovery (lobbies)
├── ✓ Session joining (interviewer)
├── ✓ Status updates
├── ✓ Interview linking
├── ✓ Race condition handling
└── ✓ Feedback storage
```

---

## 🎨 Component Hierarchy

```
InterviewRoom (Parent)
│
├── BehavioralAnalysisOverlay
│   ├── video element (webcam)
│   ├── canvas element (metrics overlay)
│   └── metrics display section
│
├── PeerLobby
│   ├── Header/Title
│   ├── Error Display (if any)
│   ├── Loading Spinner
│   ├── Session List
│   │   └── SessionCard[] (mappable)
│   │       ├── Role/Experience Info
│   │       └── Join Button
│   └── Refresh Button
│
└── Main Interview UI
    ├── Question Display
    ├── Answer Input
    ├── Submit/Next Buttons
    ├── Timer (if timed)
    └── Feedback Display
```

This architecture ensures clean separation of concerns, easy testing, and scalable design!
