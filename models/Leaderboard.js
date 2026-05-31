const mongoose = require('mongoose');

const leaderboardSchema = new mongoose.Schema(
  {
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true, unique: true },
    entries: [
      {
        student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        bestScore: { type: Number, default: 0 },
        bestPercentage: { type: Number, default: 0 },
        attemptCount: { type: Number, default: 0 },
        rank: { type: Number, default: 0 },
        lastAttemptAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

leaderboardSchema.methods.recordAttempt = async function recordAttempt(studentId, score, percentage) {
  let entry = this.entries.find((item) => item.student.toString() === studentId.toString());

  if (!entry) {
    this.entries.push({ student: studentId, bestScore: score, bestPercentage: percentage, attemptCount: 1 });
  } else {
    entry.attemptCount += 1;
    entry.lastAttemptAt = new Date();
    if (percentage > entry.bestPercentage) {
      entry.bestScore = score;
      entry.bestPercentage = percentage;
    }
  }

  this.entries.sort((a, b) => b.bestPercentage - a.bestPercentage || b.bestScore - a.bestScore);
  this.entries.forEach((item, index) => {
    item.rank = index + 1;
  });

  await this.save();
};

module.exports = mongoose.model('Leaderboard', leaderboardSchema);
