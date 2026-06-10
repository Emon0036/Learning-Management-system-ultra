const express = require('express');
const courseController = require('../controllers/courseController');
const asyncHandler = require('../utils/asyncHandler');
const { ensureStudent } = require('../middleware/authMiddleware');
const courseFileUpload = require('../middleware/courseFileUpload');

const router = express.Router();

// Public course catalog and detail pages.
router.get('/', asyncHandler(courseController.catalog));
router.get('/my-learning', ensureStudent, asyncHandler(courseController.myLearning));
router.get('/:courseId', asyncHandler(courseController.detail));

// Student purchase and classroom routes use the existing Passport session authentication.
router.get('/:courseId/checkout', ensureStudent, asyncHandler(courseController.checkout));
router.post('/:courseId/purchase', ensureStudent, asyncHandler(courseController.purchase));
router.get('/:courseId/learn', ensureStudent, asyncHandler(courseController.learn));
router.post('/:courseId/protection-violation', ensureStudent, asyncHandler(courseController.reportProtectionViolation));
router.get('/:courseId/materials/:materialId/open', ensureStudent, asyncHandler(courseController.openMaterial));
router.get('/:courseId/materials/:materialId/vdocipher-player', ensureStudent, asyncHandler(courseController.vdoCipherPlayer));
router.get('/:courseId/materials/:materialId/stream', ensureStudent, asyncHandler(courseController.streamMaterial));
router.get('/:courseId/sessions/:sessionId/recording', ensureStudent, asyncHandler(courseController.openSessionRecording));
router.post('/:courseId/assignments/:assignmentId/submit', ensureStudent, courseFileUpload.assignmentAnswer, asyncHandler(courseController.submitAssignment));
router.post('/:courseId/lessons/:lessonId/complete', ensureStudent, asyncHandler(courseController.toggleLessonComplete));

module.exports = router;
