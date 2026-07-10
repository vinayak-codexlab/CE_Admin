import mongoose from "mongoose";
import { decryptEmail, encryptEmail, generateSearchHash, tokenizeField } from "../utils/emailHelper.js";

const userSchema = new mongoose.Schema({
    name:{type:String},
    emailHash:{type:String,unique:true},
    // email:{type:String, unique:true},
    email:{
        type:String,
        unique:true,
        set: (v) => v ? encryptEmail(v) : v,
        get: (v) => v ? decryptEmail(v) : v
    },
    password:{type:String},
    role : {
        type : String,
        enum : ["admin","teacher","student"],
        default:"student",
    },
    isActive : {type : Boolean, default : true},
    // searchToken:{
    //     type: [String],
    //     index: true
    // }
}, {
    timestamps : true,
    toJSON : {getters :true},
    toObject: {getters : true}
});

// //auto saving the searchtoken before saving the user document
// userSchema.pre("save",function(next){
//     // 1. Get the plain name
//     const plainName = this.get("name") || "";
    
//     // 2. Safely get the plain email. If it's already encrypted, decrypt it for token generation
//     const rawEmail = this.get("email") || "";
//     const plainEmail = rawEmail.includes("@") ? rawEmail : decryptEmail(rawEmail);

//     const tokens = [
//         ...tokenizeField(plainName),
//         ...tokenizeField(plainEmail)
//     ];
//     this.searchToken = [...new Set(tokens)].map(token=>generateSearchHash(token));
//     next();
// });

const User = mongoose.model("User",userSchema);
export default User;