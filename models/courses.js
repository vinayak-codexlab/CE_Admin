import mongoose from "mongoose";

const courseSchema = new mongoose.Schema({
    title:{type:String,unique:true},
    description:{type:String},
    teacherId:[{type:mongoose.Schema.Types.ObjectId,ref:"User"}],
    price:{type:Number,default:0},
    duration:{type:String,default:"0"},
    level:{type:String,enum:["beginner","intermediate","advanced"], default:"beginner"},
    status:{type:String,enum:["draft","published","archived"], default:"published"}
},{
    timestamps:true
});

const Course = mongoose.model("Courses", courseSchema);
export default Course;

