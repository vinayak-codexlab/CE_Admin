import { authService } from "../services/authService.js";
import { loginSchema, registerSchema } from "../validations/dataValidation.js";

export const addUser = async(req,res,next)=>{
    try{
        const validatedData = registerSchema.parse(req.body);
        const creatorRole = req.user?.role;
        const newUser = await authService.createUser(validatedData, creatorRole);
        return res.status(201).json({success:true, message:"user data added"});
    } catch (err){
        next(err);
    }
};
export const login = async(req,res,next)=>{
    try{
        const validatedData = loginSchema.parse(req.body);
        const {user,accessToken, refreshToken} = await authService.adminLogin(validatedData);
        //cookies...
        // const cookieOptions = {
        //     httpOnly : true,
        //     secure : false,
        //     sameSite: "strict",
        //     maxAge: 15*60*1000
        // }

        // return res.status(200)
        //     .cookie("token", token, cookieOptions)
        //     .json({success:true, message:"logged in successfully.", user});
        // return res.status(200)
        //     .json({ success: true, message: "Logged in successfully.", user });

        //new logic...
        const cookieOptions = {
            httpOnly: true,
            secure: false,
            sameSite: "strict",
        };
        return res.status(200)
            .cookie("accessToken", accessToken, { 
                ...cookieOptions, 
                maxAge: 15 * 60 * 1000 
            })
            .cookie("refreshToken", refreshToken, { 
                ...cookieOptions, 
                maxAge: 7 * 24 * 60 * 60 * 1000 
            })
            .json({ 
                success: true, 
                message: "Logged in successfully.", 
                user 
            });
        // res.locals.accessToken = accessToken;
        // res.locals.refreshToken = refreshToken;
    } catch (err){
        next(err);
    }
};
export const logout = async (req, res) => {
    const cookieOptions = {
        httpOnly: true,
        secure: false,
        sameSite: "strict",
    };
    return res
        .status(200)
        .clearCookie("accessToken", cookieOptions)
        .clearCookie("refreshToken", cookieOptions)
        // .clearCookie("token", { httpOnly: true, sameSite: "strict" })
        .json({ success: true, message: "Logged out successfully" });
};
export const handleTokenRefresh = async (req, res, next) => {
    try {
        const currentRefreshToken = req.cookies.refreshToken;
        const { newAccessToken } = await authService.refreshService(currentRefreshToken);        
        // res.locals.accessToken = newAccessToken;
        // next();
        const cookieOptions = {
            httpOnly: true,
            secure:false,
            sameSite: "strict",
            maxAge: 15 * 60 * 1000 
        };
        return res.status(200)
            .cookie("accessToken", newAccessToken, cookieOptions)
            .json({ success: true, message: "Token refreshed successfully" });
    } catch (err) {
        if (err.message === "REFRESH_TOKEN_MISSING" || err.message === "INVALID_REFRESH_TOKEN") {
            return res.status(403).json({ success: false, message: "Session expired. Please log in again." });
        }
        next(err);
    }
};
export const getUserData = async (req,res,next)=>{
    try{
        const userId = req.params.id || req.user?.id;
        if (!userId) {
            const err = new Error("User ID is required");
            err.statusCode = 400;
            throw err;
        }
        const userData = await authService.getDataById(userId);
        return res.status(200).json({success:true,data:userData});
    } catch(err){
        next(err);
    }
};
export const listUsers = async (req,res,next)=>{
    try{
        const {page, limit, search, role} = req.query;
        const usersData = await authService.getUsers(role, {page, limit, search});
        res.status(200).json({success:true, pagination : usersData.pagination,data : usersData.users});
    } catch(err){
        console.log("Error in the listUser controller", err);
        next(err);
    }
};
export const removeUser = async (req,res,next)=>{
    try{
        const { id } = req.params;
        const result = await authService.deleteUserById(id);
        return res.status(200).json({success:true, message:"User removed successfully."});
    } catch (err){
        next(err);
    }
};
export const adminUpdateUserStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { isActive, role } = req.body; 
        const updatedUser = await userService.updateUserStatusAndRole(id, { isActive, role });
        return res.status(200).json({
            success: true,
            message: "User status/role updated successfully.",
            data: { id: updatedUser._id, role: updatedUser.role, isActive: updatedUser.isActive }
        });
    } catch (err) {
        next(err);
    }
};