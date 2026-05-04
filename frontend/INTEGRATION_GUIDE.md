# Implementation Guide: New Features

## 📋 What Was Added

### 1. Database Schema Updates

#### Updated `Interview` Model
- Added `peerSessionId` field for linking to peer sessions
- Added `isAIPeerSession` boolean flag
- Updated `interviewMode` enum to include `'peer'`
- Added `behavioralAnalysis` object with:
  - `isEnabled`: Toggle for feature
  - `metrics[]`: Array of behavioral data points
  - `averageEyeContact`, `averageConfidence`: Aggregated metrics
  - `overallEmotionTrend`, `communicationFeedback`: AI analysis results

#### New `PeerSession` Model (`/src/lib/server/models/PeerSession.ts`)
- Manages peer-to-peer interview sessions
- Tracks candidate and interviewer relationships
- Stores session status and duration
- Captures interviewer feedback for candidates

### 2. Backend APIs

#### Peer Session Routes
- **GET `/api/peer-sessions`** - List available peer sessions
- **POST `/api/peer-sessions`** - Create new peer session (as candidate)
- **POST `/api/peer-sessions/{sessionId}/join`** - Join existing session (as interviewer)

#### Behavioral Analysis Route
- **POST `/api/interviews/{id}/behavioral-metrics`** - Submit real-time behavioral metrics

### 3. AI Utilities (`/src/lib/server/utils/ai.ts`)

#### New Functions
- `analyzeBehavioralMetrics()` - Analyzes collected metrics and generates communication feedback
- `generatePeerInterviewerPrompt()` - Creates system prompt for AI acting as peer interviewer

### 4. Frontend Components

#### New Components
- **`BehavioralAnalysisOverlay.tsx`** - Real-time webcam video overlay with metrics
  - Captures video feed
  - Displays live metrics (eye contact, confidence, emotion, pace)
  - Sends data to backend every 3 seconds
  - Shows frame count and analysis status

- **`PeerLobby.tsx`** - Peer session discovery interface
  - Browse waiting peer sessions
  - Filter by role and experience
  - Join with one click
  - Auto-refreshes every 10 seconds

### 5. UI Updates

#### Interview Setup Page (`/src/app/interview/setup/page.tsx`)
- Added `peerMode` checkbox
- Added `enableBehavioralAnalysis` checkbox
- Updated form state to include new fields

---

## 🔄 Integration Points

### Step 1: Backend Setup
1. Schema changes already applied to `Interview.ts`
2. New `PeerSession.ts` model created
3. API routes created in `/api/peer-sessions/` and `/api/interviews/[id]/behavioral-metrics`
4. AI utilities updated in `utils/ai.ts`

### Step 2: Frontend Setup
1. Components created: `BehavioralAnalysisOverlay.tsx`, `PeerLobby.tsx`
2. Interview setup page updated with new options
3. Feature documentation in `NEW_FEATURES.md`

### Step 3: Interview Room Integration
To fully enable these features in the interview room (`/src/app/interview/[id]/page.tsx`), add:

```typescript
import BehavioralAnalysisOverlay from '@/app/components/BehavioralAnalysisOverlay';
import PeerLobby from '@/app/components/PeerLobby';

// In component state:
const [behavioralMetrics, setBehavioralMetrics] = useState([]);
const [showPeerLobby, setShowPeerLobby] = useState(false);

// When interview starts:
const showBehavioralAnalysis = interview?.behavioralAnalysis?.isEnabled;
const isPeerMode = interview?.interviewMode === 'peer';

// In JSX:
{showBehavioralAnalysis && (
  <BehavioralAnalysisOverlay
    isEnabled={true}
    onMetricsUpdate={(metrics) => {
      setBehavioralMetrics(metrics);
      // Send to backend periodically
      if (metrics.length % 5 === 0) {
        api.post(`/interviews/${id}/behavioral-metrics`, { metrics });
      }
    }}
    isRecording={!isAnswered}
  />
)}

{isPeerMode && !peerSessionStarted && (
  <PeerLobby
    onJoinSession={(sessionId) => {
      setPeerSessionStarted(true);
      // Fetch peer session and enable dual-participant features
    }}
    interviewId={id}
  />
)}
```

### Step 4: History/Results Page
Update `/src/app/dashboard/history/[id]/page.tsx` to display:

```typescript
// Behavioral Analysis Results
{interview?.behavioralAnalysis && (
  <div>
    <h3>Behavioral Analysis</h3>
    <p>Average Eye Contact: {interview.behavioralAnalysis.averageEyeContact}%</p>
    <p>Average Confidence: {interview.behavioralAnalysis.averageConfidence}%</p>
    <p>Emotion Trend: {interview.behavioralAnalysis.overallEmotionTrend}</p>
    <p>Feedback: {interview.behavioralAnalysis.communicationFeedback}</p>
  </div>
)}

// Peer Session Results
{interview?.peerSessionId && (
  <div>
    <h3>Peer Interview Session</h3>
    <p>Paired with: {peerSession.candidateId.name} / {peerSession.interviewerId.name}</p>
    <p>Duration: {peerSession.duration}s</p>
    {peerSession.interviewerFeedback && (
      <div>
        <p>Interviewer Score: {peerSession.interviewerFeedback.overallScore}/10</p>
        <p>Feedback: {peerSession.interviewerFeedback.communication}</p>
      </div>
    )}
  </div>
)}
```

---

## 🧪 Testing Checklist

- [ ] **Behavioral Analysis**
  - [ ] Can enable/disable in setup
  - [ ] Webcam permission prompt appears
  - [ ] Overlay displays correctly during interview
  - [ ] Metrics are collected and sent to backend
  - [ ] Results visible in history

- [ ] **Peer Sessions**
  - [ ] Can create peer session from setup
  - [ ] Session appears in lobby after creation
  - [ ] Can join available sessions
  - [ ] Both participants can see shared interview
  - [ ] Feedback saved for both sides

---

## 📊 Database Migration (if needed)

For existing interviews, run migration to add new fields:

```javascript
// MongoDB migration
db.interviews.updateMany(
  {},
  {
    $set: {
      behavioralAnalysis: {
        isEnabled: false,
        metrics: [],
        averageEyeContact: 0,
        averageConfidence: 0,
        overallEmotionTrend: 'neutral',
        communicationFeedback: '',
      }
    }
  }
);
```

---

## 🚀 Deployment Notes

- **Webcam Feature**: Requires HTTPS in production (browser security policy)
- **Real-time Metrics**: Currently uses polling; consider WebSockets for true real-time
- **AI Analysis**: Uses existing NVIDIA NIM setup; no additional API keys needed
- **Storage**: Metrics stored in MongoDB; no external video storage required

---

## 🔮 Next Steps

1. **Complete Interview Room Integration** - Add components to interview page
2. **WebRTC Video Streaming** - Enable actual video/audio in peer sessions
3. **Advanced ML Models** - Use TensorFlow.js for precise facial recognition
4. **Leaderboards** - Peer reputation system
5. **Scheduled Sessions** - Book peer interviews in advance

---

## 📁 Files Created/Modified

**Created:**
- `/src/lib/server/models/PeerSession.ts` - New model
- `/src/app/api/peer-sessions/route.ts` - API endpoints
- `/src/app/api/peer-sessions/[sessionId]/join/route.ts` - Join endpoint
- `/src/app/api/interviews/[id]/behavioral-metrics/route.ts` - Metrics endpoint
- `/src/app/components/BehavioralAnalysisOverlay.tsx` - Component
- `/src/app/components/PeerLobby.tsx` - Component
- `/NEW_FEATURES.md` - Feature documentation

**Modified:**
- `/src/lib/server/models/Interview.ts` - Added new fields
- `/src/lib/server/utils/ai.ts` - Added new functions
- `/src/app/interview/setup/page.tsx` - Added UI options

---

## ❓ FAQ

**Q: Do I need a ML library for facial recognition?**
A: The current implementation uses simulated metrics. For production, integrate TensorFlow.js with face-api.js or MediaPipe for real detection.

**Q: How is video stored for peer sessions?**
A: Currently using WebRTC data channels (text-based). Add MediaRecorder API for optional recording storage.

**Q: Can interviews continue if peer disconnects?**
A: Current implementation doesn't handle disconnection. Add connection monitoring and fallback to AI interviewer.

**Q: Are webcam feeds sent to server?**
A: No. Metrics are computed client-side; only anonymized data is sent to backend.
