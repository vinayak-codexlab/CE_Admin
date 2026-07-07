import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name:{type:String},
    emailHash:{type:String,unique:true},
    email:{type:String, unique:true},
    password:{type:String},
    role : {
        type : String,
        enum : ["admin","teacher","student"],
        default:"student",
    },
    isActive : {type : Boolean, default : true},
}, {
    timestamps : true
});

const User = mongoose.model("User",userSchema);
export default User;