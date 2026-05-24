import mongoose from 'mongoose';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [EMAIL_RE, 'Invalid email address'],
    },
    passwordHash: { type: String, required: true, select: false },
    displayName: {
      type: String,
      trim: true,
      maxlength: [60, 'displayName cannot exceed 60 characters'],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export default mongoose.model('User', userSchema);
