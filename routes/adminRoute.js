import express from "express";
import { login, logout, addUser, handleTokenRefresh, getDataById, listUsers, adminUpdateUserStatus, deleteUserById } from "../controller/authController.js";
import Protect from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.route("/login").post(login);
router.route("/refresh").post(handleTokenRefresh);

router.use(Protect);

router.route("/logout").post(logout);
router.route("/me").get(getDataById);

router.route("/add-user").post(authorizeRoles("admin"), addUser); 
router.route("/users").get(authorizeRoles("admin"), listUsers);

router.route("/users/:id")
    .get(getDataById) 
    .delete(authorizeRoles("admin"), deleteUserById);
router.route("/users/:id/status")
    .patch(authorizeRoles("admin"), adminUpdateUserStatus);

export default router;

