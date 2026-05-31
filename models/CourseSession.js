const mongoose = require('mongoose');

// Live sessions store online class links and later can keep a recording URL after the class.
const courseSessionSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    description: { type: String, trim: true, default: '' },
    scheduledAt: { type: Date, required: true },
    durationMinutes: { type: Number, min: 1, default: 60 },
    meetingUrl: { type: String, required: true, trim: true },
    recordingUrl: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' },
  },
  { timestamps: true }
);

courseSessionSchema.index({ course: 1, scheduledAt: 1 });
courseSessionSchema.index({ teacher: 1, scheduledAt: 1 });

module.exports = mongoose.model('CourseSession', courseSessionSchema);
