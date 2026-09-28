import authenticationModel from "../services/authenticationModel";
import commonHelper from "../helpers/commonController";
const {APIResponse} = new commonHelper();

export default class authenticationController {
    authentication : authenticationModel
    constructor() {
        this.authentication = new authenticationModel();
        this.ClientSignup = this.ClientSignup.bind(this)
        this.Login = this.Login.bind(this)
        this.sendOtp = this.sendOtp.bind(this)
        this.verifyOtp = this.verifyOtp.bind(this)
        this.setNewPassword = this.setNewPassword.bind(this);
        this.verifyToken = this.verifyToken.bind(this);
    }

    // Sign Up Neoscribe
    ClientSignup(req: any, res: Response){
        this.authentication.ClientSignup(req.body , async(error : any , result : any) => {
            await APIResponse(res,error,result);
        })
    }

    // Login Neoscribe
    Login(req: any, res: Response){
        this.authentication.Login(req.body , async(error : any , result : any) => {
            await APIResponse(res,error,result);
        })
    }

    //otp generate
    sendOtp(req: any, res: Response) {
        this.authentication.sendOtp(req.body , async(error : any , result : any) => {
            await APIResponse(res,error,result);
        })
    }

    //otp verification
    verifyOtp(req: any, res: Response) {
        this.authentication.verifyOtp(req.body , async(error : any , result : any) => {
            await APIResponse(res,error,result);
        })
    }

    //set password
    setNewPassword(req: any, res: Response) {
        this.authentication.setNewPassword(req.body , async(error : any , result : any) => {
            await APIResponse(res,error,result);
        })
    }

    //token verification
    verifyToken(req: any, res: Response) {
        this.authentication.verifyToken(req.body , async(error : any , result : any) => {
            await APIResponse(res,error,result);
        })
    }
}