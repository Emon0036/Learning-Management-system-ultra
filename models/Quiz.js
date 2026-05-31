const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true },
    category: { type: String, required: true, trim: true, default: 'General Knowledge' },
    thumbnailUrl: { type: String, trim: true, default: '' },
    thumbnailPublicId: { type: String, trim: true, default: '' },
    // Student dashboard grouping (Quiz / True-False / Short Question / Coding Test).
    examType: {
      type: String,
      enum: ['quiz', 'true-false', 'short-answer', 'coding-test'],
      default: 'quiz',
      index: true,
    },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' },
    duration: { type: Number, required: true, min: 1 },
    passingMarks: { type: Number, required: true, min: 0, max: 100 },
    totalMarks: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  },
  { timestamps: true }
);

quizSchema.index({ status: 1, category: 1, difficulty: 1 });
quizSchema.index({ status: 1, examType: 1, category: 1 });
quizSchema.index({ createdBy: 1, createdAt: -1 });

module.exports = mongoose.model('Quiz', quizSchema);
