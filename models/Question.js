const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    questionText: { type: String, required: true, trim: true },
    type: { type: String, enum: ['multiple-choice', 'true-false', 'short-answer', 'coding'], required: true },
    options: [{ type: String, trim: true }],
    correctAnswer: { type: String, trim: true },
    // Explanation for the correct answer - shown to students after quiz submission
    explanation: { type: String, trim: true, default: '' },
    marks: { type: Number, required: true, min: 1, default: 1 },
    // Coding test specific fields
    codeTemplate: { type: String, trim: true, default: '' }, // Starter code template
    language: { type: String, trim: true, default: '' }, // Programming language
    testCases: [{ // Test cases for coding problems
      input: { type: String, trim: true },
      expectedOutput: { type: String, trim: true },
    }],
  },
  { timestamps: true }
);

questionSchema.methods.checkAnswer = function checkAnswer(answer) {
  if (this.type === 'short-answer') return false;
  return String(answer || '').trim().toLowerCase() === String(this.correctAnswer || '').trim().toLowerCase();
};

module.exports = mongoose.model('Question', questionSchema);
