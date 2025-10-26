/* ================== Admin / System ================== */
export const INSTITUTES_ENDPOINT =
  import.meta.env.VITE_INSTITUTES_ENDPOINT ?? "/api/admin/institutes/";

export const INSTITUTE_LOGO_ENDPOINT = (id: number | string) =>
  `${INSTITUTES_ENDPOINT}${id}/logo/`;

export const USERS_ENDPOINT =
  import.meta.env.VITE_USERS_ENDPOINT ?? "/api/admin/accounts/";


  /* ================== Auth ================== */
export const AUTH_BASE =
  import.meta.env.VITE_AUTH_BASE ?? "/api/auth/";

export const AUTH_TOKEN_ENDPOINT =
  import.meta.env.VITE_AUTH_TOKEN_ENDPOINT ?? `${AUTH_BASE}token/`;

export const AUTH_REFRESH_ENDPOINT =
  import.meta.env.VITE_AUTH_REFRESH_ENDPOINT ?? `${AUTH_BASE}token/refresh/`;

export const AUTH_ME_ENDPOINT =
  import.meta.env.VITE_AUTH_ME_ENDPOINT ?? `${AUTH_BASE}me/`;

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
export const EMPLOYEE_DEPENDENTS_ENDPOINT =
  import.meta.env.VITE_EMPLOYEE_DEPENDENTS_ENDPOINT ??
  "/api/employee-dependents/";
export const EMPLOYEE_CAREERS_ENDPOINT =
  import.meta.env.VITE_EMPLOYEE_CAREERS_ENDPOINT ??
  "/api/employee-careers/";
export const EMPLOYEE_FUNCTIONS_ENDPOINT =
  import.meta.env.VITE_EMPLOYEE_FUNCTIONS_ENDPOINT ??
  "/api/employee-functions/";
export const EMPLOYEE_ACCOUNT_ENDPOINT = (id: number | string) =>
  `${EMPLOYEES_ENDPOINT}${id}/account/`;

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
export const FIN_ACCOUNTS_ENDPOINT = "/api/finance/accounts/";
export const FIN_LEDGER_ENDPOINT = "/api/finance/ledger/";
export const FIN_LEDGER_TRANSFER_ENDPOINT = "/api/finance/ledger/transfer/";
export const FIN_LEDGER_CATEGORIES_FOR_AMOUNT_ENDPOINT =
  "/api/finance/ledger/categories-for-amount";
export const FIN_ACCOUNT_TYPES_ENDPOINT = "/api/finance/account-types/";