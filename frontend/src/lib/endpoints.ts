/* ================== Admin / System ================== */
export const INSTITUTES_ENDPOINT =
  import.meta.env.VITE_INSTITUTES_ENDPOINT ?? "/api/admin/institutes/";

export const INSTITUTE_LOGO_ENDPOINT = (id: number | string) =>
  `${INSTITUTES_ENDPOINT}${id}/logo/`;

export const USERS_ENDPOINT =
  import.meta.env.VITE_USERS_ENDPOINT ?? "/api/admin/accounts/";

/* ================== Students ================== */
export const STUDENTS_ENDPOINT =
  import.meta.env.VITE_STUDENTS_ENDPOINT ?? "/api/students/";

export const STUDENT_PHOTO_ENDPOINT = (id: number | string) =>
  `${STUDENTS_ENDPOINT}${id}/photo/`;

// FLAT resources (filter by ?student=ID)
export const STUDENT_CUSTODIANS_ENDPOINT =
  import.meta.env.VITE_STUDENT_CUSTODIANS_ENDPOINT ??
  "/api/student-custodians/";
export const STUDENT_STATUS_ENDPOINT =
  import.meta.env.VITE_STUDENT_STATUS_ENDPOINT ?? "/api/student-statuses/";


/* ================== Employees ================== */
export const EMPLOYEES_ENDPOINT =
  import.meta.env.VITE_EMPLOYEES_ENDPOINT ?? "/api/employees/";
export const EMPLOYEE_PHOTO_ENDPOINT = (id: number | string) =>
  `${EMPLOYEES_ENDPOINT}${id}/photo/`;
export const EMPLOYEE_DEPENDENTS_ENDPOINT = (employeeId: number | string) =>
  `${EMPLOYEES_ENDPOINT}${employeeId}/dependents/`;
export const EMPLOYEE_CAREER_ENDPOINT = (employeeId: number | string) =>
  `${EMPLOYEES_ENDPOINT}${employeeId}/career/`;

/* ================== Courses ================== */
export const COURSES_ENDPOINT =
  import.meta.env.VITE_COURSES_ENDPOINT ?? "/api/courses/";
export const COURSE_CLASSES_ENDPOINT = (courseId: number | string) =>
  `${COURSES_ENDPOINT}${courseId}/classes/`;
export const COURSE_INSTRUCTORS_ENDPOINT =
  `/api/course-instructors/`;
export const COURSE_INSTRUCTORS_BY_CLASS_ENDPOINT = (classId: number | string) =>
    `/api/course-instructors/by-class/${classId}/`;
export const COURSE_ELIGIBLE_INSTRUCTORS_ENDPOINT =
`/api/course-instructors/eligible-instructors/`;

// Stand‑alone collection for listing all course classes (not nested under a course)
export const COURSE_CLASSES_COLLECTION_ENDPOINT =
  import.meta.env.VITE_COURSE_CLASSES_COLLECTION_ENDPOINT ??
  "/api/course-classes/";
export const COURSE_CLASSES_COLLECTION_BY_TERM_ENDPOINT = (termId: number | string) =>
  `${COURSE_CLASSES_COLLECTION_ENDPOINT}by-term/${termId}`;

/* ================== Academic Terms ================== */
export const TERMS_ENDPOINT =
import.meta.env.VITE_TERMS_ENDPOINT ?? "/api/academic-terms/";
export const COURSE_CLASSES_COLLECTION =
import.meta.env.VITE_COURSE_CLASSES ?? "/api/course-classes/";

/* ================== Finance ================== */
export const ACCOUNTS_ENDPOINT =
  import.meta.env.VITE_ACCOUNTS_ENDPOINT ?? "/api/accounts/"; // LUT_AccountType
export const JOURNAL_ENDPOINT =
  import.meta.env.VITE_JOURNAL_ENDPOINT ?? "/api/journal/";
