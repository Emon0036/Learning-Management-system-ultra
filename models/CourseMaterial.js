const mongoose = require('mongoose');

// Materials hold notes, community links, protected videos, external resources, and uploaded course files.
const courseMaterialSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseLesson' },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    type: {
      type: String,
      enum: ['note', 'file', 'recorded-class', 'external-link', 'community-link', 'youtube-class', 'vdocipher-class'],
      required: true,
      default: 'note',
    },
    content: { type: String, trim: true, default: '' },
    resourceUrl: { type: String, trim: true, default: '' },
    fileName: { type: String, trim: true, default: '' },
    fileMimeType: { type: String, trim: true, default: '' },
    fileSize: { type: Number, min: 0, default: 0 },
    position: { type: Number, min: 1, default: 1 },
  },
  { timestamps: true }
);

courseMaterialSchema.index({ course: 1, lesson: 1, position: 1 });
courseMaterialSchema.index({ teacher: 1, createdAt: -1 });

module.exports = mongoose.model('CourseMaterial', courseMaterialSchema);
