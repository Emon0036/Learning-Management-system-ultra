const express = require('express');
const teacherController = require('../controllers/teacherController');
const courseController = require('../controllers/courseController');
const asyncHandler = require('../utils/asyncHandler');
const { ensureTeacher } = require('../middleware/authMiddleware');
const quizThumbnailUpload = require('../middleware/quizThumbnailUpload');
const courseFileUpload = require('../middleware/courseFileUpload');

const router = express.Router();

router.use(ensureTeacher);
router.get('/dashboard', asyncHandler(teacherController.dashboard));
router.get('/courses', asyncHandler(courseController.listTeacherCourses));
router.get('/courses/new', courseController.showCreateCourse);
router.post('/courses', asyncHandler(courseController.createCourse));
router.get('/courses/:courseId/edit', asyncHandler(courseController.showEditCourse));
router.put('/courses/:courseId', asyncHandler(courseController.updateCourse));
router.delete('/courses/:courseId', asyncHandler(courseController.deleteCourse));
router.patch('/courses/:courseId/publish', asyncHandler(courseController.toggleCoursePublish));
router.get('/courses/:courseId/students', asyncHandler(courseController.courseStudents));
router.post('/courses/:courseId/lessons', asyncHandler(courseController.createLesson));
router.patch('/courses/:courseId/lessons/:lessonId/quiz', asyncHandler(courseController.updateLessonQuiz));
router.delete('/courses/:courseId/lessons/:lessonId', asyncHandler(courseController.deleteLesson));
router.post('/courses/:courseId/materials', courseFileUpload, asyncHandler(courseController.createMaterial));
router.delete('/courses/:courseId/materials/:materialId', asyncHandler(courseController.deleteMaterial));
router.post('/courses/:courseId/sessions', asyncHandler(courseController.createSession));
router.patch('/courses/:courseId/sessions/:sessionId', asyncHandler(courseController.updateSessionStatus));
router.delete('/courses/:courseId/sessions/:sessionId', asyncHandler(courseController.deleteSession));
router.post('/courses/:courseId/assignments', courseFileUpload.assignmentQuestion, asyncHandler(courseController.createAssignment));
router.delete('/courses/:courseId/assignments/:assignmentId', asyncHandler(courseController.deleteAssignment));
router.patch(
  '/courses/:courseId/assignments/:assignmentId/submissions/:submissionId/review',
  asyncHandler(courseController.reviewAssignmentSubmission)
);
router.get('/quizzes', asyncHandler(teacherController.listQuizzes));
router.get('/quizzes/new', teacherController.showCreateQuiz);
router.post('/quizzes', quizThumbnailUpload, asyncHandler(teacherController.createQuiz));
router.get('/reviews', asyncHandler(teacherController.reviews));
router.get('/quizzes/:quizId/edit', asyncHandler(teacherController.showEditQuiz));
router.put('/quizzes/:quizId', quizThumbnailUpload, asyncHandler(teacherController.updateQuiz));
router.delete('/quizzes/:quizId', asyncHandler(teacherController.deleteQuiz));
router.patch('/quizzes/:quizId/publish', asyncHandler(teacherController.togglePublish));
router.post('/quizzes/:quizId/questions', asyncHandler(teacherController.addQuestion));
router.delete('/quizzes/:quizId/questions/:questionId', asyncHandler(teacherController.deleteQuestion));
router.get('/quizzes/:quizId/attempts', asyncHandler(teacherController.attempts));
router.get('/attempts/:attemptId/review', asyncHandler(teacherController.reviewAttempt));
router.patch('/attempts/:attemptId/review', asyncHandler(teacherController.updateReview));
router.get('/quizzes/:quizId/analytics', asyncHandler(teacherController.analytics));
router.get('/quizzes/:quizId/leaderboard', asyncHandler(teacherController.leaderboard));

module.exports = router;
