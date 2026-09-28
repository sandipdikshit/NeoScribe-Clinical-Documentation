"use client";
import React, { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import authService from "@/services/authApis";
import { jwtDecode } from "jwt-decode";
import { useToast } from "@/shared/hooks/use-toast";
import { cryptoService } from "../../../../shared/crypto-utils";

const Page = ({ params }: { params: Promise<{ email: string }> }) => {
     const { toast } = useToast();
     const searchParams = useSearchParams();

     const [userEmail, setUserEmail] = useState<string>("");
     const [pass, setPass] = useState<string>("");
     const [conPass, setConPass] = useState<string>("");
     const [loading, setLoading] = useState(false);
     const [error, setError] = useState<string | null>(null);
     const [passwordVisible, setPasswordVisible] = useState(false);
     const [confirmPasswordVisible, setConfirmPasswordVisible] =
          useState(false);
     const togglePasswordVisibility = () => {
          setPasswordVisible(!passwordVisible);
     };
     const toggleConfirmPasswordVisibility = () => {
          setConfirmPasswordVisible(!confirmPasswordVisible);
     };
     const router = useRouter();

     useEffect(() => {
          const fetchParams = async () => {
               const resolvedParams = searchParams.get("email");
               const decodedParams = resolvedParams
                    ? jwtDecode<{ id?: string }>(resolvedParams)
                    : null;
               if (decodedParams && decodedParams.id) {
                    setUserEmail(decodedParams.id);
               }
          };

          fetchParams();
     }, [searchParams]);

     const storeUserData = async (email: string, password: string) => {
          const dataToEncrypt = JSON.stringify({ email, password });
          const encryptedData = await cryptoService.encrypt(
               dataToEncrypt,
               process.env.NEXT_PUBLIC_AES_SECRET_KEY
          );
          localStorage.setItem("auth_data", JSON.stringify(encryptedData));
     };

     const submitHandler = async (
          e:
               | React.FormEvent<HTMLFormElement>
               | React.MouseEvent<HTMLButtonElement>
     ) => {
          e.preventDefault();

          setError(null);
          if (pass !== conPass) {
               setError("Passwords do not match");
               return;
          }
          setLoading(true);
          try {
               storeUserData(userEmail, pass);
               localStorage.setItem("purpose", "reset");

               const otpSent = await authService.get_otp(userEmail);

               if (otpSent.status === 200) {
                    toast({
                         description:
                              "OTP sent successfully. Please check your email.",
                    });
                    router.push("/verifyotp");
               } else {
                    toast({
                         description: "Failed to send OTP. Please try again.",
                         variant: "destructive",
                    });
               }
          } catch (err: any) {
               const errorMessage =
                    err.response?.data?.detail ||
                    "Failed to send OTP. Please try again.";
               setError(errorMessage);
          } finally {
               setLoading(false);
          }
     };

     useEffect(() => {
          checkPasswordStrength(pass);
     }, [pass]);

     const checkPasswordStrength = (password: string) => {
          const hasLowerCase = /[a-z]/.test(password);
          const hasUpperCase = /[A-Z]/.test(password);
          const hasNumber = /[0-9]/.test(password);
          const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(
               password
          );
          const isMinLength = password.length >= 8;

          // Calculate a score based on criteria met
          let score = 0;
          if (hasLowerCase) score += 1;
          if (hasUpperCase) score += 1;
          if (hasNumber) score += 1;
          if (hasSpecialChar) score += 1;
          if (isMinLength) score += 1;

          setPasswordStrength({
               score,
               hasLowerCase,
               hasUpperCase,
               hasNumber,
               hasSpecialChar,
               isMinLength,
          });
     };
     const [passwordStrength, setPasswordStrength] = useState({
          score: 0,
          hasLowerCase: false,
          hasUpperCase: false,
          hasNumber: false,
          hasSpecialChar: false,
          isMinLength: false,
     });
     const getStrengthLabel = () => {
          const { score } = passwordStrength;
          if (score === 0) return { text: "Very Weak", color: "bg-gray-200" };
          if (score === 1) return { text: "Weak", color: "bg-red-500" };
          if (score === 2) return { text: "Fair", color: "bg-orange-500" };
          if (score === 3) return { text: "Good", color: "bg-yellow-500" };
          if (score === 4) return { text: "Strong", color: "bg-blue-500" };
          return { text: "Very Strong", color: "bg-green-500" };
     };

     const strengthLabel = getStrengthLabel();

     return (
          <Suspense>
               <div className="h-screen w-screen bg-gray-50 flex flex-col items-center justify-center px-4">
                    <div className="flex flex-col bg-white items-center px-12 py-6 min-w-[30%] rounded-lg shadow-2xl border-[10px] border-white my-10 justify-center">
                         <Image
                              src="/name.png"
                              alt="Neoscribe Logo"
                              width={150}
                              height={36}
                              className="m-2"
                         />
                         <h2 className="text-center text-2xl font-semibold text-gray-900">
                              Reset your password
                         </h2>

                         <form
                              onSubmit={submitHandler}
                              className="mt-6 w-full flex flex-col items-center justify-center"
                         >
                              <div className="space-y-4 w-full">
                                   <div className="">
                                        {" "}
                                        <label
                                             htmlFor="vEmail"
                                             className="block text-sm font-medium text-gray-700"
                                        >
                                             Email
                                        </label>
                                        {searchParams.get("email") != null ? (
                                             <input
                                                  type="text"
                                                  value={userEmail}
                                                  onChange={(e) =>
                                                       setUserEmail(
                                                            e.target.value
                                                       )
                                                  }
                                                  className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent text-sm"
                                                  placeholder="Enter your email"
                                                  disabled
                                             />
                                        ) : (
                                             <input
                                                  type="text"
                                                  value={userEmail}
                                                  onChange={(e) =>
                                                       setUserEmail(
                                                            e.target.value
                                                       )
                                                  }
                                                  className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent text-sm"
                                                  placeholder="Enter your email"
                                             />
                                        )}
                                   </div>

                                   <div className="">
                                        <label
                                             htmlFor="password"
                                             className="block text-sm font-medium text-gray-700"
                                        >
                                             Set New Password
                                        </label>
                                        <div className="flex relative justify-center items-center">
                                             <input
                                                  type={
                                                       passwordVisible
                                                            ? "text"
                                                            : "password"
                                                  }
                                                  value={pass}
                                                  onChange={(e) =>
                                                       setPass(e.target.value)
                                                  }
                                                  className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent text-sm"
                                                  placeholder="Enter your Password..."
                                             />
                                             <div
                                                  className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer"
                                                  onClick={
                                                       togglePasswordVisibility
                                                  }
                                             >
                                                  {passwordVisible ? (
                                                       <svg
                                                            className="h-5 w-5 text-gray-500"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                            xmlns="http://www.w3.org/2000/svg"
                                                       >
                                                            <path
                                                                 strokeLinecap="round"
                                                                 strokeLinejoin="round"
                                                                 strokeWidth="2"
                                                                 d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                                                            ></path>
                                                       </svg>
                                                  ) : (
                                                       <svg
                                                            className="h-5 w-5 text-gray-500"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                            xmlns="http://www.w3.org/2000/svg"
                                                       >
                                                            <path
                                                                 strokeLinecap="round"
                                                                 strokeLinejoin="round"
                                                                 strokeWidth="2"
                                                                 d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                                            ></path>
                                                            <path
                                                                 strokeLinecap="round"
                                                                 strokeLinejoin="round"
                                                                 strokeWidth="2"
                                                                 d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                                            ></path>
                                                       </svg>
                                                  )}
                                             </div>
                                        </div>

                                        {/* -------password strength meter------------ */}
                                        {pass && (
                                             <div className="mt-2">
                                                  <div className="flex items-center justify-between mb-1">
                                                       <span className="text-xs text-gray-600">
                                                            Password strength:{" "}
                                                       </span>
                                                       <span className="text-xs font-medium">
                                                            {strengthLabel.text}
                                                       </span>
                                                  </div>
                                                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                                                       <div
                                                            className={`h-1.5 rounded-full ${strengthLabel.color}`}
                                                            style={{
                                                                 width: `${
                                                                      (passwordStrength.score /
                                                                           5) *
                                                                      100
                                                                 }%`,
                                                            }}
                                                       ></div>
                                                  </div>

                                                  {/* Password requirements */}
                                                  <div className="mt-2 space-y-1">
                                                       <p className="text-xs text-gray-600">
                                                            Your password must
                                                            have:
                                                       </p>
                                                       <ul className="text-xs space-y-1">
                                                            <li
                                                                 className={`flex items-center ${
                                                                      passwordStrength.isMinLength
                                                                           ? "text-green-600"
                                                                           : "text-gray-600"
                                                                 }`}
                                                            >
                                                                 {passwordStrength.isMinLength ? (
                                                                      <svg
                                                                           className="h-3 w-3 mr-1"
                                                                           fill="none"
                                                                           stroke="currentColor"
                                                                           viewBox="0 0 24 24"
                                                                           xmlns="http://www.w3.org/2000/svg"
                                                                      >
                                                                           <path
                                                                                strokeLinecap="round"
                                                                                strokeLinejoin="round"
                                                                                strokeWidth="2"
                                                                                d="M5 13l4 4L19 7"
                                                                           ></path>
                                                                      </svg>
                                                                 ) : (
                                                                      <svg
                                                                           className="h-3 w-3 mr-1"
                                                                           fill="none"
                                                                           stroke="currentColor"
                                                                           viewBox="0 0 24 24"
                                                                           xmlns="http://www.w3.org/2000/svg"
                                                                      >
                                                                           <path
                                                                                strokeLinecap="round"
                                                                                strokeLinejoin="round"
                                                                                strokeWidth="2"
                                                                                d="M6 18L18 6M6 6l12 12"
                                                                           ></path>
                                                                      </svg>
                                                                 )}
                                                                 At least 8
                                                                 characters
                                                            </li>
                                                            <li
                                                                 className={`flex items-center ${
                                                                      passwordStrength.hasLowerCase
                                                                           ? "text-green-600"
                                                                           : "text-gray-600"
                                                                 }`}
                                                            >
                                                                 {passwordStrength.hasLowerCase ? (
                                                                      <svg
                                                                           className="h-3 w-3 mr-1"
                                                                           fill="none"
                                                                           stroke="currentColor"
                                                                           viewBox="0 0 24 24"
                                                                           xmlns="http://www.w3.org/2000/svg"
                                                                      >
                                                                           <path
                                                                                strokeLinecap="round"
                                                                                strokeLinejoin="round"
                                                                                strokeWidth="2"
                                                                                d="M5 13l4 4L19 7"
                                                                           ></path>
                                                                      </svg>
                                                                 ) : (
                                                                      <svg
                                                                           className="h-3 w-3 mr-1"
                                                                           fill="none"
                                                                           stroke="currentColor"
                                                                           viewBox="0 0 24 24"
                                                                           xmlns="http://www.w3.org/2000/svg"
                                                                      >
                                                                           <path
                                                                                strokeLinecap="round"
                                                                                strokeLinejoin="round"
                                                                                strokeWidth="2"
                                                                                d="M6 18L18 6M6 6l12 12"
                                                                           ></path>
                                                                      </svg>
                                                                 )}
                                                                 At least 1
                                                                 lowercase
                                                                 letter (a-z)
                                                            </li>
                                                            <li
                                                                 className={`flex items-center ${
                                                                      passwordStrength.hasUpperCase
                                                                           ? "text-green-600"
                                                                           : "text-gray-600"
                                                                 }`}
                                                            >
                                                                 {passwordStrength.hasUpperCase ? (
                                                                      <svg
                                                                           className="h-3 w-3 mr-1"
                                                                           fill="none"
                                                                           stroke="currentColor"
                                                                           viewBox="0 0 24 24"
                                                                           xmlns="http://www.w3.org/2000/svg"
                                                                      >
                                                                           <path
                                                                                strokeLinecap="round"
                                                                                strokeLinejoin="round"
                                                                                strokeWidth="2"
                                                                                d="M5 13l4 4L19 7"
                                                                           ></path>
                                                                      </svg>
                                                                 ) : (
                                                                      <svg
                                                                           className="h-3 w-3 mr-1"
                                                                           fill="none"
                                                                           stroke="currentColor"
                                                                           viewBox="0 0 24 24"
                                                                           xmlns="http://www.w3.org/2000/svg"
                                                                      >
                                                                           <path
                                                                                strokeLinecap="round"
                                                                                strokeLinejoin="round"
                                                                                strokeWidth="2"
                                                                                d="M6 18L18 6M6 6l12 12"
                                                                           ></path>
                                                                      </svg>
                                                                 )}
                                                                 At least 1
                                                                 uppercase
                                                                 letter (A-Z)
                                                            </li>
                                                            <li
                                                                 className={`flex items-center ${
                                                                      passwordStrength.hasNumber
                                                                           ? "text-green-600"
                                                                           : "text-gray-600"
                                                                 }`}
                                                            >
                                                                 {passwordStrength.hasNumber ? (
                                                                      <svg
                                                                           className="h-3 w-3 mr-1"
                                                                           fill="none"
                                                                           stroke="currentColor"
                                                                           viewBox="0 0 24 24"
                                                                           xmlns="http://www.w3.org/2000/svg"
                                                                      >
                                                                           <path
                                                                                strokeLinecap="round"
                                                                                strokeLinejoin="round"
                                                                                strokeWidth="2"
                                                                                d="M5 13l4 4L19 7"
                                                                           ></path>
                                                                      </svg>
                                                                 ) : (
                                                                      <svg
                                                                           className="h-3 w-3 mr-1"
                                                                           fill="none"
                                                                           stroke="currentColor"
                                                                           viewBox="0 0 24 24"
                                                                           xmlns="http://www.w3.org/2000/svg"
                                                                      >
                                                                           <path
                                                                                strokeLinecap="round"
                                                                                strokeLinejoin="round"
                                                                                strokeWidth="2"
                                                                                d="M6 18L18 6M6 6l12 12"
                                                                           ></path>
                                                                      </svg>
                                                                 )}
                                                                 At least 1
                                                                 number (0-9)
                                                            </li>
                                                            <li
                                                                 className={`flex items-center ${
                                                                      passwordStrength.hasSpecialChar
                                                                           ? "text-green-600"
                                                                           : "text-gray-600"
                                                                 }`}
                                                            >
                                                                 {passwordStrength.hasSpecialChar ? (
                                                                      <svg
                                                                           className="h-3 w-3 mr-1"
                                                                           fill="none"
                                                                           stroke="currentColor"
                                                                           viewBox="0 0 24 24"
                                                                           xmlns="http://www.w3.org/2000/svg"
                                                                      >
                                                                           <path
                                                                                strokeLinecap="round"
                                                                                strokeLinejoin="round"
                                                                                strokeWidth="2"
                                                                                d="M5 13l4 4L19 7"
                                                                           ></path>
                                                                      </svg>
                                                                 ) : (
                                                                      <svg
                                                                           className="h-3 w-3 mr-1"
                                                                           fill="none"
                                                                           stroke="currentColor"
                                                                           viewBox="0 0 24 24"
                                                                           xmlns="http://www.w3.org/2000/svg"
                                                                      >
                                                                           <path
                                                                                strokeLinecap="round"
                                                                                strokeLinejoin="round"
                                                                                strokeWidth="2"
                                                                                d="M6 18L18 6M6 6l12 12"
                                                                           ></path>
                                                                      </svg>
                                                                 )}
                                                                 At least 1
                                                                 special
                                                                 character
                                                                 (!@#$%^&*)
                                                            </li>
                                                       </ul>
                                                  </div>
                                             </div>
                                        )}
                                   </div>

                                   <div>
                                        <label
                                             htmlFor="confirmPassword"
                                             className="block text-sm font-medium text-gray-700"
                                        >
                                             Confirm New Password
                                        </label>

                                        <div className="flex relative justify-center items-center">
                                             <input
                                                  type={
                                                       confirmPasswordVisible
                                                            ? "text"
                                                            : "password"
                                                  }
                                                  value={conPass}
                                                  onChange={(e) =>
                                                       setConPass(
                                                            e.target.value
                                                       )
                                                  }
                                                  className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent text-sm"
                                                  placeholder="Confirm your Password..."
                                             />
                                             <div
                                                  className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer"
                                                  onClick={
                                                       toggleConfirmPasswordVisibility
                                                  }
                                             >
                                                  {confirmPasswordVisible ? (
                                                       <svg
                                                            className="h-5 w-5 text-gray-500"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                            xmlns="http://www.w3.org/2000/svg"
                                                       >
                                                            <path
                                                                 strokeLinecap="round"
                                                                 strokeLinejoin="round"
                                                                 strokeWidth="2"
                                                                 d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                                                            ></path>
                                                       </svg>
                                                  ) : (
                                                       <svg
                                                            className="h-5 w-5 text-gray-500"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                            xmlns="http://www.w3.org/2000/svg"
                                                       >
                                                            <path
                                                                 strokeLinecap="round"
                                                                 strokeLinejoin="round"
                                                                 strokeWidth="2"
                                                                 d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                                            ></path>
                                                            <path
                                                                 strokeLinecap="round"
                                                                 strokeLinejoin="round"
                                                                 strokeWidth="2"
                                                                 d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                                            ></path>
                                                       </svg>
                                                  )}
                                             </div>
                                        </div>

                                        <div className="d">
                                             {conPass.length > 2 &&
                                                  (pass === conPass ? null : (
                                                       <p className="mt-1 text-xs text-red-600">
                                                            Passwords do not
                                                            match
                                                       </p>
                                                  ))}
                                        </div>
                                   </div>
                              </div>

                              {error && (
                                   <p className="text-red-500 mt-2 text-sm">
                                        {error}
                                   </p>
                              )}

                              <button
                                   type="submit"
                                   disabled={loading}
                                   className="mt-6 bg-gradient-to-r from-emerald-400 to-blue-500 hover:from-emerald-500 hover:to-blue-600 w-full text-white py-2 px-4 rounded-md"
                              >
                                   {loading ? "Submitting..." : "Submit"}
                              </button>
                         </form>
                    </div>
               </div>
          </Suspense>
     );
};

export default Page;
