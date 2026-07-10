import Course from "../models/courses.js";
import User from "../models/user.js";
import { decryptEmail, generateSearchHash, hashEmail, tokenizeField } from "../utils/emailHelper.js";
import { getRedisCache, setRedisCache, removeRedisCache, removeRedisCachePattern } from "../utils/redisHelper.js";
import mongoose from "mongoose";

class CourseService{
    async addCourse(courseData){
        try{
            const { title } = courseData;
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
    async getCourses(queryOptions = {}) {
        try {
            const page = parseInt(queryOptions.page) || 1;
            const limit = parseInt(queryOptions.limit) || 10;
            const search = queryOptions.search || "";

            // 1. Check Redis Cache
            const cacheKey = `courses:list:page=${page}:limit=${limit}:search=${search}`;
            const cacheResult = await getRedisCache(cacheKey);
            
            if (cacheResult) {
                return cacheResult;
            }

            // 2. Build Query Filters
            let filter = {};
            let teacherIds = [];

            if (search) {
                const searchRegex = { $regex: search, $options: "i" };
                const hashedSearch = hashEmail(search);

                // Find teachers matching the search criteria
                const matchingTeachers = await User.find({
                    $or: [
                        { name: searchRegex },
                        { emailHash: hashedSearch }
                    ]
                }).select("_id").lean();

                teacherIds = matchingTeachers.map(t => t._id);

                // Apply search filters to courses
                filter.$or = [
                    { title: searchRegex },
                    { description: searchRegex },
                    { level: searchRegex },
                    { teacherId: { $in: teacherIds } }
                ];
            }

            // 3. Pagination and Database Fetch
            const skipValues = (page - 1) * limit;

            const [courses, totalCourses] = await Promise.all([
                Course.find(filter)
                    .select("-__v")
                    .limit(limit)
                    .skip(skipValues)
                    .sort({ createdAt: -1 })
                    .populate("teacherId", "name email"),
                Course.countDocuments(filter)
            ]);

            // 4. Formulate Result & Cache It
            const result = {
                pagination: {
                    totalItem: totalCourses,
                    currentPage: page,
                    totalPages: Math.ceil(totalCourses / limit),
                    ItemsPerPage: limit
                },
                courses: courses
            };

            await setRedisCache(cacheKey, result, 300);
            
            return result;

        } catch (err) {
            err.statusCode = err.statusCode || 500;
            err.message = err.message || "Failed to get courses data!";
            throw err;
        }
    }

    //second method
    async getAllCourses(queryOptions = {}) {
        try {
            const page = parseInt(queryOptions.page) || 1;
            const limit = parseInt(queryOptions.limit) || 10;
            const search = queryOptions.search || "";
            const skipValues = (page - 1) * limit;

            // 1. Cache implementation
            const cacheKey = `courses:list:page=${page}:limit=${limit}:search=${search}`;
            const cacheResult = await getRedisCache(cacheKey);
            if (cacheResult) return cacheResult;

            // FIX: You must declare the pipeline array first!
            const pipeline = [];

            // 2. Add Atlas Search Stage if search term exists
            if (search) {
                // Find plain-text matching teacher IDs first
                const matchingTeachers = await mongoose.model("User").find({
                    name: { $regex: search, $options: "i" }
                }).select("_id").lean();
                
                const teacherIds = matchingTeachers.map(t => t._id);

                // Dynamically build an "equals" clause for every matching teacher ID found
                const teacherSearchClauses = teacherIds.map(id => ({
                    equals: {
                        value: id,
                        path: "teacherId"
                    }
                }));

                pipeline.push({
                    $search: {
                        index: "default",
                        compound: {
                            should: [
                                {
                                    text: {
                                        query: search,
                                        path: ["title", "description", "level"],
                                        fuzzy: { maxEdits: 1 }
                                    }
                                },
                                // Spread the individual teacher clauses into the should array
                                ...teacherSearchClauses
                            ],
                            minimumShouldMatch: 1
                        }
                    }
                });
            }

            // 3. Add standard lookup / projection / pagination stages to the pipeline
            pipeline.push(
                {
                    $lookup: {
                        from: "users", // Adjust this if your actual collection name is different (e.g., "teachers")
                        localField: "teacherId",
                        foreignField: "_id",
                        as: "teacherId",
                        pipeline: [
                            {
                                $project: {
                                    _id: 1,
                                    name: 1,
                                    email: 1
                                }
                            }
                        ]
                    }
                }, 
                { $sort: search ? { score: { $meta: "searchScore" } } : { createdAt: -1 } },
                {
                    $facet: {
                        metadata: [{ $count: "total" }],
                        data: [{ $skip: skipValues }, { $limit: limit }]
                    }
                }
            );

            // 4. Execute Pipeline
            const aggregationResult = await Course.aggregate(pipeline);

            let courses = aggregationResult[0]?.data || [];
            const totalCourses = aggregationResult[0]?.metadata[0]?.total || 0;

            // 5. Manually decrypt the clean teacher emails
            courses = courses.map(course => {
                if (course.teacherId && Array.isArray(course.teacherId)) {
                    course.teacherId = course.teacherId.map(teacher => {
                        if (teacher.email) {
                            teacher.email = teacher.email.includes("@") 
                                ? teacher.email 
                                : decryptEmail(teacher.email);
                        }
                        return teacher;
                    });
                }
                return course;
            });

            // 6. Structure the Response
            const result = {
                success: true,
                pagination: {
                    totalItem: totalCourses,
                    currentPage: page,
                    totalPages: Math.ceil(totalCourses / limit),
                    ItemsPerPage: limit
                },
                courses: courses
            };

            await setRedisCache(cacheKey, result, 300);
            return result;
        } catch (err) {
            err.statusCode = err.statusCode || 500;
            err.message = err.message || "Failed to get the courses data!";
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
            // const courseObj = course.toObject();
            // if (courseObj.teacherId && Array.isArray(courseObj.teacherId)) {
            //     courseObj.teacherId.forEach(teacher => {
            //         if (teacher && teacher.email) {
            //             // teacher.email = decryptEmail(teacher.email);
            //             teacher.email = teacher.email;
            //         }
            //     });
            // }
            await setRedisCache(cacheKey, course, 3600);
            return course;
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
                // new: true, 
                returnDocument:"after",
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
    async adminAssignTeacher(courseId, teacherId) {
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
    async adminRemoveTeacher(courseId, teacherId) {
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