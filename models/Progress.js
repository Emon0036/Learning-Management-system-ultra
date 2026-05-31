const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    totalQuizzes: { type: Number, default: 0, min: 0 },
    completedQuizzes: { type: Number, default: 0, min: 0 },
    inProgressQuizzes: { type: Number, default: 0, min: 0 },
    averageScore: { type: Number, default: 0, min: 0, max: 100 },
    totalPoints: { type: Number, default: 0, min: 0 },
    totalAttempts: { type: Number, default: 0, min: 0 },
    passedQuizzes: { type: Number, default: 0, min: 0 },
    failedQuizzes: { type: Number, default: 0, min: 0 },
    streak: { type: Number, default: 0, min: 0 },
    lastAttemptDate: { type: Date },
    badges: [
      {
        name: String,
        description: String,
        earnedAt: Date,
        icon: String,
      },
    ],
    quizzesByCategory: [
      {
        category: String,
        completed: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        averageScore: { type: Number, default: 0 },
      },
    ],
  },
  { timestamps: true }
);

progressSchema.index({ student: 1 });
progressSchema.index({ totalPoints: -1, averageScore: -1 });

module.exports = mongoose.model('Progress', progressSchema);
