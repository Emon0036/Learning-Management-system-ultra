const mongoose = require('mongoose');

// Assignments belong to a course and carry the teacher's question PDF plus a deadline.
const courseAssignmentSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseLesson' },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    instructions: { type: String, trim: true, default: '' },
    dueAt: { type: Date, required: true },
    maxMarks: { type: Number, min: 0, default: 0 },
    questionFileUrl: { type: String, required: true, trim: true },
    questionFileName: { type: String, required: true, trim: true },
    questionFileMimeType: { type: String, trim: true, default: '' },
    questionFileSize: { type: Number, min: 0, default: 0 },
    position: { type: Number, min: 1, default: 1 },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
  },
  { timestamps: true }
);

courseAssignmentSchema.index({ course: 1, dueAt: 1 });
courseAssignmentSchema.index({ teacher: 1, createdAt: -1 });

module.exports = mongoose.model('CourseAssignment', courseAssignmentSchema);
