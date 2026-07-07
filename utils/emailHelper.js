import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();
const encryption_key = process.env.EMAIL_ENCRYPTION_KEY;

const LENGTH = 16;
const ALGORITHM = "aes-256-cbc";

export const encryptEmail = (text)=>{
    if (!text) return text;
    const RANDOM_IV = crypto.randomBytes(LENGTH); //dynamic iv generating everytime
    
    const cipher = crypto.createCipheriv(ALGORITHM, encryption_key, RANDOM_IV);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return RANDOM_IV.toString("hex") + encrypted;
};
export const decryptEmail = (text)=>{
    if (!text) return text;
    if (text.includes("@")) {
        return text;
    }
    try{
        const ivHex = text.slice(0, LENGTH * 2);
        const iv = Buffer.from(ivHex, "hex");

        if (iv.length != LENGTH) return text;
        const encrptedText = text.slice(LENGTH*2);

        const decipher = crypto.createDecipheriv(ALGORITHM, encryption_key, iv);
        let decrypted = decipher.update(encrptedText, "hex", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
    } catch (err){
        console.error("Decrption failed", err.message);
        return text;
    }
};
export const hashEmail = (text)=>{
    if (!text) return text;
    return crypto.createHash("sha256").update(text.toLowerCase().trim()).digest("hex");
};

export default {encryptEmail, decryptEmail, hashEmail};
