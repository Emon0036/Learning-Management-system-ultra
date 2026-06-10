const crypto = require('crypto');
const fsSync = require('fs');
const fs = require('fs/promises');
const net = require('net');
const path = require('path');
const axios = require('axios');
const dns = require('dns').promises;
const Course = require('../models/Course');
const CourseLesson = require('../models/CourseLesson');
const CourseMaterial = require('../models/CourseMaterial');
const CourseSession = require('../models/CourseSession');
const CourseAssignment = require('../models/CourseAssignment');
const CourseAssignmentSubmission = require('../models/CourseAssignmentSubmission');
const CoursePurchase = require('../models/CoursePurchase');
const CourseEnrollment = require('../models/CourseEnrollment');
const Quiz = require('../models/Quiz');
const QuizEnrollment = require('../models/Enrollment');
const Progress = require('../models/Progress');
const { removeTabUser } = require('../middleware/tabSessionMiddleware');

const COURSE_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const MATERIAL_TYPES = ['note', 'file', 'recorded-class', 'external-link', 'community-link', 'youtube-class', 'vdocipher-class'];
const SESSION_STATUSES = ['scheduled', 'completed', 'cancelled'];
const VIDEO_MATERIAL_TYPES = new Set(['recorded-class', 'youtube-class', 'vdocipher-class']);
const DIRECT_VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.ogg', '.ogv', '.mov', '.m4v']);
const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'course-files');
const VDOCIPHER_API_BASE_URL = process.env.VDOCIPHER_API_BASE_URL || 'https://dev.vdocipher.com/api';
const VDOCIPHER_PLAYER_BASE_URL = process.env.VDOCIPHER_PLAYER_BASE_URL || 'https://player.vdocipher.com/v2/';
const VDOCIPHER_OTP_TTL_SECONDS = Math.max(60, safeNumber(process.env.VDOCIPHER_OTP_TTL_SECONDS, 300));

function cleanText(value) {
  return String(value || '').trim();
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeVdoCipherVideoId(value) {
  const rawValue = cleanText(value);
  if (!rawValue) return '';

  try {
    const parsedUrl = new URL(rawValue);
    const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
    const videoIndex = pathParts.findIndex((part) => ['videos', 'video'].includes(part.toLowerCase()));
    if (videoIndex > -1 && pathParts[videoIndex + 1]) return pathParts[videoIndex + 1].trim();
    if (parsedUrl.searchParams.get('videoId')) return parsedUrl.searchParams.get('videoId').trim();
    if (parsedUrl.searchParams.get('id')) return parsedUrl.searchParams.get('id').trim();
  } catch {}

  return rawValue;
}

function isValidVdoCipherVideoId(value) {
  return /^[a-zA-Z0-9_-]{6,128}$/.test(normalizeVdoCipherVideoId(value));
}

async function getVdoCipherPlayback(videoId) {
  const apiSecret = process.env.VDOCIPHER_API_SECRET;
  if (!apiSecret) {
    throw new Error('VDOCIPHER_API_SECRET is not configured.');
  }

  const response = await axios.post(
    `${VDOCIPHER_API_BASE_URL.replace(/\/+$/g, '')}/videos/${encodeURIComponent(videoId)}/otp`,
    { ttl: VDOCIPHER_OTP_TTL_SECONDS },
    {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Apisecret ${apiSecret}`,
      },
      timeout: Number(process.env.VDOCIPHER_API_TIMEOUT_MS) || 12000,
    }
  );

  if (!response.data?.otp || !response.data?.playbackInfo) {
    throw new Error('VdoCipher did not return playback credentials.');
  }

  return {
    otp: String(response.data.otp),
    playbackInfo: String(response.data.playbackInfo),
  };
}

function isDirectVideoPath(value) {
  try {
    const parsedUrl = new URL(value, 'https://quizmaster.local');
    return DIRECT_VIDEO_EXTENSIONS.has(path.extname(parsedUrl.pathname).toLowerCase());
  } catch {
    return DIRECT_VIDEO_EXTENSIONS.has(path.extname(cleanText(value)).toLowerCase());
  }
}

function isVideoUpload(file) {
  return Boolean(file && (String(file.mimetype || '').startsWith('video/') || isDirectVideoPath(file.originalname)));
}

function isSafeResourceUrl(resourceUrl) {
  if (!resourceUrl) return true;
  if (resourceUrl.startsWith('/')) return resourceUrl.startsWith('/uploads/course-files/');

  try {
    const parsedUrl = new URL(resourceUrl);
    return parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:';
  } catch {
    return false;
  }
}

function getVideoContentType(filePath, fallback = '') {
  if (fallback && fallback.startsWith('video/')) return fallback;

  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.webm') return 'video/webm';
  if (extension === '.ogg' || extension === '.ogv') return 'video/ogg';
  if (extension === '.mov') return 'video/quicktime';
  return 'video/mp4';
}

function getFileContentType(filePath, fallback = '') {
  if (fallback) return fallback;

  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.pdf') return 'application/pdf';
  if (extension === '.txt') return 'text/plain; charset=utf-8';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

function isPrivateIpAddress(address) {
  if (!address) return true;

  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    return (
      normalized === '::1' ||
      normalized === '::' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80:')
    );
  }

  if (!net.isIPv4(address)) return true;

  const parts = address.split('.').map((part) => Number(part));
  const [first, second] = parts;
  return (
    first === 10 ||
    first === 127 ||
    first === 0 ||
    first === 169 && second === 254 ||
    first === 172 && second >= 16 && second <= 31 ||
    first === 192 && second === 168
  );
}

async function assertPublicHttpUrl(rawUrl) {
  const parsedUrl = new URL(rawUrl);
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Only HTTP and HTTPS video links can be streamed.');
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('Local video links cannot be proxied.');
  }

  const addresses = await dns.lookup(hostname, { all: true });
  if (!addresses.length || addresses.some((item) => isPrivateIpAddress(item.address))) {
    throw new Error('Private video links cannot be proxied.');
  }
}

function resolveLocalCourseFile(resourceUrl) {
  if (!resourceUrl || !resourceUrl.startsWith('/uploads/course-files/')) return '';

  const filePath = path.resolve(path.join(__dirname, '..', 'public', resourceUrl));
  const resolvedUploadDir = path.resolve(uploadDir);
  if (!filePath.startsWith(`${resolvedUploadDir}${path.sep}`)) return '';
  return filePath;
}

function setProtectedContentHeaders(res) {
  res.set({
    'Cache-Control': 'no-store, private, max-age=0',
    Pragma: 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'display-capture=(), camera=(), microphone=()',
  });
}

function setProtectedFrameHeaders(res) {
  res.set({
    'Cache-Control': 'no-store, private, max-age=0',
    Pragma: 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'same-origin',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'display-capture=(), camera=(), microphone=()',
    'Content-Security-Policy': "default-src 'self'; frame-src https://player.vdocipher.com; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self';",
  });
}

function logoutTabAfterProtectionViolation(req, res, next, responsePayload) {
  const tabId = req.body.tab || req.query.tab || req.currentTabId;
  removeTabUser(req, tabId);
  req.flash('error', 'Protected course access ended because piracy behavior was detected.');

  const remainingTabIds = req.session?.tabUsers ? Object.keys(req.session.tabUsers) : [];
  if (!remainingTabIds.length && typeof req.logout === 'function') {
    return req.logout((error) => {
      if (error) return next(error);
      return res.status(403).json(responsePayload);
    });
  }

  if (req.session && req.session.passport && !req.session.passport.user && remainingTabIds.length) {
    req.session.passport.user = req.session.tabUsers[remainingTabIds[0]];
  }

  return res.status(403).json(responsePayload);
}

async function streamLocalVideo(req, res, material, filePath) {
  const stats = await fs.stat(filePath);
  const totalSize = stats.size;
  const contentType = getVideoContentType(filePath, material.fileMimeType);
  const range = req.headers.range;

  setProtectedContentHeaders(res);
  res.set({
    'Accept-Ranges': 'bytes',
    'Content-Type': contentType,
    'Content-Disposition': 'inline',
  });

  if (!range) {
    res.set('Content-Length', totalSize);
    return fsSync.createReadStream(filePath).pipe(res);
  }

  const match = range.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return res.status(416).end();

  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : totalSize - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= totalSize) {
    res.set('Content-Range', `bytes */${totalSize}`);
    return res.status(416).end();
  }

  res.status(206).set({
    'Content-Range': `bytes ${start}-${end}/${totalSize}`,
    'Content-Length': end - start + 1,
  });
  return fsSync.createReadStream(filePath, { start, end }).pipe(res);
}

async function sendLocalCourseFile(res, material, filePath) {
  await fs.stat(filePath);
  setProtectedContentHeaders(res);
  res.set({
    'Content-Type': getFileContentType(filePath, material.fileMimeType),
    'Content-Disposition': `inline; filename="${encodeURIComponent(material.fileName || path.basename(filePath))}"`,
  });
  return res.sendFile(filePath);
}

async function streamRemoteVideo(req, res, material) {
  await assertPublicHttpUrl(material.resourceUrl);

  const upstream = await axios.get(material.resourceUrl, {
    responseType: 'stream',
    headers: req.headers.range ? { Range: req.headers.range } : {},
    maxRedirects: 0,
    timeout: Number(process.env.COURSE_VIDEO_PROXY_TIMEOUT_MS) || 12000,
    validateStatus: (status) => (status >= 200 && status < 300) || status === 416,
  });

  setProtectedContentHeaders(res);
  res.status(upstream.status);
  ['content-type', 'content-length', 'content-range', 'accept-ranges'].forEach((header) => {
    if (upstream.headers[header]) res.set(header, upstream.headers[header]);
  });
  if (!res.get('Content-Type')) res.set('Content-Type', getVideoContentType(material.resourceUrl, material.fileMimeType));
  res.set('Content-Disposition', 'inline');

  upstream.data.on('error', () => res.end());
  return upstream.data.pipe(res);
}

function isStreamableVideoMaterial(material) {
  if (!material) return false;
  return material.type !== 'vdocipher-class' && (
    VIDEO_MATERIAL_TYPES.has(material.type) ||
    isDirectVideoPath(material.resourceUrl) ||
    String(material.fileMimeType || '').startsWith('video/')
  );
}

function splitLines(value) {
  return cleanText(value)
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildCurrency(value) {
  const currency = cleanText(value || 'BDT').toUpperCase();
  return currency.slice(0, 3) || 'BDT';
}

function buildCoursePayload(body) {
  const price = safeNumber(body.price);
  const durationHours = safeNumber(body.durationHours);
  const payload = {
    title: cleanText(body.title),
    subtitle: cleanText(body.subtitle),
    description: cleanText(body.description),
    category: cleanText(body.category) || 'General',
    level: COURSE_LEVELS.includes(body.level) ? body.level : 'Beginner',
    language: cleanText(body.language) || 'English',
    price,
    currency: buildCurrency(body.currency),
    durationHours,
    thumbnailUrl: cleanText(body.thumbnailUrl),
    outcomes: splitLines(body.outcomes),
    requirements: splitLines(body.requirements),
  };

  const errors = [];
  if (!payload.title) errors.push('Course title is required.');
  if (!payload.description) errors.push('Course description is required.');
  if (price < 0) errors.push('Course price cannot be negative.');
  if (durationHours < 0) errors.push('Course duration cannot be negative.');

  return { payload, errors };
}

async function getTeacherCourse(courseId, teacherId) {
  return Course.findOne({ _id: courseId, teacher: teacherId });
}

async function getCourseWorkspaceData(course, teacherId) {
  const [lessons, materials, sessions, assignments, quizzes, enrollmentCount, purchaseCount] = await Promise.all([
    CourseLesson.find({ course: course._id }).populate('quiz', 'title status examType duration totalMarks').sort({ position: 1, createdAt: 1 }),
    CourseMaterial.find({ course: course._id }).populate('lesson', 'title position').sort({ position: 1, createdAt: 1 }),
    CourseSession.find({ course: course._id }).sort({ scheduledAt: 1 }),
    CourseAssignment.find({ course: course._id }).populate('lesson', 'title position').sort({ position: 1, dueAt: 1 }).lean(),
    Quiz.find({ createdBy: teacherId }).select('title status category examType totalMarks duration').sort('-createdAt'),
    CourseEnrollment.countDocuments({ course: course._id }),
    CoursePurchase.countDocuments({ course: course._id, status: 'paid' }),
  ]);

  const assignmentIds = assignments.map((assignment) => assignment._id);
  const submissions = assignmentIds.length
    ? await CourseAssignmentSubmission.find({ assignment: { $in: assignmentIds } })
        .populate('student', 'name email profileImage')
        .populate('reviewedBy', 'name')
        .sort('-submittedAt')
        .lean()
    : [];
  const submissionsByAssignment = new Map();
  submissions.forEach((submission) => {
    const key = String(submission.assignment);
    if (!submissionsByAssignment.has(key)) submissionsByAssignment.set(key, []);
    submissionsByAssignment.get(key).push(submission);
  });

  assignments.forEach((assignment) => {
    assignment.submissions = submissionsByAssignment.get(String(assignment._id)) || [];
  });

  return { lessons, materials, sessions, assignments, quizzes, enrollmentCount, purchaseCount };
}

function materialsByLesson(materials) {
  const grouped = new Map();

  materials.forEach((material) => {
    const key = material.lesson ? String(material.lesson._id || material.lesson) : 'course';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(material);
  });

  return grouped;
}

function buildUploadedFilePayload(file) {
  if (!file) return {};

  return {
    resourceUrl: `/uploads/course-files/${file.filename}`,
    fileName: file.originalname,
    fileMimeType: file.mimetype,
    fileSize: file.size,
  };
}

function buildAssignmentFilePayload(file, prefix) {
  if (!file) return {};

  return {
    [`${prefix}FileUrl`]: `/uploads/course-files/${file.filename}`,
    [`${prefix}FileName`]: file.originalname,
    [`${prefix}FileMimeType`]: file.mimetype,
    [`${prefix}FileSize`]: file.size,
  };
}

function materialTypeForVideoUrl(resourceUrl) {
  try {
    const parsedUrl = new URL(resourceUrl);
    const host = parsedUrl.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be' || host === 'youtube.com' || host === 'm.youtube.com') return 'youtube-class';
  } catch {}

  return 'recorded-class';
}

async function redirectWithMaterialError(req, res, course, message) {
  if (req.file) {
    await removeLocalCourseFile(`/uploads/course-files/${req.file.filename}`);
  }

  req.flash('error', message);
  return res.redirect(`/teacher/courses/${course._id}/edit`);
}

async function redirectWithAssignmentError(req, res, course, message) {
  if (req.file) {
    await removeLocalCourseFile(`/uploads/course-files/${req.file.filename}`);
  }

  req.flash('error', message);
  return res.redirect(`/teacher/courses/${course._id}/edit`);
}

async function removeLocalCourseFile(resourceUrl) {
  if (!resourceUrl || !resourceUrl.startsWith('/uploads/course-files/')) return;

  const filePath = path.resolve(path.join(__dirname, '..', 'public', resourceUrl));
  const resolvedUploadDir = path.resolve(uploadDir);
  if (!filePath.startsWith(resolvedUploadDir)) return;

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function addQuizProgressForCourseEnrollment(studentId, quiz) {
  const progress = await Progress.findOneAndUpdate(
    { student: studentId },
    { $setOnInsert: { student: studentId } },
    { upsert: true, returnDocument: 'after' }
  );

  progress.totalQuizzes += 1;
  progress.inProgressQuizzes += 1;

  const category = quiz.category || 'General';
  const categoryIndex = progress.quizzesByCategory.findIndex((item) => item.category === category);
  if (categoryIndex > -1) {
    progress.quizzesByCategory[categoryIndex].total += 1;
  } else {
    progress.quizzesByCategory.push({ category, total: 1, completed: 0, averageScore: 0 });
  }

  await progress.save();
}

async function enrollStudentInLinkedQuizzes(studentId, courseId) {
  const lessons = await CourseLesson.find({ course: courseId }).populate('quiz');
  let enrolledQuizCount = 0;

  for (const lesson of lessons) {
    const quiz = lesson.quiz;
    if (!quiz || quiz.status !== 'published') continue;

    const existing = await QuizEnrollment.findOne({ student: studentId, quiz: quiz._id });
    if (existing) continue;

    await QuizEnrollment.create({ student: studentId, quiz: quiz._id });
    await addQuizProgressForCourseEnrollment(studentId, quiz);
    enrolledQuizCount += 1;
  }

  return enrolledQuizCount;
}

async function getStudentCourseEnrollment(studentId, courseId) {
  return CourseEnrollment.findOne({
    student: studentId,
    course: courseId,
    status: { $in: ['active', 'completed'] },
  }).populate('purchase');
}

// Teacher: show every course owned by the current approved teacher.
exports.listTeacherCourses = async (req, res) => {
  const courses = await Course.find({ teacher: req.user._id }).sort('-createdAt');
  const courseIds = courses.map((course) => course._id);

  const [enrollmentStats, lessonStats, upcomingSessionStats] = courseIds.length
    ? await Promise.all([
        CourseEnrollment.aggregate([
          { $match: { course: { $in: courseIds } } },
          { $group: { _id: '$course', enrolledCount: { $sum: 1 } } },
        ]),
        CourseLesson.aggregate([
          { $match: { course: { $in: courseIds } } },
          { $group: { _id: '$course', lessonCount: { $sum: 1 } } },
        ]),
        CourseSession.aggregate([
          { $match: { course: { $in: courseIds }, status: 'scheduled', scheduledAt: { $gte: new Date() } } },
          { $group: { _id: '$course', upcomingSessionCount: { $sum: 1 } } },
        ]),
      ])
    : [[], [], []];

  const enrollmentsByCourse = new Map(enrollmentStats.map((item) => [String(item._id), item.enrolledCount]));
  const lessonsByCourse = new Map(lessonStats.map((item) => [String(item._id), item.lessonCount]));
  const sessionsByCourse = new Map(upcomingSessionStats.map((item) => [String(item._id), item.upcomingSessionCount]));

  courses.forEach((course) => {
    course.enrolledCount = enrollmentsByCourse.get(String(course._id)) || 0;
    course.lessonCount = lessonsByCourse.get(String(course._id)) || 0;
    course.upcomingSessionCount = sessionsByCourse.get(String(course._id)) || 0;
  });

  res.render('teacher/courses', {
    title: 'Manage Courses',
    courses,
    stats: {
      totalCourses: courses.length,
      publishedCourses: courses.filter((course) => course.status === 'published').length,
      draftCourses: courses.filter((course) => course.status === 'draft').length,
    },
  });
};

// Teacher: render an empty course builder.
exports.showCreateCourse = (req, res) => {
  res.render('teacher/course-form', {
    title: 'Create Course',
    course: {},
    action: '/teacher/courses',
    lessons: [],
    materials: [],
    sessions: [],
    assignments: [],
    quizzes: [],
    materialsByLesson: new Map(),
    enrollmentCount: 0,
    purchaseCount: 0,
  });
};

// Teacher: create the course shell before lessons and resources are added.
exports.createCourse = async (req, res) => {
  const { payload, errors } = buildCoursePayload(req.body);
  if (errors.length) {
    req.flash('error', errors[0]);
    return res.redirect('/teacher/courses/new');
  }

  const course = await Course.create({ ...payload, teacher: req.user._id, status: 'draft' });
  req.flash('success', 'Course created. Add lessons, sessions, files, and quizzes below.');
  return res.redirect(`/teacher/courses/${course._id}/edit`);
};

// Teacher: open the full course builder with lessons, materials, sessions, and quizzes.
exports.showEditCourse = async (req, res) => {
  const course = await getTeacherCourse(req.params.courseId, req.user._id);
  if (!course) {
    req.flash('error', 'Course not found.');
    return res.redirect('/teacher/courses');
  }

  const workspace = await getCourseWorkspaceData(course, req.user._id);
  return res.render('teacher/course-form', {
    title: 'Edit Course',
    course,
    action: `/teacher/courses/${course._id}?_method=PUT`,
    ...workspace,
    materialsByLesson: materialsByLesson(workspace.materials),
  });
};

// Teacher: update course catalog details.
exports.updateCourse = async (req, res) => {
  const course = await getTeacherCourse(req.params.courseId, req.user._id);
  if (!course) {
    req.flash('error', 'Course not found.');
    return res.redirect('/teacher/courses');
  }

  const { payload, errors } = buildCoursePayload(req.body);
  if (errors.length) {
    req.flash('error', errors[0]);
    return res.redirect(`/teacher/courses/${course._id}/edit`);
  }

  Object.assign(course, payload);
  await course.save();
  req.flash('success', 'Course details updated.');
  return res.redirect(`/teacher/courses/${course._id}/edit`);
};

// Teacher: remove a course and all LMS records owned by that course.
exports.deleteCourse = async (req, res) => {
  const course = await getTeacherCourse(req.params.courseId, req.user._id);
  if (!course) {
    req.flash('error', 'Course not found.');
    return res.redirect('/teacher/courses');
  }

  const [materials, assignments, assignmentSubmissions] = await Promise.all([
    CourseMaterial.find({ course: course._id }),
    CourseAssignment.find({ course: course._id }),
    CourseAssignmentSubmission.find({ course: course._id }),
  ]);
  await Promise.all(materials.map((material) => removeLocalCourseFile(material.resourceUrl)));
  await Promise.all(assignments.map((assignment) => removeLocalCourseFile(assignment.questionFileUrl)));
  await Promise.all(assignmentSubmissions.map((submission) => removeLocalCourseFile(submission.answerFileUrl)));
  await Promise.all([
    CourseLesson.deleteMany({ course: course._id }),
    CourseMaterial.deleteMany({ course: course._id }),
    CourseSession.deleteMany({ course: course._id }),
    CourseAssignment.deleteMany({ course: course._id }),
    CourseAssignmentSubmission.deleteMany({ course: course._id }),
    CourseEnrollment.deleteMany({ course: course._id }),
    CoursePurchase.deleteMany({ course: course._id }),
    Course.deleteOne({ _id: course._id }),
  ]);

  req.flash('success', 'Course and LMS content deleted.');
  return res.redirect('/teacher/courses');
};

// Teacher: publish only after the course contains at least one lesson.
exports.toggleCoursePublish = async (req, res) => {
  const course = await getTeacherCourse(req.params.courseId, req.user._id);
  if (!course) {
    req.flash('error', 'Course not found.');
    return res.redirect('/teacher/courses');
  }

  if (course.status === 'draft') {
    const lessonCount = await CourseLesson.countDocuments({ course: course._id });
    if (!lessonCount) {
      req.flash('error', 'Add at least one lesson before publishing this course.');
      return res.redirect(`/teacher/courses/${course._id}/edit`);
    }
    course.status = 'published';
    course.publishedAt = new Date();
  } else {
    course.status = 'draft';
  }

  await course.save();
  req.flash('success', `Course ${course.status === 'published' ? 'published' : 'unpublished'}.`);
  return res.redirect('/teacher/courses');
};

// Teacher: add a lesson and optionally connect one of the teacher's existing quizzes.
exports.createLesson = async (req, res) => {
  const course = await getTeacherCourse(req.params.courseId, req.user._id);
  if (!course) {
    req.flash('error', 'Course not found.');
    return res.redirect('/teacher/courses');
  }

  const title = cleanText(req.body.title);
  if (!title) {
    req.flash('error', 'Lesson title is required.');
    return res.redirect(`/teacher/courses/${course._id}/edit`);
  }

  let quizId = null;
  if (cleanText(req.body.quiz)) {
    const quiz = await Quiz.findOne({ _id: req.body.quiz, createdBy: req.user._id });
    if (!quiz) {
      req.flash('error', 'Selected quiz was not found in your quiz library.');
      return res.redirect(`/teacher/courses/${course._id}/edit`);
    }
    quizId = quiz._id;
  }

  const nextPosition = (await CourseLesson.countDocuments({ course: course._id })) + 1;
  const lesson = await CourseLesson.create({
    course: course._id,
    teacher: req.user._id,
    title,
    description: cleanText(req.body.description),
    durationMinutes: Math.max(0, safeNumber(req.body.durationMinutes)),
    position: Math.max(1, safeNumber(req.body.position, nextPosition)),
    quiz: quizId,
    isPreview: String(req.body.isPreview || '') === 'on',
  });

  const videoUrl = cleanText(req.body.videoUrl);
  if (videoUrl) {
    await CourseMaterial.create({
      course: course._id,
      teacher: req.user._id,
      lesson: lesson._id,
      title: cleanText(req.body.videoTitle) || `${title} class video`,
      type: materialTypeForVideoUrl(videoUrl),
      content: cleanText(req.body.videoDescription),
      resourceUrl: videoUrl,
      position: 1,
    });
  }

  req.flash('success', videoUrl ? 'Lesson and class video added.' : 'Lesson added.');
  return res.redirect(`/teacher/courses/${course._id}/edit`);
};

// Teacher: delete a lesson and the materials attached to it.
exports.deleteLesson = async (req, res) => {
  const course = await getTeacherCourse(req.params.courseId, req.user._id);
  if (!course) {
    req.flash('error', 'Course not found.');
    return res.redirect('/teacher/courses');
  }

  const lesson = await CourseLesson.findOne({ _id: req.params.lessonId, course: course._id, teacher: req.user._id });
  if (!lesson) {
    req.flash('error', 'Lesson not found.');
    return res.redirect(`/teacher/courses/${course._id}/edit`);
  }

  const [materials, assignments] = await Promise.all([
    CourseMaterial.find({ lesson: lesson._id, course: course._id }),
    CourseAssignment.find({ lesson: lesson._id, course: course._id }),
  ]);
  const assignmentIds = assignments.map((assignment) => assignment._id);
  const assignmentSubmissions = assignmentIds.length
    ? await CourseAssignmentSubmission.find({ assignment: { $in: assignmentIds } })
    : [];
  await Promise.all(materials.map((material) => removeLocalCourseFile(material.resourceUrl)));
  await Promise.all(assignments.map((assignment) => removeLocalCourseFile(assignment.questionFileUrl)));
  await Promise.all(assignmentSubmissions.map((submission) => removeLocalCourseFile(submission.answerFileUrl)));
  await Promise.all([
    CourseMaterial.deleteMany({ lesson: lesson._id, course: course._id }),
    CourseAssignment.deleteMany({ lesson: lesson._id, course: course._id }),
    CourseAssignmentSubmission.deleteMany({ assignment: { $in: assignmentIds } }),
    CourseEnrollment.updateMany({ course: course._id }, { $pull: { completedLessons: lesson._id } }),
    CourseLesson.deleteOne({ _id: lesson._id }),
  ]);

  req.flash('success', 'Lesson deleted.');
  return res.redirect(`/teacher/courses/${course._id}/edit`);
};

// Teacher: connect or replace the quiz attached to a course section.
exports.updateLessonQuiz = async (req, res) => {
  const course = await getTeacherCourse(req.params.courseId, req.user._id);
  if (!course) {
    req.flash('error', 'Course not found.');
    return res.redirect('/teacher/courses');
  }

  const lesson = await CourseLesson.findOne({ _id: req.params.lessonId, course: course._id, teacher: req.user._id });
  if (!lesson) {
    req.flash('error', 'Section not found.');
    return res.redirect(`/teacher/courses/${course._id}/edit`);
  }

  const quizId = cleanText(req.body.quiz);
  if (!quizId) {
    lesson.quiz = undefined;
    await lesson.save();
    req.flash('success', 'Quiz removed from this section.');
    return res.redirect(`/teacher/courses/${course._id}/edit#topic-${lesson._id}`);
  }

  const quiz = await Quiz.findOne({ _id: quizId, createdBy: req.user._id });
  if (!quiz) {
    req.flash('error', 'Selected quiz was not found in your quiz library.');
    return res.redirect(`/teacher/courses/${course._id}/edit#topic-${lesson._id}`);
  }

  lesson.quiz = quiz._id;
  await lesson.save();
  req.flash('success', 'Quiz attached to this section.');
  return res.redirect(`/teacher/courses/${course._id}/edit#topic-${lesson._id}`);
};

// Teacher: add a note, file, recorded class, or external resource.
exports.createMaterial = async (req, res) => {
  const course = await getTeacherCourse(req.params.courseId, req.user._id);
  if (!course) {
    req.flash('error', 'Course not found.');
    return res.redirect('/teacher/courses');
  }

  const title = cleanText(req.body.title);
  const type = MATERIAL_TYPES.includes(req.body.type) ? req.body.type : 'note';
  const lessonId = cleanText(req.body.lesson);
  const content = cleanText(req.body.content);
  const resourceUrl = cleanText(req.body.resourceUrl);
  const uploadedFileIsVideo = isVideoUpload(req.file);
  const storedType = uploadedFileIsVideo ? 'recorded-class' : type;

  if (!title) {
    return redirectWithMaterialError(req, res, course, 'Material title is required.');
  }

  if (storedType === 'vdocipher-class' && !isValidVdoCipherVideoId(resourceUrl)) {
    return redirectWithMaterialError(req, res, course, 'Add a valid VdoCipher video ID for this material.');
  }

  if (storedType !== 'vdocipher-class' && !isSafeResourceUrl(resourceUrl)) {
    return redirectWithMaterialError(req, res, course, 'Use a valid HTTP, HTTPS, or course upload URL.');
  }

  let lesson = null;
  if (lessonId) {
    lesson = await CourseLesson.findOne({ _id: lessonId, course: course._id, teacher: req.user._id });
    if (!lesson) {
      return redirectWithMaterialError(req, res, course, 'Selected lesson was not found.');
    }
  }

  if (storedType === 'note' && !content) {
    return redirectWithMaterialError(req, res, course, 'Write note content before saving.');
  }

  if (storedType === 'file' && !req.file) {
    return redirectWithMaterialError(req, res, course, 'Choose a file to upload.');
  }

  if (['recorded-class', 'external-link', 'community-link', 'youtube-class', 'vdocipher-class'].includes(storedType) && !resourceUrl && !uploadedFileIsVideo) {
    return redirectWithMaterialError(req, res, course, 'Add a resource URL for this material.');
  }

  if (storedType !== 'file' && !uploadedFileIsVideo && req.file) {
    await removeLocalCourseFile(`/uploads/course-files/${req.file.filename}`);
  }

  const uploadedFilePayload = req.file && (storedType === 'file' || uploadedFileIsVideo)
    ? buildUploadedFilePayload(req.file)
    : {};
  const nextPosition = (await CourseMaterial.countDocuments({ course: course._id })) + 1;
  await CourseMaterial.create({
    course: course._id,
    teacher: req.user._id,
    lesson: lesson ? lesson._id : undefined,
    title,
    type: storedType,
    content,
    resourceUrl: storedType === 'vdocipher-class'
      ? normalizeVdoCipherVideoId(resourceUrl)
      : resourceUrl || uploadedFilePayload.resourceUrl || '',
    ...uploadedFilePayload,
    position: Math.max(1, safeNumber(req.body.position, nextPosition)),
  });

  req.flash('success', 'Course material added.');
  return res.redirect(`/teacher/courses/${course._id}/edit`);
};

// Teacher: remove a material and delete its uploaded file when applicable.
exports.deleteMaterial = async (req, res) => {
  const course = await getTeacherCourse(req.params.courseId, req.user._id);
  if (!course) {
    req.flash('error', 'Course not found.');
    return res.redirect('/teacher/courses');
  }

  const material = await CourseMaterial.findOne({ _id: req.params.materialId, course: course._id, teacher: req.user._id });
  if (!material) {
    req.flash('error', 'Material not found.');
    return res.redirect(`/teacher/courses/${course._id}/edit`);
  }

  await removeLocalCourseFile(material.resourceUrl);
  await CourseMaterial.deleteOne({ _id: material._id });

  req.flash('success', 'Material deleted.');
  return res.redirect(`/teacher/courses/${course._id}/edit`);
};

// Teacher: schedule an online class session for enrolled students.
exports.createSession = async (req, res) => {
  const course = await getTeacherCourse(req.params.courseId, req.user._id);
  if (!course) {
    req.flash('error', 'Course not found.');
    return res.redirect('/teacher/courses');
  }

  const title = cleanText(req.body.title);
  const scheduledAt = new Date(req.body.scheduledAt);
  const meetingUrl = cleanText(req.body.meetingUrl);

  if (!title) {
    req.flash('error', 'Session title is required.');
    return res.redirect(`/teacher/courses/${course._id}/edit`);
  }
  if (Number.isNaN(scheduledAt.getTime())) {
    req.flash('error', 'Choose a valid class date and time.');
    return res.redirect(`/teacher/courses/${course._id}/edit`);
  }
  if (!meetingUrl) {
    req.flash('error', 'Meeting link is required.');
    return res.redirect(`/teacher/courses/${course._id}/edit`);
  }

  await CourseSession.create({
    course: course._id,
    teacher: req.user._id,
    title,
    description: cleanText(req.body.description),
    scheduledAt,
    durationMinutes: Math.max(1, safeNumber(req.body.durationMinutes, 60)),
    meetingUrl,
    recordingUrl: cleanText(req.body.recordingUrl),
  });

  req.flash('success', 'Online session scheduled.');
  return res.redirect(`/teacher/courses/${course._id}/edit`);
};

// Teacher: update session status and attach a recording link after class.
exports.updateSessionStatus = async (req, res) => {
  const course = await getTeacherCourse(req.params.courseId, req.user._id);
  if (!course) {
    req.flash('error', 'Course not found.');
    return res.redirect('/teacher/courses');
  }

  const session = await CourseSession.findOne({ _id: req.params.sessionId, course: course._id, teacher: req.user._id });
  if (!session) {
    req.flash('error', 'Session not found.');
    return res.redirect(`/teacher/courses/${course._id}/edit`);
  }

  if (SESSION_STATUSES.includes(req.body.status)) session.status = req.body.status;
  session.recordingUrl = cleanText(req.body.recordingUrl) || session.recordingUrl;
  await session.save();

  req.flash('success', 'Session updated.');
  return res.redirect(`/teacher/courses/${course._id}/edit`);
};

// Teacher: delete an online session from the course schedule.
exports.deleteSession = async (req, res) => {
  const course = await getTeacherCourse(req.params.courseId, req.user._id);
  if (!course) {
    req.flash('error', 'Course not found.');
    return res.redirect('/teacher/courses');
  }

  await CourseSession.deleteOne({ _id: req.params.sessionId, course: course._id, teacher: req.user._id });
  req.flash('success', 'Session deleted.');
  return res.redirect(`/teacher/courses/${course._id}/edit`);
};

// Teacher: publish an assignment with a question PDF and submission deadline.
exports.createAssignment = async (req, res) => {
  const course = await getTeacherCourse(req.params.courseId, req.user._id);
  if (!course) {
    req.flash('error', 'Course not found.');
    return res.redirect('/teacher/courses');
  }

  const title = cleanText(req.body.title);
  const dueAt = new Date(req.body.dueAt);
  const lessonId = cleanText(req.body.lesson);

  if (!title) {
    return redirectWithAssignmentError(req, res, course, 'Assignment title is required.');
  }
  if (!req.file) {
    return redirectWithAssignmentError(req, res, course, 'Upload the question PDF for this assignment.');
  }
  if (Number.isNaN(dueAt.getTime())) {
    return redirectWithAssignmentError(req, res, course, 'Choose a valid assignment deadline.');
  }

  let lesson = null;
  if (lessonId) {
    lesson = await CourseLesson.findOne({ _id: lessonId, course: course._id, teacher: req.user._id });
    if (!lesson) {
      return redirectWithAssignmentError(req, res, course, 'Selected lesson was not found.');
    }
  }

  const nextPosition = (await CourseAssignment.countDocuments({ course: course._id })) + 1;
  await CourseAssignment.create({
    course: course._id,
    teacher: req.user._id,
    lesson: lesson ? lesson._id : undefined,
    title,
    instructions: cleanText(req.body.instructions),
    dueAt,
    maxMarks: Math.max(0, safeNumber(req.body.maxMarks)),
    ...buildAssignmentFilePayload(req.file, 'question'),
    position: Math.max(1, safeNumber(req.body.position, nextPosition)),
  });

  req.flash('success', 'Assignment added. Students can submit answer PDFs from the classroom.');
  return res.redirect(`/teacher/courses/${course._id}/edit`);
};

// Teacher: delete an assignment, its question PDF, and every answer PDF submitted to it.
exports.deleteAssignment = async (req, res) => {
  const course = await getTeacherCourse(req.params.courseId, req.user._id);
  if (!course) {
    req.flash('error', 'Course not found.');
    return res.redirect('/teacher/courses');
  }

  const assignment = await CourseAssignment.findOne({ _id: req.params.assignmentId, course: course._id, teacher: req.user._id });
  if (!assignment) {
    req.flash('error', 'Assignment not found.');
    return res.redirect(`/teacher/courses/${course._id}/edit`);
  }

  const submissions = await CourseAssignmentSubmission.find({ assignment: assignment._id });
  await removeLocalCourseFile(assignment.questionFileUrl);
  await Promise.all(submissions.map((submission) => removeLocalCourseFile(submission.answerFileUrl)));
  await Promise.all([
    CourseAssignmentSubmission.deleteMany({ assignment: assignment._id }),
    CourseAssignment.deleteOne({ _id: assignment._id }),
  ]);

  req.flash('success', 'Assignment deleted.');
  return res.redirect(`/teacher/courses/${course._id}/edit`);
};

// Teacher: review a student's submitted answer PDF with marks and feedback.
exports.reviewAssignmentSubmission = async (req, res) => {
  const course = await getTeacherCourse(req.params.courseId, req.user._id);
  if (!course) {
    req.flash('error', 'Course not found.');
    return res.redirect('/teacher/courses');
  }

  const assignment = await CourseAssignment.findOne({ _id: req.params.assignmentId, course: course._id, teacher: req.user._id });
  if (!assignment) {
    req.flash('error', 'Assignment not found.');
    return res.redirect(`/teacher/courses/${course._id}/edit`);
  }

  const submission = await CourseAssignmentSubmission.findOne({
    _id: req.params.submissionId,
    assignment: assignment._id,
    course: course._id,
  });
  if (!submission) {
    req.flash('error', 'Assignment submission not found.');
    return res.redirect(`/teacher/courses/${course._id}/edit`);
  }

  const marksAwarded = Number(req.body.marksAwarded);
  if (!Number.isFinite(marksAwarded) || marksAwarded < 0 || (assignment.maxMarks > 0 && marksAwarded > assignment.maxMarks)) {
    req.flash('error', assignment.maxMarks > 0 ? `Marks must be between 0 and ${assignment.maxMarks}.` : 'Marks must be zero or greater.');
    return res.redirect(`/teacher/courses/${course._id}/edit#assignment-${assignment._id}`);
  }

  submission.marksAwarded = marksAwarded;
  submission.teacherComment = cleanText(req.body.teacherComment);
  submission.status = 'reviewed';
  submission.reviewedBy = req.user._id;
  submission.reviewedAt = new Date();
  await submission.save();

  req.flash('success', 'Assignment submission reviewed.');
  return res.redirect(`/teacher/courses/${course._id}/edit#assignment-${assignment._id}`);
};

// Teacher: view students and demo purchases for one course.
exports.courseStudents = async (req, res) => {
  const course = await getTeacherCourse(req.params.courseId, req.user._id);
  if (!course) {
    req.flash('error', 'Course not found.');
    return res.redirect('/teacher/courses');
  }

  const enrollments = await CourseEnrollment.find({ course: course._id })
    .populate('student', 'name email profileImage')
    .populate('purchase')
    .sort('-createdAt');

  res.render('teacher/course-students', {
    title: 'Course Students',
    course,
    enrollments,
  });
};

// Student/public: browse published course catalog with filters.
exports.catalog = async (req, res) => {
  const selectedCategory = cleanText(req.query.category || 'all');
  const selectedLevel = cleanText(req.query.level || 'all');
  const selectedTeacherId = cleanText(req.query.teacher || 'all');
  const search = cleanText(req.query.q);
  const filter = { status: 'published' };

  if (selectedCategory !== 'all') filter.category = selectedCategory;
  if (selectedLevel !== 'all') filter.level = selectedLevel;
  if (selectedTeacherId !== 'all') filter.teacher = selectedTeacherId;
  if (search) {
    const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { title: searchRegex },
      { subtitle: searchRegex },
      { description: searchRegex },
      { category: searchRegex },
    ];
  }

  const [courses, categories, teacherSourceCourses, myEnrollments] = await Promise.all([
    Course.find(filter).populate('teacher', 'name email accountStatus role').sort('-publishedAt -createdAt'),
    Course.distinct('category', { status: 'published' }),
    Course.find({ status: 'published' }).select('teacher').populate('teacher', 'name role accountStatus'),
    req.isAuthenticated() && req.user.role === 'student'
      ? CourseEnrollment.find({ student: req.user._id }).select('course status progressPercentage')
      : Promise.resolve([]),
  ]);

  const teacherMap = new Map();
  teacherSourceCourses.forEach((course) => {
    const teacher = course.teacher;
    if (!teacher || teacher.role !== 'teacher' || teacher.accountStatus === 'blocked') return;
    teacherMap.set(String(teacher._id), { id: String(teacher._id), name: teacher.name });
  });

  const enrollmentByCourseId = new Map(myEnrollments.map((enrollment) => [String(enrollment.course), enrollment]));

  res.render('courses/catalog', {
    title: 'Course Catalog',
    courses,
    categories: categories.map((category) => category || 'General').sort((left, right) => left.localeCompare(right)),
    teacherOptions: Array.from(teacherMap.values()).sort((left, right) => left.name.localeCompare(right.name)),
    selectedCategory,
    selectedLevel,
    selectedTeacherId,
    search,
    enrollmentByCourseId,
  });
};

// Student/public: show the course sales/detail page.
exports.detail = async (req, res) => {
  const course = await Course.findOne({ _id: req.params.courseId, status: 'published' }).populate('teacher', 'name email');
  if (!course) {
    req.flash('error', 'Course is not available.');
    return res.redirect('/courses');
  }

  const [lessons, materials, sessions, assignments, enrollment] = await Promise.all([
    CourseLesson.find({ course: course._id }).populate('quiz', 'title status examType duration totalMarks').sort({ position: 1, createdAt: 1 }),
    CourseMaterial.find({ course: course._id }).select('title type lesson position').sort({ position: 1, createdAt: 1 }),
    CourseSession.find({ course: course._id, status: { $in: ['scheduled', 'completed'] } }).sort({ scheduledAt: 1 }),
    CourseAssignment.find({ course: course._id }).select('title lesson dueAt maxMarks position').sort({ position: 1, dueAt: 1 }),
    req.isAuthenticated() && req.user.role === 'student'
      ? getStudentCourseEnrollment(req.user._id, course._id)
      : Promise.resolve(null),
  ]);

  res.render('courses/detail', {
    title: course.title,
    course,
    lessons,
    materials,
    sessions,
    assignments,
    enrollment,
    materialsByLesson: materialsByLesson(materials),
  });
};

// Student: show the demo payment screen before purchase confirmation.
exports.checkout = async (req, res) => {
  const course = await Course.findOne({ _id: req.params.courseId, status: 'published' }).populate('teacher', 'name email');
  if (!course) {
    req.flash('error', 'Course is not available for purchase.');
    return res.redirect('/courses');
  }

  const enrollment = await getStudentCourseEnrollment(req.user._id, course._id);
  if (enrollment) {
    req.flash('success', 'You already own this course.');
    return res.redirect(`/courses/${course._id}/learn`);
  }

  res.render('courses/checkout', {
    title: 'Demo Checkout',
    course,
  });
};

// Student: complete a demo transaction and unlock the course.
exports.purchase = async (req, res) => {
  const course = await Course.findOne({ _id: req.params.courseId, status: 'published' });
  if (!course) {
    req.flash('error', 'Course is not available for purchase.');
    return res.redirect('/courses');
  }

  const existingEnrollment = await getStudentCourseEnrollment(req.user._id, course._id);
  if (existingEnrollment) {
    req.flash('success', 'You already own this course.');
    return res.redirect(`/courses/${course._id}/learn`);
  }

  const purchase = await CoursePurchase.create({
    student: req.user._id,
    course: course._id,
    teacher: course.teacher,
    amount: course.price,
    currency: course.currency,
    transactionId: `DEMO-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
  });

  await CourseEnrollment.create({
    student: req.user._id,
    course: course._id,
    purchase: purchase._id,
  });

  const linkedQuizCount = await enrollStudentInLinkedQuizzes(req.user._id, course._id);
  req.flash('success', `Demo payment completed. Course unlocked${linkedQuizCount ? ` with ${linkedQuizCount} linked quiz enrollment${linkedQuizCount === 1 ? '' : 's'}` : ''}.`);
  return res.redirect(`/courses/${course._id}/learn`);
};

// Student: list purchased courses.
exports.myLearning = async (req, res) => {
  const enrollments = await CourseEnrollment.find({ student: req.user._id, status: { $in: ['active', 'completed'] } })
    .populate({
      path: 'course',
      populate: { path: 'teacher', select: 'name email' },
    })
    .populate('purchase')
    .sort('-updatedAt');

  res.render('courses/my-learning', {
    title: 'My Learning',
    enrollments: enrollments.filter((enrollment) => enrollment.course),
  });
};

// Student: open the protected course classroom.
exports.learn = async (req, res) => {
  const enrollment = await getStudentCourseEnrollment(req.user._id, req.params.courseId);
  if (!enrollment) {
    req.flash('error', 'Buy the course first to access the classroom.');
    return res.redirect(`/courses/${req.params.courseId}`);
  }

  const [course, lessons, materials, sessions, assignments, assignmentSubmissions] = await Promise.all([
    Course.findById(req.params.courseId).populate('teacher', 'name email'),
    CourseLesson.find({ course: req.params.courseId }).populate('quiz', 'title status examType duration totalMarks passingMarks').sort({ position: 1, createdAt: 1 }),
    CourseMaterial.find({ course: req.params.courseId }).populate('lesson', 'title position').sort({ position: 1, createdAt: 1 }),
    CourseSession.find({ course: req.params.courseId }).sort({ scheduledAt: 1 }),
    CourseAssignment.find({ course: req.params.courseId }).populate('lesson', 'title position').sort({ position: 1, dueAt: 1 }),
    CourseAssignmentSubmission.find({ course: req.params.courseId, student: req.user._id }).sort('-submittedAt'),
  ]);

  if (!course) {
    req.flash('error', 'Course not found.');
    return res.redirect('/courses/my-learning');
  }

  enrollment.lastAccessedAt = new Date();
  await enrollment.save();

  setProtectedContentHeaders(res);
  res.render('courses/learn', {
    title: `${course.title} Classroom`,
    course,
    enrollment,
    lessons,
    materials,
    sessions,
    assignments,
    materialsByLesson: materialsByLesson(materials),
    assignmentSubmissionByAssignment: new Map(assignmentSubmissions.map((submission) => [String(submission.assignment), submission])),
    completedLessonIds: new Set((enrollment.completedLessons || []).map((lessonId) => String(lessonId))),
    protectedCourseMode: true,
    courseProtectionWatermark: `${req.user.name || 'Student'} | ${req.user.email || req.user._id} | ${course.title}`,
  });
};

// Student: terminate protected classroom access after a detected piracy action.
exports.reportProtectionViolation = async (req, res, next) => {
  const enrollment = await getStudentCourseEnrollment(req.user._id, req.params.courseId);
  if (!enrollment) {
    return res.status(403).json({ redirect: '/auth/login', message: 'Course access is required.' });
  }

  const reason = cleanText(req.body.reason).slice(0, 120) || 'protected content violation';
  console.warn(
    `Protected course violation: user=${req.user._id} course=${req.params.courseId} reason=${reason}`
  );

  return logoutTabAfterProtectionViolation(req, res, next, {
    redirect: '/auth/login',
    message: 'Protected course access ended because piracy behavior was detected.',
  });
};

// Student: open a protected course material after confirming course ownership.
exports.openMaterial = async (req, res) => {
  const enrollment = await getStudentCourseEnrollment(req.user._id, req.params.courseId);
  if (!enrollment) {
    req.flash('error', 'Buy the course first to access this material.');
    return res.redirect(`/courses/${req.params.courseId}`);
  }

  const material = await CourseMaterial.findOne({ _id: req.params.materialId, course: req.params.courseId });
  if (!material) {
    req.flash('error', 'Course material not found.');
    return res.redirect(`/courses/${req.params.courseId}/learn`);
  }

  if (material.type === 'vdocipher-class') {
    return res.redirect(`/courses/${req.params.courseId}/materials/${material._id}/vdocipher-player`);
  }

  if (isStreamableVideoMaterial(material)) {
    return res.redirect(`/courses/${req.params.courseId}/materials/${material._id}/stream`);
  }

  const localFilePath = resolveLocalCourseFile(material.resourceUrl);
  if (localFilePath) {
    return sendLocalCourseFile(res, material, localFilePath);
  }

  if (!material.resourceUrl || !isSafeResourceUrl(material.resourceUrl) || material.resourceUrl.startsWith('/')) {
    req.flash('error', 'This material is not available.');
    return res.redirect(`/courses/${req.params.courseId}/learn`);
  }

  setProtectedContentHeaders(res);
  return res.redirect(material.resourceUrl);
};

// Student: render a short-lived VdoCipher DRM iframe after course ownership is confirmed.
exports.vdoCipherPlayer = async (req, res) => {
  const enrollment = await getStudentCourseEnrollment(req.user._id, req.params.courseId);
  if (!enrollment) {
    return res.status(403).send('Buy the course first to watch this video.');
  }

  const material = await CourseMaterial.findOne({
    _id: req.params.materialId,
    course: req.params.courseId,
    type: 'vdocipher-class',
  });

  if (!material || !isValidVdoCipherVideoId(material.resourceUrl)) {
    return res.status(404).send('VdoCipher video material not found.');
  }

  try {
    const playback = await getVdoCipherPlayback(normalizeVdoCipherVideoId(material.resourceUrl));
    const playerUrl = new URL(VDOCIPHER_PLAYER_BASE_URL);
    playerUrl.searchParams.set('otp', playback.otp);
    playerUrl.searchParams.set('playbackInfo', playback.playbackInfo);

    setProtectedFrameHeaders(res);
    return res.render('courses/vdocipher-player', {
      title: material.title,
      playerUrl: playerUrl.toString(),
      watermarkText: `${req.user.name || 'Student'} | ${req.user.email || req.user._id} | ${material.title}`,
    });
  } catch (error) {
    console.warn(`VdoCipher playback failed for material ${material._id}: ${error.message}`);
    return res.status(502).send('The protected VdoCipher player is unavailable right now.');
  }
};

// Student: stream protected recorded class videos without exposing local upload paths.
exports.streamMaterial = async (req, res) => {
  const enrollment = await getStudentCourseEnrollment(req.user._id, req.params.courseId);
  if (!enrollment) {
    return res.status(403).send('Buy the course first to watch this video.');
  }

  const material = await CourseMaterial.findOne({ _id: req.params.materialId, course: req.params.courseId });
  if (!material || !isStreamableVideoMaterial(material)) {
    return res.status(404).send('Video material not found.');
  }

  const localFilePath = resolveLocalCourseFile(material.resourceUrl);
  if (localFilePath) {
    return streamLocalVideo(req, res, material, localFilePath);
  }

  if (!material.resourceUrl || !isSafeResourceUrl(material.resourceUrl) || !isDirectVideoPath(material.resourceUrl)) {
    return res.status(404).send('This video can only be watched from the classroom player.');
  }

  try {
    return await streamRemoteVideo(req, res, material);
  } catch (error) {
    console.warn(`Protected video proxy failed for material ${material._id}: ${error.message}`);
    return res.status(502).send('The protected video stream is unavailable right now.');
  }
};

// Student: open a class recording link only after course ownership is confirmed.
exports.openSessionRecording = async (req, res) => {
  const enrollment = await getStudentCourseEnrollment(req.user._id, req.params.courseId);
  if (!enrollment) {
    req.flash('error', 'Buy the course first to access this recording.');
    return res.redirect(`/courses/${req.params.courseId}`);
  }

  const session = await CourseSession.findOne({ _id: req.params.sessionId, course: req.params.courseId });
  if (!session || !session.recordingUrl || !isSafeResourceUrl(session.recordingUrl) || session.recordingUrl.startsWith('/')) {
    req.flash('error', 'Recording is not available.');
    return res.redirect(`/courses/${req.params.courseId}/learn`);
  }

  setProtectedContentHeaders(res);
  return res.redirect(session.recordingUrl);
};

// Student: upload or replace the answer PDF for a course assignment before the deadline.
exports.submitAssignment = async (req, res) => {
  const enrollment = await getStudentCourseEnrollment(req.user._id, req.params.courseId);
  if (!enrollment) {
    if (req.file) await removeLocalCourseFile(`/uploads/course-files/${req.file.filename}`);
    req.flash('error', 'Buy the course first to submit assignments.');
    return res.redirect(`/courses/${req.params.courseId}`);
  }

  const assignment = await CourseAssignment.findOne({ _id: req.params.assignmentId, course: req.params.courseId });
  if (!assignment) {
    if (req.file) await removeLocalCourseFile(`/uploads/course-files/${req.file.filename}`);
    req.flash('error', 'Assignment not found.');
    return res.redirect(`/courses/${req.params.courseId}/learn`);
  }

  if (assignment.status !== 'open') {
    if (req.file) await removeLocalCourseFile(`/uploads/course-files/${req.file.filename}`);
    req.flash('error', 'This assignment is closed.');
    return res.redirect(`/courses/${req.params.courseId}/learn#assignment-${assignment._id}`);
  }

  if (assignment.dueAt && assignment.dueAt.getTime() < Date.now()) {
    if (req.file) await removeLocalCourseFile(`/uploads/course-files/${req.file.filename}`);
    req.flash('error', 'The assignment deadline has passed.');
    return res.redirect(`/courses/${req.params.courseId}/learn#assignment-${assignment._id}`);
  }

  if (!req.file) {
    req.flash('error', 'Upload your answer PDF before submitting.');
    return res.redirect(`/courses/${req.params.courseId}/learn#assignment-${assignment._id}`);
  }

  const existingSubmission = await CourseAssignmentSubmission.findOne({
    assignment: assignment._id,
    student: req.user._id,
  });
  if (existingSubmission) {
    await removeLocalCourseFile(existingSubmission.answerFileUrl);
    Object.assign(existingSubmission, {
      ...buildAssignmentFilePayload(req.file, 'answer'),
      submittedAt: new Date(),
      status: 'submitted',
      marksAwarded: 0,
      teacherComment: '',
      reviewedBy: undefined,
      reviewedAt: undefined,
    });
    await existingSubmission.save();
  } else {
    await CourseAssignmentSubmission.create({
      assignment: assignment._id,
      course: assignment.course,
      student: req.user._id,
      ...buildAssignmentFilePayload(req.file, 'answer'),
    });
  }

  enrollment.lastAccessedAt = new Date();
  await enrollment.save();

  req.flash('success', 'Assignment answer PDF submitted.');
  return res.redirect(`/courses/${req.params.courseId}/learn#assignment-${assignment._id}`);
};

// Student: mark lesson completion and recalculate course progress.
exports.toggleLessonComplete = async (req, res) => {
  const enrollment = await getStudentCourseEnrollment(req.user._id, req.params.courseId);
  if (!enrollment) {
    req.flash('error', 'Buy the course first to track progress.');
    return res.redirect(`/courses/${req.params.courseId}`);
  }

  const lesson = await CourseLesson.findOne({ _id: req.params.lessonId, course: req.params.courseId });
  if (!lesson) {
    req.flash('error', 'Lesson not found.');
    return res.redirect(`/courses/${req.params.courseId}/learn`);
  }

  const completedIds = new Set((enrollment.completedLessons || []).map((lessonId) => String(lessonId)));
  if (completedIds.has(String(lesson._id))) {
    completedIds.delete(String(lesson._id));
  } else {
    completedIds.add(String(lesson._id));
  }

  const totalLessons = await CourseLesson.countDocuments({ course: req.params.courseId });
  enrollment.completedLessons = Array.from(completedIds);
  enrollment.progressPercentage = totalLessons ? Math.round((completedIds.size / totalLessons) * 100) : 0;
  enrollment.status = enrollment.progressPercentage >= 100 ? 'completed' : 'active';
  enrollment.lastAccessedAt = new Date();
  await enrollment.save();

  req.flash('success', 'Course progress updated.');
  return res.redirect(`/courses/${req.params.courseId}/learn#lesson-${lesson._id}`);
};
