import mongoose, { Document, Model } from 'mongoose';

export interface IPeerSession extends Document {
  candidateId: mongoose.Types.ObjectId;
  interviewerId: mongoose.Types.ObjectId;
  candidateInterviewId: mongoose.Types.ObjectId;
  interviewerInterviewId?: mongoose.Types.ObjectId;
  status: 'waiting' | 'active' | 'completed';
  role: string;
  experienceLevel: string;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number; // in seconds
  currentQuestion?: string;
  currentAnswer?: string;
  codeText?: string;
  candidateMicActive?: boolean;
  interviewerMicActive?: boolean;
  rtcOffer?: string;
  rtcAnswer?: string;
  candidateIceCandidates?: string[];
  interviewerIceCandidates?: string[];
  interviewerFeedback?: {
    overallScore: number;
    communication: string;
    technicalDepth: string;
    strengths: string[];
    improvements: string[];
  };
  isAIPaired: boolean; // true if one side is AI
}

const peerSessionSchema = new mongoose.Schema<IPeerSession>(
  {
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    interviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    candidateInterviewId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Interview',
    },
    interviewerInterviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interview',
    },
    status: {
      type: String,
      enum: ['waiting', 'active', 'completed'],
      default: 'waiting',
    },
    role: {
      type: String,
      required: true,
    },
    experienceLevel: {
      type: String,
      required: true,
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    duration: {
      type: Number,
    },
    currentQuestion: {
      type: String,
      default: '',
    },
    currentAnswer: {
      type: String,
      default: '',
    },
    codeText: {
      type: String,
      default: '',
    },
    candidateMicActive: {
      type: Boolean,
      default: false,
    },
    interviewerMicActive: {
      type: Boolean,
      default: false,
    },
    rtcOffer: {
      type: String,
      default: '',
    },
    rtcAnswer: {
      type: String,
      default: '',
    },
    candidateIceCandidates: {
      type: [String],
      default: [],
    },
    interviewerIceCandidates: {
      type: [String],
      default: [],
    },
    interviewerFeedback: {
      overallScore: Number,
      communication: String,
      technicalDepth: String,
      strengths: [String],
      improvements: [String],
    },
    isAIPaired: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const PeerSession: Model<IPeerSession> =
  mongoose.models.PeerSession || mongoose.model<IPeerSession>('PeerSession', peerSessionSchema);
export default PeerSession;
