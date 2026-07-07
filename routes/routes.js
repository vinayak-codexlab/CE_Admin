import authRoute from "./adminRoute.js";
import courseRoute from "./courseRoute.js";
import { authLimiter, generalLimiter } from "../middleware/rateLimiter.js";

const baseUrl = "/v1/admin";

const routes = (app)=>{
    app.use(`${baseUrl}`, authLimiter, authRoute);
    app.use(`${baseUrl}/courses`, authLimiter, courseRoute);
};

export default routes;

