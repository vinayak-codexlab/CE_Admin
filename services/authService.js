import bcrypt from "bcrypt";
import User from "../models/user.js";
import { encryptEmail, decryptEmail, hashEmail } from "../utils/emailHelper.js";
import jwt from "jsonwebtoken";
import { getRedisCache, setRedisCache } from "../utils/redisHelper.js";
const secret_key = process.env.JWT_SECRET;

class AuthService {
    async addUser(userData, creatorRole){
        try{
            const {name, email, password, role, isActive} = userData;
            if (role === "admin" || role === "student") {
                const err = new Error("Registration of admin & student accounts is not allowed.");
                err.statusCode = 403;
                throw err;
            }
            const emailHash = hashEmail(email);
            const encryptedEmail = encryptEmail(email);
            const user = await User.findOne({emailHash});
            if(user){
                const err = new Error("User already exist");
                err.statusCode = 400;
                throw err;
            }
            const hashPassword = await bcrypt.hash(password, 10);
            return await User.create({
                name,
                emailHash:emailHash,
                email:encryptedEmail,
                password:hashPassword,
                role,
                isActive
            });
        } catch(err){
            err.statusCode = err.statusCode || 500;
            err.message = err.message || "unable to add the user";
            throw err;
        }
    }
    async login ({email, password}){
        try{
            const emailHash = hashEmail(email);
            const user = await User.findOne({emailHash});
            if (!user){
                const err = new Error("User does not exist !");
                err.statusCode = 400;
                throw err;
            }
            if (user.role !== "admin") {
                const err = new Error("Access denied, Admin authorization required.");
                err.statusCode = 403; 
                throw err;
            }
            const isMatch = await bcrypt.compare(password, user.password);
            if(!isMatch){
                const err = new Error("Password Mismatch !");
                err.statusCode = 401;
                throw err;
            }
            const decryptedEmail = decryptEmail(user.email);
            const accessToken = jwt.sign(
                { id: user._id, email: decryptedEmail, role: user.role }, 
                secret_key,
                { expiresIn: "15m" }
            );
            const refreshToken = jwt.sign(
                { id: user._id, role: user.role }, 
                secret_key,
                { expiresIn: "7d" }
            );
            return {accessToken, refreshToken, user : {name: user.name, email:decryptedEmail,role: user.role, isActive:user.isActive}};
        } catch(err){
            err.statusCode = err.statusCode || 500;
            err.message = err.message || "failed to login";
            throw err;
        }
    }   
    async refreshService(refreshToken){
        if (!refreshToken) {
            throw new Error("REFRESH_TOKEN_MISSING");
        }
        try {
            const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET); //refreh
            //new token...
            const newAccessToken = jwt.sign(
                { id: decoded.id, role: decoded.role },
                process.env.JWT_SECRET, //access
                { expiresIn: "15m" }
            );
            return { newAccessToken };
        } catch (err) {
            throw new Error("INVALID_REFRESH_TOKEN");
        };
    };
    async getDataById(id){
        try{
            const user = await User.findById(id).select("-emailHash -password").lean();
            if(!user){
                const err = new Error("Data not found !");
                err.statusCode = 404;
                throw err;
            }
            return {
                ...user, email:decryptEmail(user.email)
            };
        } catch(err){
            err.statusCode = err.statusCode || 500;
            err.message = err.message || "failed to get data";
            throw err;
        }
    }
    async deleteUserById(id){
        try{
            const user = await User.findById(id);
            if(!user){
                const err = new Error("User data not found!");
                err.statusCode = 404;
                throw err;
            }
            if (user.role === "admin") {
                const err = new Error("Access denied, can not delete the admin data");
                err.statusCode = 403; 
                throw err;
            }
            await User.findByIdAndDelete(id);
            return user;
        } catch(err){
            err.statusCode = err.statusCode || 500;
            err.message = err.message || "failed to delete data";
            throw err;
        }
    }
    async getUsers(role, queryOptions = {}) {
        try{
            const page = parseInt(queryOptions.page) || 1;
            const limit = parseInt(queryOptions.limit) || 10;
            const search = queryOptions.search || "";

            //redis cache || get data retrieval from cache
            const cacheKey = `users:list:role=${role || 'all'}:page=${page}:limit=${limit}:search=${search}`;
            const cacheResult = await getRedisCache(cacheKey);
            if(cacheResult){
                return cacheResult;
            }

            const filter = {};
            if (role){
                filter.role = role;
            }
            if (search){
                const searchRegex = { $regex : search, $options: "i"};
                filter.$or = [
                    { name : searchRegex},
                    { email : searchRegex}
                ];
            }
            const skipValue = (page - 1) * limit;
            const [users, totalUsers] = await Promise.all([
                User.find(filter)
                    .select("-emailHash -password")
                    .limit(limit)
                    .skip(skipValue)
                    .sort({createdAt : -1}),
                User.countDocuments(filter)
            ]);
            const decryptedUser = users.map(user=>{
                if(user){
                    user.email = decryptEmail(user.email);
                }
                return user;
            });
            const result = {
                pagination :{
                    totalItems : totalUsers,
                    currentPage : page,
                    totalPage : Math.ceil(totalUsers/limit),
                    itemPerPage : limit
                },
                users:decryptedUser
            }
            //set the data in redis cache
            await setRedisCache(cacheKey, result, 300);
            return result;
        } catch (err){
            err.statusCode = err.statusCode || 500;
            err.message = err.message || "failed to get users.";
            throw err;
        };
    }
    async updateUserStatusAndRole(userId, updateData) {
        try {
            const { isActive, role } = updateData;
            const user = await User.findById(userId);
            if (!user) {
                const err = new Error("User not found!");
                err.statusCode = 404;
                throw err;
            }
            if (user.role === "admin" || role === "admin") {
                const err = new Error("Cannot assign Admin roles !");
                err.statusCode = 403;
                throw err;
            }
            if (isActive !== undefined) user.isActive = isActive;
            if (role !== undefined) user.role = role;
            await user.save();
            return user;
        } catch (err) {
            err.statusCode = err.statusCode || 500;
            err.message = err.message || "Failed to update user status!";
            throw err;
        }
    }
}

export const authService = new AuthService();

