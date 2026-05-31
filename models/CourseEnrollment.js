const mongoose = require('mongoose');

// CourseEnrollment unlocks course content after a successful demo purchase.
const courseEnrollmentSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    purchase: { type: mongoose.Schema.Types.ObjectId, ref: 'CoursePurchase' },
    status: { type: String, enum: ['active', 'completed', 'refunded'], default: 'active' },
    progressPercentage: { type: Number, min: 0, max: 100, default: 0 },
    completedLessons: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CourseLesson' }],
    enrolledAt: { type: Date, default: Date.now },
    lastAccessedAt: Date,
  },
  { timestamps: true }
);

courseEnrollmentSchema.index({ student: 1, course: 1 }, { unique: true });
courseEnrollmentSchema.index({ course: 1, status: 1 });
courseEnrollmentSchema.index({ student: 1, updatedAt: -1 });

module.exports = mongoose.model('CourseEnrollment', courseEnrollmentSchema);
