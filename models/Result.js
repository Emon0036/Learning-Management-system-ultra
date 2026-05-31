const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    attempt: { type: mongoose.Schema.Types.ObjectId, ref: 'Attempt', required: true },
    marksObtained: { type: Number, required: true },
    totalMarks: { type: Number, required: true },
    percentage: { type: Number, required: true },
    status: { type: String, enum: ['pass', 'fail', 'pending-review'], required: true },
    grade: { type: String, default: 'F' },
  },
  { timestamps: true }
);

resultSchema.pre('save', function assignGrade() {
  if (this.percentage >= 90) this.grade = 'A';
  else if (this.percentage >= 80) this.grade = 'B';
  else if (this.percentage >= 70) this.grade = 'C';
  else if (this.percentage >= 60) this.grade = 'D';
  else this.grade = 'F';
});

module.exports = mongoose.model('Result', resultSchema);
