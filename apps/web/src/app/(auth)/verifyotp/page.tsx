// app/(auth)/verifyotp/page.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { LoaderCircle } from "lucide-react";
import authService, { getUserData } from "@/services/authApis";
import { useToast } from "@/shared/hooks/use-toast";

const VerifyOtp = () => {
     const { toast } = useToast();
     const router = useRouter();

     const [email, setEmail] = useState<string>("");
     const [otp, setOtp] = useState(Array(6).fill(""));
     const [loading, setLoading] = useState(false);
     const [error, setError] = useState<string | null>(null);
     const [purpose, setPurpose] = useState<string | null>(null);

     const inputs = useRef<(HTMLInputElement | null)[]>([]);

     // Load user data from localStorage on component mount
     useEffect(() => {
          const initialize = async () => {
               // Get and decrypt the auth data
               setPurpose(localStorage.getItem("purpose"));
               const decryptedData = await getUserData();

               if (decryptedData && decryptedData.email) {
                    setEmail(decryptedData.email);
               } else {
                    // Redirect if no email is found
                    toast({
                         title: "Session Error",
                         description: "No email found. Please try again.",
                         variant: "destructive",
                    });
                    router.push("/login");
               }

               if (decryptedData?.purpose) {
                    setPurpose(decryptedData.purpose);
               }
          };

          initialize();

          // Focus on first input field when component mounts
          setTimeout(() => {
               inputs.current[0]?.focus();
          }, 100);
     }, [router, toast]);

     const handleChange = (
          e: React.ChangeEvent<HTMLInputElement>,
          index: number
     ) => {
          // Only allow numeric input
          const value = e.target.value.replace(/[^0-9]/g, "");

          if (value.length <= 1) {
               const newOtp = [...otp];
               newOtp[index] = value;
               setOtp(newOtp);

               // Auto-focus next input if current input is filled
               if (value && index < 5) {
                    inputs.current[index + 1]?.focus();
               }
          }
     };

     const handleKeyDown = (
          e: React.KeyboardEvent<HTMLInputElement>,
          index: number
     ) => {
          // Handle backspace for empty fields
          if (e.key === "Backspace" && !otp[index] && index > 0) {
               inputs.current[index - 1]?.focus();
          }

          // Handle left arrow key
          if (e.key === "ArrowLeft" && index > 0) {
               inputs.current[index - 1]?.focus();
          }

          // Handle right arrow key
          if (e.key === "ArrowRight" && index < 5) {
               inputs.current[index + 1]?.focus();
          }

          if (e.key === "Enter" && index > 4) {
               // If the last input is filled, trigger OTP verification
               verifyOtp();
          }

          // Clear error when user starts typing again
          if (error) {
               setError(null);
          }
     };

     const handlePaste = (e: React.ClipboardEvent) => {
          e.preventDefault();
          const pastedData = e.clipboardData.getData("text").trim();

          // Check if pasted content is numeric and of correct length
          if (/^\d+$/.test(pastedData) && pastedData.length <= 6) {
               const digits = pastedData.split("").slice(0, 6);
               const newOtp = [...otp];

               digits.forEach((digit, index) => {
                    if (index < 6) {
                         newOtp[index] = digit;
                    }
               });

               setOtp(newOtp);

               // Focus on last filled input or the next empty one
               const focusIndex = Math.min(digits.length, 5);
               inputs.current[focusIndex]?.focus();
          }
     };

     const verifyOtp = async () => {
          const otpValue = otp.join("");
          // Validate OTP is complete
          if (otpValue.length !== 6) {
               setError("Please enter all 6 digits of the OTP.");
               return;
          }
          setLoading(true);
          setError(null);

          try {
               const result = await authService.validate_otp(otpValue);
               if (!result.success) {
                    toast({
                         title: "Verification Unsuccessful",
                         description: "Verification code is incorrect.",
                         variant: "destructive",
                    });
                    setError(
                         result.message || "Invalid OTP. Please try again."
                    );
                    return;
               }
               // Handle different purposes
               if (purpose === "reset") {
                    await handlePasswordReset();
                    router.push("/login");
               } else if (purpose === "login") {
                    toast({
                         title: "Verification Successful",
                         description: "Your account has been verified.",
                         variant: "success",
                    });
                    router.push("/dashboard");
               } else {
                    // Default successful verification
                    toast({
                         title: "Verification Successful",
                         description: "Your account has been verified.",
                         variant: "success",
                    });
                    router.push("/login");
               }
          } catch (error) {
               console.error("Error verifying OTP:", error);
               setError("Failed to verify OTP. Please try again.");
          } finally {
               setLoading(false);
          }
     };

     const handlePasswordReset = async () => {
          try {
               const { email, password } = await getUserData();

               if (!email || !password) {
                    setError("Missing information for password reset.");
                    return;
               }

               const reset = await authService.reset_password({
                    email,
                    password,
               });

               if (reset.success) {
                    toast({
                         title: "Password Reset Successful",
                         description:
                              "You can now log in with your new password.",
                         variant: "success",
                    });

                    // Clean up localStorage
                    cleanupLocalStorage();
               } else {
                    setError(
                         reset.message || "Failed to reset password. Try again."
                    );
               }
          } catch (error) {
               console.error("Error resetting password:", error);
               setError("Failed to reset password. Please try again.");
          }
     };

     const resendOtp = async () => {
          if (!email) {
               setError("Email not found. Please try again.");
               return;
          }

          setLoading(true);
          try {
               const result = await authService.get_otp(email);

               if (result?.status === 200) {
                    toast({
                         title: "OTP Sent",
                         description: "A new OTP has been sent to your email.",
                         variant: "success",
                    });
                    // Reset OTP inputs
                    setOtp(Array(6).fill(""));
                    inputs.current[0]?.focus();
               } else {
                    setError("Failed to send OTP. Please try again.");
               }
          } catch (error) {
               console.error("Error sending OTP:", error);
               setError("Failed to send OTP. Please try again.");
          } finally {
               setLoading(false);
          }
     };

     const cleanupLocalStorage = () => {
          localStorage.removeItem("auth_data");
     };
     return (
          <div className="bg-white w-full min-h-screen px-4 flex flex-col items-center justify-center">
               <div className="flex flex-col items-center px-8 py-6 rounded-lg shadow-2xl border-[10px] border-white my-10 justify-center w-full max-w-md">
                    <Image
                         src="/name.png"
                         alt="Neoscribe Logo"
                         width={150}
                         height={36}
                         className="m-2"
                    />

                    <h2 className="text-2xl font-bold font-sans mt-4">
                         Verification
                    </h2>

                    <div className="mt-6 flex flex-col items-center justify-center">
                         <p className="text-gray-500 text-sm font-sans">
                              We sent a code to
                         </p>
                         {email ? (
                              <p className="text-black text-sm font-semibold font-sans">
                                   {email}
                              </p>
                         ) : (
                              <p className="text-gray-400 text-sm font-sans">
                                   Loading email...
                              </p>
                         )}
                    </div>

                    {/* OTP Input Fields */}
                    <div className="flex mt-6 gap-3">
                         {otp.map((value, index) => (
                              <input
                                   type="text"
                                   inputMode="numeric"
                                   maxLength={1}
                                   key={index}
                                   value={value}
                                   onChange={(e) => handleChange(e, index)}
                                   onKeyDown={(e) => handleKeyDown(e, index)}
                                   onPaste={
                                        index === 0 ? handlePaste : undefined
                                   }
                                   ref={(el) => {
                                        inputs.current[index] = el;
                                   }}
                                   aria-label={`OTP digit ${index + 1}`}
                                   className="w-12 h-12 text-center bg-gray-200 shadow-md rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                         ))}
                    </div>

                    {/* Error Message */}
                    {error && (
                         <p className="mt-3 text-sm text-red-500">{error}</p>
                    )}

                    <button
                         onClick={verifyOtp}
                         disabled={loading}
                         className="mt-6 bg-blue-500 text-white px-12 py-2 rounded-lg shadow-md hover:bg-blue-600 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed w-full max-w-xs flex items-center justify-center"
                    >
                         {loading ? (
                              <>
                                   <LoaderCircle
                                        className="animate-spin mr-2"
                                        size={18}
                                   />
                                   Verifying...
                              </>
                         ) : (
                              "Verify"
                         )}
                    </button>

                    <button
                         onClick={resendOtp}
                         disabled={loading}
                         className="mt-4 text-blue-600 text-sm hover:underline transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                         Didn&apos;t receive OTP? Resend
                    </button>

                    <div className="border-t border-gray-200 w-full my-6"></div>

                    <p className="text-sm font-normal">
                         Back to{" "}
                         <a
                              href="/login"
                              className="text-blue-600 hover:underline transition duration-300 font-bold"
                         >
                              Login
                         </a>
                    </p>
               </div>
          </div>
     );
};

export default VerifyOtp;
