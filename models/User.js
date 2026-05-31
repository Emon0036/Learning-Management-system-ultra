const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, minlength: 6, select: false },
    role: { type: String, enum: ['admin', 'teacher', 'student'], required: true, default: 'student' },
    teacherStatus: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
    accountStatus: { type: String, enum: ['active', 'blocked'], default: 'active' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    blockedAt: Date,
    profileImage: { type: String, default: '/images/default-avatar.png' },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
  },
  { timestamps: true }
);

// Hash only new or changed passwords.
userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password') || !this.password) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.matchPassword = function matchPassword(password) {
  return bcrypt.compare(password, this.password);
};

userSchema.methods.createPasswordResetToken = function createPasswordResetToken() {
  const token = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
  this.resetPasswordExpires = Date.now() + 60 * 60 * 1000;
  return token;
};

module.exports = mongoose.model('User', userSchema);
