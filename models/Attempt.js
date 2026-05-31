const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema(
  {
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    answer: { type: String, default: '' },
    isCorrect: { type: Boolean, default: false },
    marksObtained: { type: Number, default: 0 },
    needsManualReview: { type: Boolean, default: false },
    teacherCorrectAnswer: { type: String, default: '' },
    reviewComment: { type: String, default: '' },
  },
  { _id: false }
);

const attemptSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    answers: [answerSchema],
    score: { type: Number, default: 0 },
    totalMarks: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    status: { type: String, enum: ['submitted', 'pending-review', 'reviewed'], default: 'submitted' },
    passed: { type: Boolean, default: false },
    autoSubmitted: { type: Boolean, default: false },
    autoSubmitReason: { type: String, default: '' },
    startedAt: { type: Date, default: Date.now },
    submittedAt: { type: Date, default: Date.now },
    timeSpent: { type: Number, default: 0 },
    progressUpdated: { type: Boolean, default: false, index: true },
    pointsAwarded: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

attemptSchema.index({ student: 1, quiz: 1, submittedAt: -1 });
attemptSchema.index({ quiz: 1, percentage: -1, timeSpent: 1 });

module.exports = mongoose.model('Attempt', attemptSchema);
