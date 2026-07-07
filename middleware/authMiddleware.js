import jwt from "jsonwebtoken";

const Protect = (req, res, next) => {
    // const token = req.cookies?.token;
    const token = req.cookies.accessToken;
    if (!token) {
        return res.status(401).json({ success: false, message: "Authentication failed !" });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next(); 
    } catch (err) {
        console.error("Authentication error:", err.message);
        return res.status(401).json({ success: false, message: "Failed to authenticate." });
    }
};
export default Protect;

