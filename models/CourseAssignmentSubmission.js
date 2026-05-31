const mongoose = require('mongoose');

// Student answer PDFs for course assignments. Teachers can later add marks and feedback.
const courseAssignmentSubmissionSchema = new mongoose.Schema(
  {
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseAssignment', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    answerFileUrl: { type: String, required: true, trim: true },
    answerFileName: { type: String, required: true, trim: true },
    answerFileMimeType: { type: String, trim: true, default: '' },
    answerFileSize: { type: Number, min: 0, default: 0 },
    submittedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['submitted', 'reviewed', 'late'], default: 'submitted' },
    marksAwarded: { type: Number, min: 0, default: 0 },
    teacherComment: { type: String, trim: true, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
  },
  { timestamps: true }
);

courseAssignmentSubmissionSchema.index({ assignment: 1, student: 1 }, { unique: true });
courseAssignmentSubmissionSchema.index({ course: 1, submittedAt: -1 });
courseAssignmentSubmissionSchema.index({ student: 1, submittedAt: -1 });

module.exports = mongoose.model('CourseAssignmentSubmission', courseAssignmentSubmissionSchema);
