import { courseSchema } from "../validations/dataValidation.js";
import { courseService } from "../services/courseService.js";

export const addCourse = async (req,res,next)=>{
    try{
        const validatedData = courseSchema.parse(req.body);
        const result = await courseService.createCourse(validatedData);
        return res.status(201).json({success:true,message:"Course added successfully."});
    } catch(err){
        next(err);
    }
};
export const getCourses = async(req,res,next)=>{
    try{
        const { page, limit, search } = req.query;
        const result = await courseService.getCourses({ page, limit, search });
        return res.status(200).json({success: true, ...result});
    } catch(err){
        next(err);
    }
};
export const getCourseById = async(req,res,next)=>{
    try{
        const { id } = req.params;
        const course = await courseService.getCourseById(id);
        return res.status(200).json({success: true, data: course});
    } catch(err){
        next(err);
    }
};
export const updateCourse = async(req,res,next)=>{
    try{
        const {id} = req.params;
        const validatedData = courseSchema.partial().parse(req.body); //partial():skip missing fields
        const result = await courseService.updateCourse(id, validatedData);
        return res.status(200).json({success:true,message:"course data updated."});
    } catch(err){
        next(err);
    }
};
export const deleteCourse = async(req,res,next)=>{
    try{
        const { id } = req.params;
        await courseService.deleteCourse(id);
        return res.status(200).json({success: true,message: "Course deleted successfully."});
    } catch(err){
        next(err);
    }
};
export const adminAssignTeacher = async (req, res, next) => {
    try {
        const { courseId } = req.params;
        const { teacherId } = req.body;
        // if (!teacherId) {
        //     return res.status(400).json({ success: false, message: "teacherId is required in request body." });
        // }
        const result = await courseService.assignTeacherToCourse(courseId, teacherId);
        return res.status(200).json({
            success: true,
            message: "Teacher assigned to course successfully.",
            // data: result
        });
    } catch (err) {
        next(err);
    }
};
export const adminRemoveTeacher = async (req, res, next) => {
    try {
        const { courseId } = req.params;
        const { teacherId } = req.body;

        const result = await courseService.removeTeacherFromCourse(courseId, teacherId);

        return res.status(200).json({
            success: true,
            message: "Teacher removed from course successfully.",
        });
    } catch (err) {
        next(err);
    }
};
