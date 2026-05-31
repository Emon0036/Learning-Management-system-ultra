const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    enrolledAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['enrolled', 'pending-review', 'completed', 'expired'], default: 'enrolled' },
    attempts: { type: Number, default: 0, min: 0 },
    bestScore: { type: Number, default: 0, min: 0, max: 100 },
    bestAttemptId: { type: mongoose.Schema.Types.ObjectId, ref: 'Attempt' },
  },
  { timestamps: true }
);

enrollmentSchema.index({ student: 1, quiz: 1 }, { unique: true });
enrollmentSchema.index({ student: 1, status: 1 });
enrollmentSchema.index({ quiz: 1, status: 1 });

module.exports = mongoose.model('Enrollment', enrollmentSchema);
