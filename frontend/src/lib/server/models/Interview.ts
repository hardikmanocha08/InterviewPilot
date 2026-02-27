import mongoose, { Document, Model } from 'mongoose';

export interface IQuestion {
  _id?: mongoose.Types.ObjectId;
  questionText: string;
  userAnswer: string;
  score: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  improvement: string;
}

export interface IInterview extends Document {
  user: mongoose.Types.ObjectId;
  role: string;
  experienceLevel: string;
  industryMode: 'Product company' | 'Service company' | 'Startup' | 'MNC';
  interviewMode: 'timed' | 'untimed';
  perQuestionTimeSeconds: number;
  score: number;
  status: 'in-progress' | 'completed';
  endedReason?: 'manual' | 'timeout' | 'abandoned';
  completedAt?: Date;
  questions: IQuestion[];
  overallFeedback: {
    strengths: string[];
    weaknesses: string[];
    improvementPlan: string;
  };
}

const interviewSchema = new mongoose.Schema<IInterview>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    role: {
      type: String,
      required: true,
    },
    experienceLevel: {
      type: String,
      required: true,
    },
    industryMode: {
      type: String,
      enum: ['Product company', 'Service company', 'Startup', 'MNC'],
      default: 'Product company',
    },
    interviewMode: {
      type: String,
      enum: ['timed', 'untimed'],
      default: 'timed',
    },
    perQuestionTimeSeconds: {
      type: Number,
      default: 180,
    },
    score: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['in-progress', 'completed'],
      default: 'in-progress',
    },
    completedAt: {
      type: Date,
    },
    endedReason: {
      type: String,
      enum: ['manual', 'timeout', 'abandoned'],
    },
    questions: [
      {
        questionText: String,
        userAnswer: String,
        score: Number,
        feedback: String,
        strengths: [String],
        weaknesses: [String],
        improvement: String,
      },
    ],
    overallFeedback: {
      strengths: [String],
      weaknesses: [String],
      improvementPlan: String,
    },
  },
  {
    timestamps: true,
  }
);

const Interview: Model<IInterview> =
  mongoose.models.Interview || mongoose.model<IInterview>('Interview', interviewSchema);
export default Interview;
