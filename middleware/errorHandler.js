import { ZodError } from "zod";

export const errorHandler = (err,req,res,next) =>{
    console.log("Error caught by global handler.");
    if (err instanceof ZodError || err.name === "ZodError"){
        const issues = err.issues || err.errors || [];
        const formattedErrors = issues.reduce((acc, curr)=>{
            acc[curr.path.join('.')] = curr.message;
            return acc;
        }, {});
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: formattedErrors
        });
    }
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error !";

    return res.status(statusCode).json({
        success: false,
        message: message
    });
};