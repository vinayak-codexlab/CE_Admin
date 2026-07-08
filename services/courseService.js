import Course from "../models/courses.js";
import User from "../models/user.js";
import { decryptEmail } from "../utils/emailHelper.js";
import { getRedisCache, setRedisCache, removeRedisCache, removeRedisCachePattern } from "../utils/redisHelper.js";

class CourseService{
    async createCourse(courseData){
        try{
            const { title, teacherId } = courseData;
            const existCourse = await Course.findOne({title});
            if(existCourse){
                const err = new Error("Course already exists !");
                err.statusCode = 400;
                throw err;
            }
            // const existTeacher = await User.findById(teacherId);
            // if(!existTeacher){
            //     const err = new Error("Teacher data not found !");
            //     err.statusCode = 404;
            //     throw err;
            // }
            const newCourse = await Course.create({...courseData});
            await removeRedisCachePattern("courses:list:*");
            return newCourse;
        } catch(err){
            err.statusCode = err.statusCode || 500;
            err.message = err.message || "failed to add a course !";
            throw err;
        }
    }
    async getCourses(queryOptions = {}){
        try{
            const page = parseInt(queryOptions.page) || 1;
            const limit = parseInt(queryOptions.limit) || 10;
            const search = queryOptions.search || "";

            //redis
            const cacheKey = `courses:list:page=${page}:limit=${limit}:search=${search}`;
            const cacheResult = await getRedisCache(cacheKey);
            if (cacheResult) {
                return cacheResult;
            }

            let filter = {};
            if (search) {
                const searchRegex = { $regex: search, $options: "i" };
                const matchingTeachers = await User.find({
                    $or: [
                        { name: searchRegex },
                        { email: searchRegex }
                    ]
                }).select("_id").lean();
                const teacherIds = matchingTeachers.map(t => t._id);

                filter.$or = [
                    { title: searchRegex },
                    { description: searchRegex },
                    { level: searchRegex },
                    { teacherId: { $in: teacherIds } }
                ];
            }

            const skipValues = (page - 1) * limit;

            const [courses, totalCourses] = await Promise.all([
                Course.find(filter)
                    .select("-__v")
                    .limit(limit)
                    .skip(skipValues)
                    .sort({ createdAt: -1 })
                    .populate("teacherId", "name email")
                    .lean(),
                Course.countDocuments(filter)
            ]);
            const decryptedCourse = courses.map(c=>{
                if (c && c.teacherId && Array.isArray(c.teacherId)) {
                    c.teacherId.forEach(teacher => {
                        if (teacher && teacher.email) {
                            teacher.email = decryptEmail(teacher.email);
                        }
                    });
                }
                return c;
            });
            const result = {
                pagination: {
                    totalItem: totalCourses,
                    currentPage: page,
                    totalPages: Math.ceil(totalCourses / limit),
                    ItemsPerPage: limit
                },
                courses:decryptedCourse
            };
            await setRedisCache(cacheKey, result, 300);
            return result;
        } catch (err){
            err.statusCode = err.statusCode || 500;
            err.message = err.message || "failed to get courses data !";
            throw err;
        }
    }
    async getCourseById(id){
        try{
            const cacheKey = `courses:profile:${id}`;
            const cachedCourse = await getRedisCache(cacheKey);
            if (cachedCourse) {
                return cachedCourse;
            }
            const course = await Course.findById(id).populate("teacherId", "name email");
            if (!course) {
                const err = new Error("Course not found!");
                err.statusCode = 404;
                throw err;
            }
            // if (course.teacherId && course.teacherId.email) {
            //     course.teacherId.email = decryptEmail(course.teacherId.email);
            // }
            const courseObj = course.toObject();
            if (courseObj.teacherId && Array.isArray(courseObj.teacherId)) {
                courseObj.teacherId.forEach(teacher => {
                    if (teacher && teacher.email) {
                        teacher.email = decryptEmail(teacher.email);
                    }
                });
            }
            await setRedisCache(cacheKey, courseObj, 3600);
            return courseObj;
        } catch (err){
            err.statusCode = err.statusCode || 500;
            err.message = err.message || "failed to get a course data!";
            throw err;
        }
    }
    async updateCourse(id, updateData){
        try{
            if (updateData.teacherId) {
                const existTeacher = await User.findById(updateData.teacherId);
                if (!existTeacher) {
                    const err = new Error("New assigned teacher data not found!");
                    err.statusCode = 444;
                    throw err;
                }
            }
            const updatedCourse = await Course.findByIdAndUpdate(id, updateData, { 
                new: true, 
                runValidators: true 
            });
            if (!updatedCourse) {
                const err = new Error("Course not found!");
                err.statusCode = 404;
                throw err;
            }
            //remove from the profile and list
            await removeRedisCache(`courses:profile:${id}`);
            await removeRedisCachePattern("courses:list:*");
            return updatedCourse;
        } catch (err){
            err.statusCode = err.statusCode || 500;
            err.message = err.message || "failed to update course data!";
            throw err;
        }
    }
    async deleteCourse(id){
        try{
            const courseData = await Course.findByIdAndDelete(id);
            if(!courseData){
                const err = new Error("Course does not exists !");
                err.statusCode = 404;
                throw err;
            }
            //remove profile and list cache
            await removeRedisCache(`courses:profile:${id}`);
            await removeRedisCachePattern("courses:list:*");

            return courseData;
        } catch(err){
            err.statusCode= err.statusCode || 500;
            err.message = err.message || "failed to delete the course !";
            throw err;
        }
    }
    async assignTeacherToCourse(courseId, teacherId) {
        try {
            const teacher = await User.findById(teacherId);
            if (!teacher || teacher.role !== "teacher") {
                const err = new Error("Valid teacher not found!");
                err.statusCode = 404;
                throw err;
            }
            const isAlreadyAssigned = await Course.findOne({
                _id: courseId,
                teacherId: teacherId 
            });
            if (isAlreadyAssigned) {
                const err = new Error("This teacher is already assigned to this course!");
                err.statusCode = 400;
                throw err;
            }
            const updatedCourse = await Course.findByIdAndUpdate(
                courseId,
                // { teacherId },
                // { new: true, runValidators: true }
                { $addToSet: { teacherId: teacherId } },
                { 
                    returnDocument: 'after',
                    runValidators: true 
                }
            ).populate("teacherId", "name email");
            if (!updatedCourse) {
                const err = new Error("Course not found!");
                err.statusCode = 404;
                throw err;
            }

            await removeRedisCache(`courses:profile:${courseId}`);
            await removeRedisCachePattern("courses:list:*");

            return updatedCourse;
        } catch (err) {
            err.statusCode = err.statusCode || 500;
            err.message = err.message || "Failed to assign teacher!";
            throw err;
        }
    }
    async removeTeacherFromCourse(courseId, teacherId) {
        try {
            const course = await Course.findById(courseId);
            if(!course){
                const err = new Error("Course not found !");
                err.statusCode = 404;
                throw err;
            };
            const isTeacherAssigned = course.teacherId.some(id => id.toString() === teacherId.toString());
            if (!isTeacherAssigned) {
                const err = new Error("Teacher is not assigned to this course!");
                err.statusCode = 400; 
                throw err;
            }

            const updatedCourse = await Course.findByIdAndUpdate(
                courseId,
                { $pull: { teacherId: teacherId } }, // Removes the specific ID from the array
                { 
                    returnDocument: 'after', 
                    runValidators: true 
                }
            ).populate("teacherId", "name email");
            if (!updatedCourse) {
                const err = new Error("Course not found!");
                err.statusCode = 404;
                throw err;
            }

            await removeRedisCache(`courses:profile:${courseId}`);
            await removeRedisCachePattern("courses:list:*");
            return updatedCourse;
        } catch (err) {
            err.statusCode = err.statusCode || 500;
            err.message = err.message || "Failed to remove teacher from course!";
            throw err;
        }
    }
}

export const courseService = new CourseService();