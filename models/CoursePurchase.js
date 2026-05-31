const mongoose = require('mongoose');

// CoursePurchase is a demo payment receipt; no real payment gateway is called.
const coursePurchaseSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, min: 0, required: true },
    currency: { type: String, trim: true, uppercase: true, default: 'BDT' },
    status: { type: String, enum: ['paid', 'refunded'], default: 'paid' },
    provider: { type: String, default: 'demo-checkout' },
    transactionId: { type: String, required: true, unique: true },
    paidAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

coursePurchaseSchema.index({ student: 1, course: 1 });
coursePurchaseSchema.index({ teacher: 1, createdAt: -1 });

module.exports = mongoose.model('CoursePurchase', coursePurchaseSchema);
