const mongoose = require('mongoose');

const codingSubmissionSchema = new mongoose.Schema(
  {
    attempt: { type: mongoose.Schema.Types.ObjectId, ref: 'Attempt', required: true },
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    studentCode: { type: String, required: true },
    language: { type: String, enum: ['javascript', 'python', 'java', 'cpp', 'csharp'], required: true },
    executionOutput: { type: String, default: '' },
    executionErrors: { type: String, default: '' },
    testsPassed: { type: Number, default: 0 },
    totalTests: { type: Number, default: 0 },
    isCorrect: { type: Boolean, default: false },
    marksObtained: { type: Number, default: 0 },
    executedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

codingSubmissionSchema.index({ attempt: 1, question: 1 });
codingSubmissionSchema.index({ question: 1, isCorrect: 1 });

module.exports = mongoose.model('CodingSubmission', codingSubmissionSchema);
