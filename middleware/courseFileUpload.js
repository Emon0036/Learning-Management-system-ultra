const fs = require('fs');
const path = require('path');
const multer = require('multer');

const MAX_COURSE_FILE_SIZE = 25 * 1024 * 1024;
const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'course-files');

// Course files are stored locally for the demo LMS flow and served from /uploads/course-files.
const storage = multer.diskStorage({
  destination(req, file, callback) {
    // Create the folder lazily so a fresh checkout does not get an empty runtime directory.
    fs.mkdirSync(uploadDir, { recursive: true });
    callback(null, uploadDir);
  },
  filename(req, file, callback) {
    const safeBaseName = path
      .parse(file.originalname)
      .name
      .replace(/[^a-z0-9-_]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'course-file';
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeBaseName}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_COURSE_FILE_SIZE },
});

function isPdfFile(file) {
  return path.extname(file.originalname || '').toLowerCase() === '.pdf' || file.mimetype === 'application/pdf';
}

function buildUpload(pdfOnly = false) {
  return multer({
    storage,
    limits: { fileSize: MAX_COURSE_FILE_SIZE },
    fileFilter(req, file, callback) {
      if (!pdfOnly || isPdfFile(file)) return callback(null, true);

      const error = new Error('Only PDF files are allowed for assignments.');
      error.code = 'COURSE_PDF_ONLY';
      return callback(error);
    },
  });
}

function createCourseFileUpload(fieldName, label, pdfOnly = false) {
  const fieldUpload = pdfOnly ? buildUpload(true) : upload;

  return (req, res, next) => {
    fieldUpload.single(fieldName)(req, res, (error) => {
      if (!error) return next();

      const message = error.code === 'LIMIT_FILE_SIZE'
        ? `${label} must be 25MB or smaller.`
        : error.code === 'COURSE_PDF_ONLY'
          ? `${label} must be a PDF file.`
          : error.message || `${label} upload failed.`;

      req.flash('error', message);
      return res.redirect(req.get('referer') || '/teacher/courses');
    });
  };
}

const courseFileUpload = createCourseFileUpload('resourceFile', 'Course files');

courseFileUpload.assignmentQuestion = createCourseFileUpload('questionFile', 'Assignment question file', true);
courseFileUpload.assignmentAnswer = createCourseFileUpload('answerFile', 'Assignment answer file', true);

module.exports = courseFileUpload;
