const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    permissions: {
      manageUsers: { type: Boolean, default: true },
      manageTeachers: { type: Boolean, default: true },
      manageAdmins: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Admin', adminSchema);
