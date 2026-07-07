import {Router} from "express";
import Protect from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { addCourse, deleteCourse, getCourseById, getCourses, updateCourse, adminAssignTeacher, adminRemoveTeacher } from "../controller/courseController.js";

const router = Router();

router.use(Protect);
router.use(authorizeRoles("admin"));

router.route("/")
    .post(addCourse) 
    .get(getCourses)
router.route("/:id")
    .get(getCourseById)
    .patch(updateCourse)
    .delete(deleteCourse);
router.route("/:courseId/:teacherId")
    .patch(adminAssignTeacher)
    .delete(adminRemoveTeacher);

export default router;