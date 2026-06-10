# QuizMaster - Online Quiz Management System

QuizMaster is a role-based exam and LMS platform built with Node.js, Express, EJS, and MongoDB. It supports admin onboarding, teacher-managed exams, student enrollments, full course management, demo course purchases, online sessions, recorded classes, course files, leaderboard tracking, manual review workflows, coding problems, and quiz security rules such as auto-submit on tab switching or clipboard actions.

## Current feature set

### Public and authentication

- Landing pages for home, about, features, pricing, help, contact, terms, and privacy
- Student self-registration and login
- Password reset flow with token-based reset links
- Per-tab session handling so different accounts can stay isolated across browser tabs

### Admin

- First-admin bootstrap at `/admin/setup`
- Admin dashboard for managing students, teachers, and other admins
- Approve or reject teacher access
- Promote an existing user to teacher by email
- Block and unblock student or teacher accounts

### Teacher

- Create, edit, publish, unpublish, and delete quizzes
- Upload quiz thumbnails with Multer + Cloudinary
- Create exams by type: `quiz`, `true-false`, `short-answer`, and `coding-test`
- Add question types that match the selected exam type
- Review pending short-answer and coding submissions
- View attempts, analytics, and per-quiz leaderboards
- Create, edit, publish, unpublish, and delete LMS courses
- Add course lessons, course-level notes, lesson files, recorded class links, and external links
- Schedule online live sessions and attach recording links after class
- Link existing quizzes to course lessons so course students can attempt them from the classroom
- View course students, demo purchase receipts, and course progress

### Student

- Browse published exams and enroll before attempting them
- Track enrolled quizzes, progress, review status, and history
- Attempt timed quizzes with automatic scoring for objective questions
- View results, teacher feedback, quiz leaderboards, and a global leaderboard
- Browse the published course catalog
- Complete demo checkout for a course with no real transaction gateway
- Open purchased courses from My Learning
- Access lessons, notes, uploaded files, recorded classes, online session links, and linked quizzes
- Track lesson completion progress for each purchased course

### LMS and demo payment

- Published courses are available at `/courses`
- Student course library is available at `/courses/my-learning`
- Teacher course management is available at `/teacher/courses`
- Demo checkout creates a `CoursePurchase` receipt and a `CourseEnrollment`
- No real payment gateway, card, or mobile banking API is called
- Course purchases automatically enroll the student in any published quizzes linked to course lessons
- Course files are stored locally under `public/uploads/course-files` for the demo LMS flow

### Coding module

- Public coding problems list and single-problem workspace
- Staff-only create/edit/delete management for coding problems
- Student code submissions stored for teacher review
- Quiz coding questions also go through manual review

## Tech stack

- Node.js 20+
- Express 5
- MongoDB with Mongoose
- EJS + `ejs-mate`
- Passport local authentication
- `express-session` + `connect-mongo`
- Tailwind CSS tooling, CDN config, and custom CSS
- Multer and Cloudinary for image uploads, plus local demo course file uploads

## Project structure

```text
.
|-- app.js
|-- controllers/
|-- routes/
|-- models/
|-- middleware/
|-- utils/
|-- views/
|-- public/
|-- scripts/
`-- resetAdmin.js
```

## Getting started

### 1. Install requirements

- Node.js 20 or newer
- npm
- MongoDB locally, or a MongoDB Atlas connection string

Check your versions:

```bash
node -v
npm -v
```

### 2. Clone and install

```bash
git clone <your-repository-url>
cd Online-quiz-management-system
npm install
```

### 3. Create the environment file

Windows:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

### 4. Configure environment variables

Minimum local setup:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/quiz-management-system
SESSION_SECRET=change_this_to_a_long_random_secret
PORT=3000
NODE_ENV=development
```

Available variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Yes in production | MongoDB connection string |
| `DNS_SERVERS` | No | Comma-separated DNS override for `mongodb+srv` connection issues |
| `SESSION_SECRET` | Yes | Session signing secret |
| `PORT` | No | Server port, defaults to `3000` |
| `NODE_ENV` | No | Usually `development` or `production` |
| `CLOUDINARY_CLOUD_NAME` or `CLOUDINARY_CLOUD` | No | Cloudinary cloud name for quiz thumbnails |
| `CLOUDINARY_API_KEY` | No | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | No | Cloudinary API secret |
| `CLOUDINARY_QUIZ_FOLDER` | No | Override upload folder for thumbnails |
| `VDOCIPHER_API_SECRET` | Required for VdoCipher playback | VdoCipher API secret used only by the backend to generate OTP playback credentials |
| `VDOCIPHER_OTP_TTL_SECONDS` | No | VdoCipher OTP lifetime in seconds, defaults to `300` |
| `VDOCIPHER_API_BASE_URL` | No | Override VdoCipher API base URL, defaults to `https://dev.vdocipher.com/api` |
| `VDOCIPHER_PLAYER_BASE_URL` | No | Override VdoCipher player URL, defaults to `https://player.vdocipher.com/v2/` |
| `PISTON_API_URL` | No | Reserved for code-execution integration experiments |
| `PISTON_HTTP_TIMEOUT_MS` | No | Reserved timeout for code-execution integration |

## Running the app

Development mode:

```bash
npm run dev
```

Production-style start:

```bash
npm start
```

Open:

```text
http://localhost:3000
```

## First-run workflow

1. Start the server.
2. Visit `http://localhost:3000/admin/setup`.
3. Create the first admin account.
4. Register student accounts normally from `/auth/register`.
5. From the admin dashboard, promote an existing user to teacher if needed.

## Available scripts

- `npm start` - run the app with Node
- `npm run dev` - run the app with Nodemon
- `npm run build-css` - watch Tailwind input and write `public/css/output.css` for optional styling workflow
- `npm test` - syntax-check all JavaScript files with `node --check`
- `node resetAdmin.js` - remove all admin records and reopen first-admin setup

## Runtime notes

- In development, if `MONGODB_URI` points to local MongoDB and that server is unavailable, the app falls back to an in-memory MongoDB instance using `mongodb-memory-server`. That data is temporary and disappears when the server stops.
- In development, forgot-password requests expose the reset URL in the console and flash message instead of sending email.
- Quiz thumbnail uploads require real Cloudinary credentials. Without them, thumbnail upload actions will fail with a clear message.
- Objective questions are auto-graded. Short-answer and coding questions stay in a pending-review flow until a teacher reviews them.
- LMS course checkout is intentionally demo-only. It stores a receipt and unlocks access without charging real money.
- Course file uploads are local demo uploads. Use cloud/object storage and stricter file policies before production deployment.
- The repository contains a `utils/codeValidator.js` helper and Piston-related environment variables, but the current codebase still treats coding submissions as review-based rather than as a fully sandboxed online judge.
- During quiz attempts, timer expiration, tab/window switching, dev-tools shortcuts, and clipboard actions trigger auto-submit.
- The main layout currently links `public/css/style.css`; `output.css` is not part of the default page include.

## Main routes

| Area | Base path |
| --- | --- |
| Public pages | `/` |
| Course catalog and learning | `/courses` |
| Authentication | `/auth` |
| Admin | `/admin` |
| Teacher | `/teacher` |
| Student | `/student` |
| Enrollments | `/enrollments` |
| Coding problems | `/problems` |
| Code submissions | `/submissions` |

## Notes for contributors

- Keep `.env` out of version control.
- Use `.env.example` as the source of truth for required configuration.
- The repository may include UI work in progress; check the current branch state before shipping unrelated changes.


# Website link:https://online-quiz-management-system-nphc.onrender.com
