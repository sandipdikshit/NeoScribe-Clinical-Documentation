import authenticationController from "../../../controllers/authenticationController"
const {
    ClientSignup,
    Login,
    sendOtp,
    verifyOtp,
    setNewPassword,
    verifyToken
} = new authenticationController();
import commonHelper from "../../../helpers/commonController";
const {
    checkAccessToken,
    staticDecryption,
} = new commonHelper;

module.exports = function(router){
    router.post('/v1/client-signup',ClientSignup)
    router.post('/v1/client-login',staticDecryption, Login)
    router.post('/v1/get-otp',sendOtp)
    router.post('/v1/verofy-otp',verifyOtp)
    router.post('/v1/set-new-password',setNewPassword)
    router.get('/v1/verify-token',checkAccessToken,verifyToken)
}