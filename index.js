import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import router from "./routes/adminRoute.js";
import { errorHandler } from "./middleware/errorHandler.js";
import cookieParser from "cookie-parser";
import { generalLimiter } from "./middleware/rateLimiter.js";
import routes from "./routes/routes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT;

connectDB();

app.use(express.json());
app.use(cookieParser());
app.use(generalLimiter);

routes(app);

// app.use("/v1/admin",authLimiter, router);
app.get("/",(req,res)=>{
    res.send("Admin API is running...");
});
app.use(errorHandler);

app.listen(PORT, ()=>{
    console.log(`Server is running on port ${PORT}`);
});

