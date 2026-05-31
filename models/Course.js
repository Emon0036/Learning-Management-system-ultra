const mongoose = require('mongoose');

// Course is the main LMS product that teachers publish and students buy through demo checkout.
const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    subtitle: { type: String, trim: true, maxlength: 240, default: '' },
    description: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, default: 'General' },
    level: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], default: 'Beginner' },
    language: { type: String, trim: true, default: 'English' },
    price: { type: Number, min: 0, default: 0 },
    currency: { type: String, trim: true, uppercase: true, default: 'BDT' },
    durationHours: { type: Number, min: 0, default: 0 },
    thumbnailUrl: { type: String, trim: true, default: '' },
    outcomes: [{ type: String, trim: true }],
    requirements: [{ type: String, trim: true }],
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    publishedAt: Date,
  },
  { timestamps: true }
);

courseSchema.index({ status: 1, category: 1, level: 1 });
courseSchema.index({ teacher: 1, createdAt: -1 });
courseSchema.index({ title: 'text', subtitle: 'text', description: 'text', category: 'text' });

module.exports = mongoose.model('Course', courseSchema);
