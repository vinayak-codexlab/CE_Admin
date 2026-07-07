import mongoose from "mongoose";

const connectDB = async()=>{
    try{
        const conn = mongoose.connect(process.env.MONGO_URI);
        console.log("DB connected.");
    } catch(err){
        console.log("Error in the DB connection !");
        process.exit(1);
    }
};

export default connectDB;