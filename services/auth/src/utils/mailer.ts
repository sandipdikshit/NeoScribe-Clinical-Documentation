const axios = require('axios');
require("dotenv").config();
const q = require("qs");

/// Microsoft Graph API settings

const clientId = process.env.CLIENT_ID; // Found in Azure portal
const clientSecret = process.env.CLIENT_SECRET; // Created in the Azure portal
const tokenUrl = process.env.TOKEN_URL;
const emailUrl = process.env.EMAIL_URL;
const scope = process.env.RESOURCE; // For application permission

async function getOAuthToken() { 
    const data = q.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      resource: scope,
      grant_type: 'client_credentials',
    });
  
    try {
      const response = await axios.post(tokenUrl, data, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      // console.log(response.data.access_token);
      return response.data.access_token; // Return access token
    } catch (error) {
      console.error('Error getting token:', error);
      throw new Error('OAuth token error');
    }
}
  
// Step 2: Send email using Microsoft Graph API
async function sendEmail(email , otp) {
    const token = await getOAuthToken();
  
    const emailData = {
      message: {
        subject: 'Verification code for Neoscribe',
        body: {
          contentType: 'html',
          content: `<head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>NeoScribe Email Verification</title>
                </head>
                <body style="background-color:#f4f4f4; margin:0; padding:0; font-family: Arial, sans-serif;">
                    <div style="padding:30px;">
                        <div style="max-width:600px; margin:auto; background:#fff; border-radius:8px; overflow:hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <!-- Header -->
                            <div style="background-color:#0070f885; padding:30px 20px; text-align:center;">
                                <img alt="NeoScribe Logo" src="https://neolytix.com/wp-content/uploads/2020/02/New_logo.svg" style="width:150px; margin-bottom:10px;">
                                <h1 style="color:#fff; margin:0; font-size:28px;">Email Verification</h1>
                            </div>
                          
                            <!-- Content -->
                            <div style="padding:40px 30px; text-align:center;">
                                <h2 style="color:#333; margin-bottom:20px;">🔐 Verify Your Login</h2>
                              
                                <p style="color:#666; font-size:16px; line-height:1.6; margin-bottom:25px;">
                                    To complete your login to NeoScribe, please use the verification code below:
                                </p>
                              
                                <div style="background-color:#f8f9fa; border-radius:8px; padding:25px; margin:25px 0;">
                                    <p style="color:#333; font-size:14px; margin:0 0 15px 0; text-transform: uppercase; letter-spacing: 1px;">
                                        Your Verification Code
                                    </p>
                                  
                                    <div style="font-size:36px; font-weight:bold; color:#2b9348; margin:10px 0; letter-spacing:6px; font-family: 'Courier New', monospace;">
                                        ${otp}
                                    </div>
                                  
                                    <p style="color:#999; font-size:14px; margin:15px 0 0 0;">
                                        This code will expire in 5 minutes
                                    </p>
                                </div>
                              
                                <div style="background-color:#fff3cd; border:1px solid #ffeaa7; border-radius:6px; padding:15px; margin-top:25px;">
                                    <p style="color:#856404; font-size:14px; margin:0;">
                                        <strong>⚠️ Security Notice:</strong> Please do not share this code with anyone. NeoScribe team will never ask for your verification code.
                                    </p>
                                </div>
                              
                                <hr style="border:none; border-top:1px solid #eee; margin:30px 0;">
                              
                                <p style="color:#666; font-size:15px; line-height:1.6;">
                                    If you didn't request this code, please ignore this email or contact our support team at
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
                </body>`,
        },
        toRecipients: [
          {
            emailAddress: {
              address: email, // Replace with recipient's email
            },
          },
        ],
      },
    };
  
    try {
      const response = await axios.post(emailUrl, emailData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
  
      console.log('Email sent successfully:', response.data);
    } catch (error) {
      console.error('Error sending email:', error.response?.data || error.message);
      throw Error(error);
    }
}

//reusable email service
async function sendEmailV2(email : any , subject : any, content : any) {
  const token = await getOAuthToken();

  const emailData = {
    message: {
      subject: subject,
      body: {
        contentType: 'html',
        content: content,
      },
      toRecipients: [
        {
          emailAddress: {
            address: email, // Replace with recipient's email
          },
        },
      ],
    },
  };

  try {
    const response = await axios.post(emailUrl, emailData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Email sent successfully:', response.data);
  } catch (error) {
    console.error('Error sending email:', error.response?.data || error.message);
    throw Error(error);
  }
}

module.exports = {
  sendEmail,
  sendEmailV2
}
