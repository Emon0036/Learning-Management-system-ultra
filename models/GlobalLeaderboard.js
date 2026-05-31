const mongoose = require('mongoose');

// Global leaderboard - tracks all students across all quizzes
const globalLeaderboardSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    totalPoints: { type: Number, default: 0, min: 0 },
    averageScore: { type: Number, default: 0, min: 0, max: 100 },
    quizzesCompleted: { type: Number, default: 0, min: 0 },
    rank: { type: Number, default: 0 },
    badge: {
      type: String,
      enum: ['gold', 'silver', 'bronze', 'none'],
      default: 'none',
    },
    goldPoints: { type: Number, default: 0, min: 0 },
    silverPoints: { type: Number, default: 0, min: 0 },
    bronzePoints: { type: Number, default: 0, min: 0 },
    streak: { type: Number, default: 0, min: 0 },
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

globalLeaderboardSchema.index({ totalPoints: -1, averageScore: -1 });
globalLeaderboardSchema.index({ rank: 1 });
globalLeaderboardSchema.index({ badge: 1 });
globalLeaderboardSchema.index({ student: 1 }, { unique: true });

module.exports = mongoose.model('GlobalLeaderboard', globalLeaderboardSchema);
