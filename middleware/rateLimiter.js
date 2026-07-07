import rateLimit from 'express-rate-limit';

export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 50,
    message: {
        success: false,
        message: "Too many requests from this IP. Please try again after 15 minutes."
    },
    standardHeaders: true, 
    legacyHeaders: false, 
});

export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 50,
    message: {
        success: false,
        message: "Too many authentication attempts. Please try again after 15 minutes."
    },
    standardHeaders: true,
    legacyHeaders: false,
});