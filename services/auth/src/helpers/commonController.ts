import { HttpCodes } from "./responseCodes"
const { v4: uuidv4 } = require('uuid');
import "../utils/mailer";
import jwt from 'jsonwebtoken';
require("dotenv").config();
import crypto from "crypto";

export default class CommonController {
    constructor(){
        this.APIResponse = this.APIResponse.bind(this)
        this.generateRandomNumber = this.generateRandomNumber.bind(this)
        this.generateOTP = this.generateOTP.bind(this)
        this.generateJwt = this.generateJwt.bind(this)
        this.checkAccessToken = this.checkAccessToken.bind(this)
    }

    //return api response
    async APIResponse (res : any , error : any, result : any) {
        if (error) {
            res.status(200).json({message : res.__("api.errors.SomeThingWentWrong"), code : HttpCodes['BAD_REQUEST']})
        } else {
            if (result && result.status == "customError") {
                res.status(200).json({ message: res.__(`api.errors.${result.msg}`), code: result.code, data: result.data });
            } else {
                res.status(200).json({ message: res.__(`api.msg.${result.msg}`), code: result.code, data: result.data });
            }
        }
    }

    // get epoch time
    async getEpoch() {
        return Math.floor(Date.now() / 1000);
    }

    // get random number
    async generateRandomNumber() {
        // Generate a UUID
         const uuid = uuidv4();
         
         // Remove hyphens and take the first 7 characters
         const hexString = uuid.replace(/-/g, '').slice(0, 7);
         
         // Convert hexadecimal to decimal
         const decimal = parseInt(hexString, 16);
         
         // Ensure it's 7 digits by using modulo and padding
         return (decimal % 10000000).toString().padStart(7, '0');
       
    }

    // Generate Unique OTP
    async generateOTP() {
        return Math.floor(100000 + Math.random() * 900000);
    }

    // Generate jwt token
    async generateJwt (userId : any) {
        return jwt.sign({id : userId}, process.env.JWT_SECRET, {expiresIn : process.env.JWT_EXPIRES_IN || '1h'})
    }

    // Check Access token
    async checkAccessToken (req: any, res: any, next: any) {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({msg: res.__('api.errors.AccessTokenRequired'), code : HttpCodes["UNAUTHORIZED"] , data : {}});
        }

        const token = authHeader.split(" ")[1];

        jwt.verify(token , process.env.JWT_SECRET , (err, user) => {
            if (err) {
                return res.status(403).json({ msg: res.__('api.errors.InvalidOrExpiredToken'), code : HttpCodes["UNAUTHORIZED"] , data : {}});
            }
            req.body.user = user;
            next();
        })
    }

    // Data encryption middleware
    async staticEncryption (text : any) {
        const iv = crypto.randomBytes(12)
        const key = Buffer.from(process.env.AES_SECRET_KEY,"hex")
        const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
        let encrypted = cipher.update(text,"utf-8","hex")
        encrypted += cipher.final("hex")
        const authTag = cipher.getAuthTag().toString("hex")
        return {
            encryptedText : encrypted,
            authTag : authTag,
            iv : iv.toString("hex")
        }
    }

    // Data Decryption middleware
    async staticDecryption (req: any, res: any, next: any) {
        try {
            const encryptedText = req.body.encryptedText
            const authTag = req.body.authTag
            const iv = req.body.iv
            const key = Buffer.from(process.env.AES_SECRET_KEY,"hex")
            const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv,"hex"))
            decipher.setAuthTag(Buffer.from(authTag, "hex"))
            let decrypted = decipher.update(encryptedText, "hex", "utf-8")
            decrypted += decipher.final("utf-8")
            req.body =  JSON.parse(decrypted);
            return next();
        } catch (error) {
            return res.status(401).json({ msg: res.__('api.errors.RequestNotSecure'), code : HttpCodes["UNAUTHORIZED"] , data : {}});
        }
        
    }
}