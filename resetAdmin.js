require('dotenv').config();

const mongoose = require('mongoose');
const User = require('./models/User');
const Admin = require('./models/Admin');

async function resetAdmin() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/quiz-management-system';
    
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('MongoDB connected');

    // Delete all admin users
    const deleteUserResult = await User.deleteMany({ role: 'admin' });
    console.log(`Deleted ${deleteUserResult.deletedCount} admin user(s)`);

    // Delete all admin records
    const deleteAdminResult = await Admin.deleteMany({});
    console.log(`Deleted ${deleteAdminResult.deletedCount} admin record(s)`);

    console.log('\n✅ Admin accounts reset successfully!');
    console.log('You can now visit http://localhost:3000/admin/setup to create a new admin account\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error resetting admin:', error.message);
    process.exit(1);
  }
}

resetAdmin();
