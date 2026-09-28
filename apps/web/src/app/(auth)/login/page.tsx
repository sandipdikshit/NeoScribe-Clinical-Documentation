"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import authService from "@/services/authApis";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import {
     EncryptedPayload,
     cryptoService,
} from "../../../../shared/crypto-utils"; // Adjust the import path as necessary

import packageJson from "../../../../package.json";

const Login: React.FC = () => {
     const [vEmail, setUsername] = useState("");
     const [txPassword, setPassword] = useState("");
     const [rememberMe, setRememberMe] = useState(false);
     const [error, setError] = useState<string | null>(null);
     const [loading, setLoading] = useState(false);
     const [showPassword, setShowPassword] = useState(false);

     const router = useRouter();

     useEffect(() => {
          // Set version in local storage
          localStorage.setItem("app_version", `${packageJson.version} (alpha)`);
     }, []);

     const handleSubmit = async (e: React.FormEvent) => {
          e.preventDefault();
          setError(null);
          setLoading(true);
          //setting purpose to login
          try {
               const response = await authService.login({ vEmail, txPassword });
               if (response?.code === 200) {
                    // If login is successful, redirect to the dashboard
                    const dataToEncrypt = JSON.stringify({ email: vEmail });
                    const encryptedData: EncryptedPayload =
                         await cryptoService.encrypt(
                              dataToEncrypt,
                              process.env.NEXT_PUBLIC_AES_SECRET_KEY
                         );
                    localStorage.setItem(
                         "auth_data",
                         JSON.stringify(encryptedData)
                    );
                    localStorage.setItem("purpose", "login");
                    await authService.get_otp(vEmail);
                    router.push("/verifyotp");
               } else if (response?.code > 400) {
                    // Handle error response
                    setError(
                         response?.message || "Login failed. Please try again."
                    );
               } else if (response?.code === 400) {
                    setError("Invalid credentials. Please try again.");
               }
          } catch (err: any) {
               const errorMessage =
                    err.response?.data?.message ||
                    "Login failed. Please check your credentials.";
               setError(errorMessage);
          } finally {
               setLoading(false);
          }
     };

     const togglePasswordVisibility = () => {
          setShowPassword(!showPassword);
     };

     return (
          <div className="flex h-screen w-screen items-center justify-center px-4 bg-white">
               <Card className="mx-auto w-full max-w-md border-0 rounded-lg shadow-2xl border-[10px] border-white">
                    <div className="flex justify-center mt-8">
                         <div className="flex flex-col items-center">
                              <Image
                                   src="/name.png"
                                   alt="Neoscribe Logo"
                                   width={150}
                                   height={36}
                                   className="m-2"
                              />
                              <h2 className="text-center text-2xl font-semibold text-gray-900">
                                   Log In
                              </h2>
                         </div>
                    </div>

                    <CardHeader className="pt-6 pb-2">
                         {error && (
                              <div
                                   className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md"
                                   role="alert"
                              >
                                   <span className="block sm:inline">
                                        {error}
                                   </span>
                              </div>
                         )}
                    </CardHeader>

                    <CardContent className="px-8 pb-8">
                         <form onSubmit={handleSubmit} className="space-y-5">
                              <div className="space-y-2">
                                   <Label htmlFor="vEmail">Email</Label>
                                   <Input
                                        data-test-id="email-login-input"
                                        id="vEmail"
                                        type="text"
                                        placeholder="example@gmail.com"
                                        value={vEmail}
                                        onChange={(e) =>
                                             setUsername(e.target.value)
                                        }
                                        required
                                        className="bg-gray-100 border-transparent focus:bg-white"
                                   />
                              </div>

                              <div className="space-y-2">
                                   <Label htmlFor="txPassword">Password</Label>
                                   <div className="relative">
                                        <Input
                                             id="txPassword"
                                             data-test-id="password-login-input"
                                             type={
                                                  showPassword
                                                       ? "text"
                                                       : "password"
                                             }
                                             placeholder="••••••••••"
                                             value={txPassword}
                                             onChange={(e) =>
                                                  setPassword(e.target.value)
                                             }
                                             required
                                             className="bg-gray-100 border-transparent focus:bg-white"
                                        />
                                        <button
                                             type="button"
                                             onClick={togglePasswordVisibility}
                                             className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                                             tabIndex={-1}
                                        >
                                             {showPassword ? (
                                                  <EyeOff className="h-5 w-5" />
                                             ) : (
                                                  <Eye className="h-5 w-5" />
                                             )}
                                        </button>
                                   </div>
                              </div>

                              {/* <div className="flex items-center">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                className="text-emerald-00 border-gray-300"
              />
              <label
                htmlFor="remember"
                className="ml-2 text-sm text-gray-600"
              >
                Keep me logged in
              </label>
            </div> */}

                              <Button
                                   data-test-id="login-button"
                                   type="submit"
                                   disabled={loading}
                                   className="w-full bg-gradient-to-r from-emerald-400 to-blue-500 hover:from-emerald-500 hover:to-blue-600 text-white"
                              >
                                   {loading ? "Logging in..." : "Login"}
                              </Button>

                              <div className="text-center space-y-3">
                                   <p className="text-sm text-gray-600">
                                        <a
                                             href="/reset-password"
                                             className="hover:underline"
                                             onClick={(e) => {
                                                  e.preventDefault();
                                                  router.push(
                                                       "/reset-password"
                                                  );
                                             }}
                                        >
                                             Forgot your password?
                                        </a>
                                   </p>

                                   {/* <p className="text-sm text-gray-600">
                Don't have an account? <a href="/register" className="text-blue-600 hover:underline font-medium">Sign up</a>
              </p> */}

                                   <p className="text-xs text-gray-500">
                                        <a
                                             className="hover:underline hover:cursor-pointer"
                                             onClick={(e) => {
                                                  window.open(
                                                       "https://neolytix.com/privacy-policy/",
                                                       "_blank"
                                                  );
                                             }}
                                        >
                                             Privacy Policy
                                        </a>
                                   </p>

                                   <p className="text-xs text-gray-500">
                                        <a
                                             className="hover:underline hover:cursor-pointer"
                                             onClick={(e) => {
                                                  window.open(
                                                       "https://neoscribe.ai/terms-of-service/",
                                                       "_blank"
                                                  );
                                             }}
                                        >
                                             Terms of service
                                        </a>
                                   </p>
                              </div>
                         </form>
                    </CardContent>
               </Card>
          </div>
     );
};

export default Login;
