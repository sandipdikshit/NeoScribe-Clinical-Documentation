"use strict";

import { HttpCodes } from "../helpers/responseCodes";
const models = require("../db/models/index");
import commonHelper from "../helpers/commonController";
const {sendEmail, sendEmailV2} = require("../utils/mailer");
const {
    generateRandomNumber,
    getEpoch,
    generateOTP,
    generateJwt,
    staticEncryption
} = new commonHelper;
import * as bcrypt from "bcrypt";
import jwt from 'jsonwebtoken';

export default class authenticationModel {
  constructor() {
    this.ClientSignup = this.ClientSignup.bind(this);
    this.Login = this.Login.bind(this);
    this.sendOtp = this.sendOtp.bind(this);
    this.verifyOtp = this.verifyOtp.bind(this);
    this.setNewPassword = this.setNewPassword.bind(this);
  }

  //Sign up API
  async ClientSignup(body: any, callback: any) {
    try {
      console.log(">>>>>>>>>", body);

      const findUser = await models.User.findOne({
        where: { vEmail: body.vEmail },
      });
      if (findUser) {
        return callback(null, {
          status: HttpCodes["API_FAILURE"],
          msg: "EmailAlreadyExists",
          code: HttpCodes["BAD_REQUEST"],
          data: {},
        });
      }

      const hash = await bcrypt.hash(body.txPassword, 10);

      let userCreatedData = await models.User.build({
        iUserId: await generateRandomNumber(),
        vName: body.vName,
        vEmail: body.vEmail,
        txPassword: hash,
        isVerified: false,
        vSpeciality : body.vSpeciality,
        iNPI : body.iNPI,
        tiStatus: 1,
        iCreatedAt: await getEpoch(),
        iUpdatedAt: await getEpoch(),
      });

      let userCreated = await userCreatedData.save();

      const token = await jwt.sign({id : body.vEmail}, process.env.JWT_SECRET, {expiresIn : '1d'});

      const subject = 'Welcome to Neoscribe 🎉';

      const content = `<head>
                          <meta charset="UTF-8">
                          <meta name="viewport" content="width=device-width, initial-scale=1.0">
                          <title>Reset Your NeoScribe Password</title>
                      </head>
                      <body style="background-color:#f4f4f4; margin:0; padding:0; font-family: Arial, sans-serif;">
                          <div style="padding:30px;">
                              <div style="max-width:600px; margin:auto; background:#fff; border-radius:8px; overflow:hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                  <!-- Header -->
                                  <div style="background-color:#0070f885; padding:30px 20px; text-align:center;">
                                      <img alt="NeoScribe Logo" src="https://neolytix.com/wp-content/uploads/2020/02/New_logo.svg" style="width:150px; margin-bottom:10px;">
                                      <h1 style="color:#fff; margin:0; font-size:28px;">Password Reset Request</h1>
                                  </div>
                                
                                  <!-- Content -->
                                  <div style="padding:40px 30px; text-align:center;">
                                      <h2 style="color:#333; margin-bottom:20px;">🔑 Reset Your Password</h2>
                                    
                                      <p style="color:#666; font-size:16px; line-height:1.6; margin-bottom:25px;">
                                          We received a request to reset the password for your NeoScribe account. If you made this request, click the button below to create a new password.
                                      </p>
                                    
                                      <div style="background-color:#f8f9fa; border-radius:8px; padding:25px; margin:25px 0;">
                                          <p style="color:#333; font-size:16px; margin:0 0 20px 0;">
                                              <strong>Click below to reset your password:</strong>
                                          </p>
                                        
                                          <a href="http://app.neoscribe.ai/reset-password?email=${token}"
                                            style="display:inline-block; padding:12px 30px; background-color:#2b9348; color:#fff; text-decoration:none; border-radius:5px; font-size:16px; font-weight:bold;">
                                              Reset Password
                                          </a>
                                        
                                          <p style="color:#999; font-size:14px; margin:20px 0 0 0;">
                                              This link will expire in 24 hours
                                          </p>
                                      </div>
                                    
                                      <div style="background-color:#e8f4fd; border:1px solid #bee5eb; border-radius:6px; padding:15px; margin-top:25px; text-align:left;">
                                          <p style="color:#0c5460; font-size:14px; margin:0 0 10px 0;">
                                              <strong>💡 Password Tips:</strong>
                                          </p>
                                          <ul style="color:#0c5460; font-size:14px; margin:0; padding-left:20px;">
                                              <li>Use at least 8 characters</li>
                                              <li>Include uppercase and lowercase letters</li>
                                              <li>Add numbers and special characters</li>
                                              <li>Avoid using personal information</li>
                                          </ul>
                                      </div>
                                    
                                      <hr style="border:none; border-top:1px solid #eee; margin:30px 0;">
                                    
                                      <p style="color:#666; font-size:15px; line-height:1.6; margin-bottom:15px;">
                                          <strong>Didn't request this change?</strong>
                                      </p>
                                    
                                      <p style="color:#666; font-size:15px; line-height:1.6;">
                                          If you didn't request a password reset, please ignore this email. Your password will remain unchanged. For security concerns, contact us at
                                          <a href="mailto:support@neolytix.com" style="color:#2b9348; text-decoration:none;">support@neolytix.com</a>
                                      </p>
                                  </div>
                                
                                  <!-- Footer -->
                                  <div style="background-color:#f8f9fa; padding:20px; text-align:center; border-top:1px solid #eee;">
                                      <p style="color:#999; font-size:13px; margin:0 0 10px 0;">
                                          © 2025 NeoScribe. Engineered by <a href="https://neolytix.com/" target="_blank">Neolytix</a>. Resistance is futile.
                                      </p>
                                      <p style="color:#999; font-size:13px; margin:0;">
                                          <a href="https://neolytix.com/privacy-policy/" target="_blank" style="color:#999; text-decoration:none;">Privacy Policy</a> |
                                          <a href="https://neoscribe.ai/terms-of-service/" target="_blank" style="color:#999; text-decoration:none;">Terms of Service</a>
                                      </p>
                                  </div>
                              </div>
                          </div>
                      </body>`;

      await sendEmailV2(body.vEmail, subject, content);

      let response = {
        userId: userCreated.iUserId,
        name: userCreated.vName,
        email: userCreated.vEmail,
      };

      return callback(null, {
        status: HttpCodes["API_SUCCESS"],
        msg: "ClientSignupSuccess",
        code: HttpCodes["OK"],
        data: response,
      });
    } catch (error) {
      console.log("!!!!!!!!!!", error);
      return callback(null, {
        status: HttpCodes["API_FAILURE"],
        msg: "SomethingWentWrong",
        code: HttpCodes["INTERNAL_SERVER_ERROR"],
        data: {},
      });
    }
  }

  //Login API
  async Login(body: any, callback: any) {
    try {
      console.log(">>>>>>>>>", body);

      const findUser = await models.User.findOne({
        where: { vEmail: body.vEmail, tiStatus: 1 },
      });

      if (findUser) {
        let pass = await bcrypt.compare(body.txPassword, findUser.txPassword);
        if (pass) {
          const token = await generateJwt(findUser.iUserId);
          const response = {
            iUserId: findUser.iUserId,
            name : findUser.vName,
            speciality : findUser.vSpeciality,
            accessToken: token,
            npi: findUser.iNPI
          };
          const encryptedResponse = await staticEncryption(JSON.stringify(response));
          return callback(null, {
            status: HttpCodes["API_SUCCESS"],
            msg: "LoginSuccess",
            code: HttpCodes["OK"],
            data: encryptedResponse,
          });
        } else {
          return callback(null, {
            status: HttpCodes["API_FAILURE"],
            msg: "IncorrectPassword",
            code: HttpCodes["FORBIDDEN"],
            data: {},
          });
        }
      } else {
        return callback(null, {
          status: HttpCodes["API_FAILURE"],
          msg: "EmailNotRegistered",
          code: HttpCodes["CONTENT_NOT_FOUND"],
          data: {},
        });
      }
    } catch (error) {
      console.log("!!!!!!!!!!", error);
      return callback(null, {
        status: HttpCodes["API_FAILURE"],
        msg: "SomethingWentWrong",
        code: HttpCodes["INTERNAL_SERVER_ERROR"],
        data: {},
      });
    }
  }

  // Send OTP
  async sendOtp(body: any, callback: any) {
    try {
      console.log(">>>>>>>>>", body);

      const findUser = await models.User.findOne({
        where: { vEmail: body.vEmail, tiStatus: 1 },
      });
      if (findUser) {
        const otp = await generateOTP();
        const maskOTP = jwt.sign({code : otp}, process.env.JWT_SECRET, {expiresIn : '5m'})
        await models.User.update(
          { iOTP: maskOTP, iUpdatedAt: await getEpoch() },
          { where: { vEmail: body.vEmail } }
        );

        await sendEmail(body.vEmail, otp);    // mail function for otp

        return callback(null, {
          status: HttpCodes["API_SUCCESS"],
          msg: "OTPSentSuccessfully",
          code: HttpCodes["OK"],
          data: {},
        });
      } else {
        return callback(null, {
          status: HttpCodes["API_FAILURE"],
          msg: "EmailNotRegistered",
          code: HttpCodes["CONTENT_NOT_FOUND"],
          data: {},
        });
      }
    } catch (error) {
      console.log("!!!!!!!!!!", error);
      return callback(null, {
        status: HttpCodes["API_FAILURE"],
        msg: "SomethingWentWrong",
        code: HttpCodes["INTERNAL_SERVER_ERROR"],
        data: {},
      });
    }
  }

  // verify-otp
  async verifyOtp(body: any, callback: any) {
    try {
      console.log(">>>>>>>>>>", body);
      const findUser = await models.User.findOne({
        where: { vEmail: body.vEmail, tiStatus: 1 },
      });
      if (findUser) {
        const res = jwt.verify(findUser.iOTP, process.env.JWT_SECRET, (err, user) => {
          if (err || user.code != body.otp) {
            return false
          }else {
            return true
          }
        })
        if (res) {
          await models.User.update(
            { isVerified: true, iOTP : null, iUpdatedAt: await getEpoch() },
            { where: { vEmail: body.vEmail } }
          );

          return callback(null, {
            status: HttpCodes["API_SUCCESS"],
            msg: "OTPVerifiedSuccessfully",
            code: HttpCodes["OK"],
            data: {},
          });
        } else {
          return callback(null, {
            status: HttpCodes["API_FAILURE"],
            msg: "IncorrectOTP",
            code: HttpCodes["UNAUTHORIZED"],
            data: {},
          });
        }
      } else {
        return callback(null, {
          status: HttpCodes["API_FAILURE"],
          msg: "EmailNotRegistered",
          code: HttpCodes["CONTENT_NOT_FOUND"],
          data: {},
        });
      }
    } catch (error) {
      console.log("!!!!!!!!!!", error);
      return callback(null, {
        status: HttpCodes["API_FAILURE"],
        msg: "SomethingWentWrong",
        code: HttpCodes["INTERNAL_SERVER_ERROR"],
        data: {},
      });
    }
  }

  // set-new-password
  async setNewPassword(body: any, callback: any) {
    try {
        console.log(">>>>>>>>>>", body);
        const findUser = await models.User.findOne({
            where: { vEmail: body.vEmail, tiStatus: 1 },
        });
        if (!findUser) {
            return callback(null, {
                status: HttpCodes["API_FAILURE"],
                msg: "EmailNotRegistered",
                code: HttpCodes["CONTENT_NOT_FOUND"],
                data: {},
            });
        }else {
          const hash = await bcrypt.hash(body.txPassword, 10);

          await models.User.update(
            { txPassword: hash, iUpdatedAt: await getEpoch() },
            { where: { vEmail: body.vEmail } }
          );

          const subject = 'Password Changed for Neoscribe';

          const content = `<head>
                              <meta charset="UTF-8">
                              <meta name="viewport" content="width=device-width, initial-scale=1.0">
                              <title>Reset Your NeoScribe Password</title>
                          </head>
                          <body style="background-color:#f4f4f4; margin:0; padding:0; font-family: Arial, sans-serif;">
                              <div style="padding:30px;">
                                  <div style="max-width:600px; margin:auto; background:#fff; border-radius:8px; overflow:hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                      <!-- Header -->
                                      <div style="background-color:#0070f885; padding:30px 20px; text-align:center;">
                                          <img alt="NeoScribe Logo" src="https://neolytix.com/wp-content/uploads/2020/02/New_logo.svg" style="width:150px; margin-bottom:10px;">
                                          <h1 style="color:#fff; margin:0; font-size:28px;">Password Reset successful</h1>
                                      </div>
                                    
                                      <!-- Content -->
                                      <div style="padding:40px 30px; text-align:center;">
                                          <h2 style="color:#333; margin-bottom:20px;">🔑 Your password has been reset successfully</h2>
                                        
                                          <p style="color:#666; font-size:16px; line-height:1.6; margin-bottom:25px;">
                                              We received successfully changed the password for your NeoScribe account.
                                          </p>
                                        
                                          <hr style="border:none; border-top:1px solid #eee; margin:30px 0;">
                                        
                                          <p style="color:#666; font-size:15px; line-height:1.6; margin-bottom:15px;">
                                              <strong>Didn't request this change?</strong>
                                          </p>
                                        
                                          <p style="color:#666; font-size:15px; line-height:1.6;">
                                              If you didn't requested a password reset, please contact us at
                                              <a href="mailto:support@neolytix.com" style="color:#2b9348; text-decoration:none;">support@neolytix.com</a>
                                          </p>
                                      </div>
                                    
                                      <!-- Footer -->
                                      <div style="background-color:#f8f9fa; padding:20px; text-align:center; border-top:1px solid #eee;">
                                          <p style="color:#999; font-size:13px; margin:0 0 10px 0;">
                                              © 2025 NeoScribe. Engineered by <a href="https://neolytix.com/" target="_blank">Neolytix</a>. Resistance is futile.
                                          </p>
                                          <p style="color:#999; font-size:13px; margin:0;">
                                              <a href="https://neolytix.com/privacy-policy/" target="_blank" style="color:#999; text-decoration:none;">Privacy Policy</a> |
                                              <a href="https://neoscribe.ai/terms-of-service/" target="_blank" style="color:#999; text-decoration:none;">Terms of Service</a>
                                          </p>
                                      </div>
                                  </div>
                              </div>
                          </body>`

          await sendEmailV2(body.vEmail, subject, content);

          return callback(null, {
            status: HttpCodes["API_SUCCESS"],
            msg: "PasswordChangedSuccessfully",
            code: HttpCodes["OK"],
            data: {},
          });
        }
    } catch (error) {
      console.log("!!!!!!!!!!", error);
      return callback(null, {
        status: HttpCodes["API_FAILURE"],
        msg: "SomethingWentWrong",
        code: HttpCodes["INTERNAL_SERVER_ERROR"],
        data: {},
      });
    }
  }

  // verify token
  async verifyToken(body: any, callback: any) {
    return callback(null, {
      status: HttpCodes["API_SUCCESS"],
      msg: "TokenVerifiedSuccessfully",
      code: HttpCodes["OK"],
      data: {},
    });
  }
}