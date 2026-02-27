import bcrypt from 'bcryptjs';
import mongoose, { Document, Model } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: string;
  experienceLevel: string;
  industryMode: 'Product company' | 'Service company' | 'Startup' | 'MNC';
  streakCount: number;
  longestStreak: number;
  lastInterviewDate?: Date;
  xp: number;
  level: number;
  badges: string[];
  settings: {
    notifications: boolean;
    darkMode: boolean;
    preferredQuestionCount: number;
    notificationEmail?: string;
  };
  matchPassword: (enteredPassword: string) => Promise<boolean>;
}

const userSchema = new mongoose.Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
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
    streakCount: {
      type: Number,
      default: 0,
    },
    longestStreak: {
      type: Number,
      default: 0,
    },
    lastInterviewDate: {
      type: Date,
    },
    xp: {
      type: Number,
      default: 0,
    },
    level: {
      type: Number,
      default: 1,
    },
    badges: {
      type: [String],
      default: [],
    },
    settings: {
      notifications: {
        type: Boolean,
        default: true,
      },
      darkMode: {
        type: Boolean,
        default: true,
      },
      preferredQuestionCount: {
        type: Number,
        default: 3,
      },
      notificationEmail: {
        type: String,
        default: '',
      },
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre<IUser>('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword: string) {
  return bcrypt.compare(enteredPassword, this.password);
};

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', userSchema);
export default User;
