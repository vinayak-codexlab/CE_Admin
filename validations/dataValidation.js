import { z } from "zod";
import mongoose from "mongoose";

export const registerSchema = z.object({
    name: z.string().min(2, "Name must be atleast 2 characters").trim(),
    email: z.string().email("Invalid email format").toLowerCase().trim(),
    password: z.string().min(6,"password must be atleast 6 characters"),
    role: z.string().toLowerCase().pipe(z.enum(["admin", "teacher", "student"])).optional(),
    isActive: z.boolean().optional(),
});

export const loginSchema = z.object({
    email: z.string().email("Invalid email format").toLowerCase().trim(),
    password: z.string().min(6,"Min length should be 6 !")
});

export const courseSchema = z.object({
    title: z.string().min(2,"Title's name is too small !").trim(),
    description: z.string().min(7,"description data is short !"),
    price: z.number().min(0, "price can not be negative !").default(0),
    // duration: z.string().default("0"),
    duration: z 
        .number({required_error:"Duration is required!"})
        .min(0, "duration can not be in negative!")
        .transform((val)=>`${val} hours`)
        .default(0),
    level: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
    status: z.enum(["draft", "published", "archived"]).default("published"),
});



//optional 
//teacherId: z.refine((val) => mongoose.Types.ObjectId.isValid(val), {
    //   message: "Invalid teacher ID format",
    // }).optional(),