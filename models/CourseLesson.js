const mongoose = require('mongoose');

// Lessons organize a course into teachable units and can optionally point to an existing quiz.
const courseLessonSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    description: { type: String, trim: true, default: '' },
    durationMinutes: { type: Number, min: 0, default: 0 },
    position: { type: Number, min: 1, default: 1 },
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' },
    isPreview: { type: Boolean, default: false },
  },
  { timestamps: true }
);

courseLessonSchema.index({ course: 1, position: 1 });
courseLessonSchema.index({ teacher: 1, createdAt: -1 });

module.exports = mongoose.model('CourseLesson', courseLessonSchema);
