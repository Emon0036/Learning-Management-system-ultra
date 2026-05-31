const mongoose = require("mongoose");

// Schema for tracking coding submissions and manual teacher reviews
const submissionSchema = new mongoose.Schema(
  {
    problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    code: { type: String, required: true },
    language: { type: String, required: true, enum: ['c', 'cpp', 'java', 'javascript', 'python'] },

    status: {
      type: String,
      enum: ['pending-review', 'reviewed'],
      default: 'pending-review',
      index: true,
    },

    marksAwarded: { type: Number, default: 0, min: 0 },
    teacherComment: { type: String, default: '' },
    correctedCode: { type: String, default: '' },

    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },

    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

submissionSchema.index({ student: 1, submittedAt: -1 });
submissionSchema.index({ problem: 1, submittedAt: -1 });

module.exports = mongoose.model("Submission", submissionSchema);
