import express from "express";
import { login, logout, addUser, handleTokenRefresh, getUserData, removeUser, listUsers, adminUpdateUserStatus } from "../controller/authController.js";
import Protect from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.route("/login").post(login);
router.route("/refresh").post(handleTokenRefresh);

router.use(Protect);

router.route("/logout").post(logout);
router.route("/me").get(getUserData);

router.route("/add-user").post(authorizeRoles("admin"), addUser); 
router.route("/users").get(authorizeRoles("admin"), listUsers);

router.route("/users/:id")
    .get(getUserData) 
    .delete(authorizeRoles("admin"), removeUser);
router.route("/users/:id/status")
    .patch(authorizeRoles("admin"), adminUpdateUserStatus);

export default router;

