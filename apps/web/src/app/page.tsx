"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import authService from "@/services/authApis";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import { Input } from "@/shared/components/ui/input";
import {
     Eye,
     EyeOff,
     Sparkles,
     Shield,
     Clock,
     ChevronRight,
     Smartphone,
     FileText,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/shared/components/ui/button";
import { EncryptedPayload, cryptoService } from "../../shared/crypto-utils";

// Main Page Component
export default function Home() {
     const [vEmail, setUsername] = useState("");
     const [txPassword, setPassword] = useState("");
     const [rememberMe, setRememberMe] = useState(false);
     const [error, setError] = useState<string | null>(null);
     const [loading, setLoading] = useState(false);
     const [showPassword, setShowPassword] = useState(false);

     const router = useRouter();

     useEffect(() => {
          // Set version in local storage
          localStorage.setItem("app_version", "2.1.1 (alpha)");
     }, []);

     const handleSubmit = async (e: React.FormEvent) => {
          e.preventDefault();
          setError(null);
          setLoading(true);

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
                    err.response?.data?.detail ||
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
          <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50">
               {/* Header/Navbar */}
               <header className="container mx-auto py-4 px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center">
                         <div className="flex items-center">
                              <Image
                                   src="/name.png"
                                   alt="NeoScribe Logo"
                                   width={150}
                                   height={40}
                                   className="h-8 sm:h-10 w-auto"
                              />
                         </div>
                         <div className="flex gap-2 sm:gap-4">
                              <Button
                                   className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full px-4 sm:px-6 py-2 hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl text-sm sm:text-base"
                                   asChild
                              >
                                   <Link href="https://neoscribe.ai/join-alpha/">
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        Join Alpha
                                   </Link>
                              </Button>
                         </div>
                    </div>
               </header>

               {/* Hero Section with Login */}
               <section className="flex-1 py-8 sm:py-12 lg:py-24">
                    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                         <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
                              {/* Left Side - Hero Content */}
                              <div className="hidden lg:block space-y-8 animate-fade-in">
                                   <div className="space-y-4">
                                        <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold text-gray-900 leading-tight">
                                             Transform Your
                                             <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-blue-600">
                                                  {" "}
                                                  Medical Documentation
                                             </span>
                                        </h1>
                                        <p className="text-lg lg:text-xl text-gray-600 leading-relaxed">
                                             AI-powered clinical note generation
                                             that saves you time and improves
                                             accuracy. Join thousands of
                                             healthcare professionals
                                             revolutionizing their workflow.
                                        </p>
                                   </div>

                                   {/* Feature List */}
                                   <div className="space-y-4">
                                        <div className="flex items-start space-x-3">
                                             <div className="flex-shrink-0 w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                                                  <Clock className="w-5 h-5 text-emerald-600" />
                                             </div>
                                             <div>
                                                  <h3 className="font-semibold text-gray-900">
                                                       Save 2+ hours daily
                                                  </h3>
                                                  <p className="text-gray-600">
                                                       Reduce documentation time
                                                       by 70% with intelligent
                                                       automation
                                                  </p>
                                             </div>
                                        </div>

                                        <div className="flex items-start space-x-3">
                                             <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                                  <Smartphone className="w-5 h-5 text-purple-600" />
                                             </div>
                                             <div>
                                                  <h3 className="font-semibold text-gray-900">
                                                       Mobile & Desktop
                                                  </h3>
                                                  <p className="text-gray-600">
                                                       Seamless experience
                                                       across all devices
                                                  </p>
                                             </div>
                                        </div>

                                        <div className="flex items-start space-x-3">
                                             <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                                  <FileText className="w-5 h-5 text-blue-600" />
                                             </div>
                                             <div>
                                                  <h3 className="font-semibold text-gray-900">
                                                       Smart Notes
                                                  </h3>
                                                  <p className="text-gray-600">
                                                       Auto-structured notes
                                                       following medical
                                                       standards
                                                  </p>
                                             </div>
                                        </div>
                                   </div>
                              </div>

                              {/* Right Side - Login Card */}
                              <div className="w-full max-w-md mx-auto lg:mx-0 lg:ml-auto">
                                   <Card className="shadow-2xl border-0 overflow-hidden backdrop-blur-sm bg-white/95">
                                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-emerald-500/5 pointer-events-none" />

                                        <div className="relative">
                                             <div className="flex justify-center pt-8 pb-4">
                                                  <div className="flex flex-col items-center space-y-2">
                                                       <Image
                                                            src="/name.png"
                                                            alt="Neoscribe Logo"
                                                            width={150}
                                                            height={36}
                                                            className="h-8 w-auto"
                                                       />
                                                       <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                                                            Welcome Back
                                                       </h2>
                                                       <p className="text-gray-600 text-sm">
                                                            Sign in to continue
                                                            to NeoScribe
                                                       </p>
                                                  </div>
                                             </div>

                                             <CardHeader className="pt-2 pb-2 px-6 sm:px-8">
                                                  {error && (
                                                       <div
                                                            className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg animate-shake"
                                                            role="alert"
                                                       >
                                                            <span className="block text-sm">
                                                                 {error}
                                                            </span>
                                                       </div>
                                                  )}
                                             </CardHeader>

                                             <CardContent className="px-6 sm:px-8 pb-8">
                                                  <form
                                                       onSubmit={handleSubmit}
                                                       className="space-y-5"
                                                  >
                                                       <div className="space-y-2">
                                                            <Label
                                                                 htmlFor="vEmail"
                                                                 className="text-gray-700 font-medium"
                                                            >
                                                                 Email
                                                            </Label>
                                                            <Input
                                                                 id="vEmail"
                                                                 type="email"
                                                                 placeholder="example@gmail.com"
                                                                 value={vEmail}
                                                                 onChange={(
                                                                      e
                                                                 ) =>
                                                                      setUsername(
                                                                           e
                                                                                .target
                                                                                .value
                                                                      )
                                                                 }
                                                                 required
                                                                 className="h-11 bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 transition-all"
                                                            />
                                                       </div>

                                                       <div className="space-y-2">
                                                            <Label
                                                                 htmlFor="txPassword"
                                                                 className="text-gray-700 font-medium"
                                                            >
                                                                 Password
                                                            </Label>
                                                            <div className="relative">
                                                                 <Input
                                                                      id="txPassword"
                                                                      type={
                                                                           showPassword
                                                                                ? "text"
                                                                                : "password"
                                                                      }
                                                                      placeholder="••••••••••"
                                                                      value={
                                                                           txPassword
                                                                      }
                                                                      onChange={(
                                                                           e
                                                                      ) =>
                                                                           setPassword(
                                                                                e
                                                                                     .target
                                                                                     .value
                                                                           )
                                                                      }
                                                                      required
                                                                      className="h-11 bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-500 transition-all pr-10"
                                                                 />
                                                                 <button
                                                                      type="button"
                                                                      onClick={
                                                                           togglePasswordVisibility
                                                                      }
                                                                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors"
                                                                      tabIndex={
                                                                           -1
                                                                      }
                                                                 >
                                                                      {showPassword ? (
                                                                           <EyeOff className="h-5 w-5" />
                                                                      ) : (
                                                                           <Eye className="h-5 w-5" />
                                                                      )}
                                                                 </button>
                                                            </div>
                                                       </div>

                                                       <Button
                                                            type="submit"
                                                            disabled={loading}
                                                            className="w-full h-11 bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200 relative overflow-hidden group"
                                                       >
                                                            <span className="relative z-10 flex items-center justify-center">
                                                                 {loading ? (
                                                                      <>
                                                                           <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                                                           Logging
                                                                           in...
                                                                      </>
                                                                 ) : (
                                                                      <>
                                                                           Login
                                                                           <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                                                      </>
                                                                 )}
                                                            </span>
                                                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-blue-700 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                                                       </Button>

                                                       <div className="text-center space-y-3 pt-4">
                                                            <p className="text-sm text-gray-600">
                                                                 <Link
                                                                      href="/reset-password"
                                                                      className="text-blue-600 hover:text-blue-700 hover:underline font-medium transition-colors"
                                                                 >
                                                                      Forgot
                                                                      your
                                                                      password?
                                                                 </Link>
                                                            </p>

                                                            <p className="text-xs text-gray-500">
                                                                 By logging in,
                                                                 you agree to
                                                                 our{" "}
                                                                 <Link
                                                                      href="/privacy-policy"
                                                                      className="text-blue-600 hover:underline"
                                                                 >
                                                                      Privacy
                                                                      Policy
                                                                 </Link>
                                                            </p>
                                                       </div>
                                                  </form>
                                             </CardContent>
                                        </div>
                                   </Card>

                                   {/* Mobile Hero Content */}
                                   <div className="lg:hidden mt-12 text-center space-y-4">
                                        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                                             Transform Your Medical
                                             Documentation
                                        </h2>
                                        <p className="text-gray-600">
                                             Join thousands of healthcare
                                             professionals using AI to
                                             revolutionize their workflow
                                        </p>
                                   </div>
                              </div>
                         </div>
                    </div>
               </section>

               {/* Footer */}
               <footer className="bg-gradient-to-b from-gray-50 to-gray-100 py-8 sm:py-12 mt-auto">
                    <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
                         <Image
                              src="/name.png"
                              alt="NeoScribe Logo"
                              width={180}
                              height={50}
                              className="h-8 sm:h-10 w-auto mx-auto mb-4"
                         />
                         <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
                              Transforming healthcare documentation with
                              AI-powered solutions.
                         </p>

                         <div className="flex flex-wrap justify-center gap-4 sm:gap-8 text-sm mb-6">
                              <Link
                                   href="/product"
                                   className="text-gray-700 hover:text-emerald-600 transition-colors"
                              >
                                   Product
                              </Link>
                              <span className="text-gray-400 hidden sm:inline">
                                   |
                              </span>
                              <Link
                                   href="/pricing"
                                   className="text-gray-700 hover:text-emerald-600 transition-colors"
                              >
                                   Pricing
                              </Link>
                              <span className="text-gray-400 hidden sm:inline">
                                   |
                              </span>
                              <Link
                                   href="/support"
                                   className="text-gray-700 hover:text-emerald-600 transition-colors"
                              >
                                   Support
                              </Link>
                         </div>

                         <Image
                              src="/neolytix-logo.png"
                              alt="Neolytix Logo"
                              width={120}
                              height={30}
                              className="h-5 sm:h-6 w-auto mx-auto mb-6 cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() =>
                                   window.open(
                                        "https://neolytix.com/",
                                        "_blank"
                                   )
                              }
                         />

                         <div className="flex justify-center gap-4 mb-6">
                              {/* Social Media Icons - Keeping existing SVGs but with improved styling */}
                              <Link
                                   href="#"
                                   aria-label="Facebook"
                                   className="group"
                              >
                                   <svg
                                        className="h-5 w-5 text-gray-600 group-hover:text-emerald-600 transition-colors"
                                        fill="currentColor"
                                        viewBox="0 0 24 24"
                                        aria-hidden="true"
                                   >
                                        <path
                                             fillRule="evenodd"
                                             d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"
                                             clipRule="evenodd"
                                        />
                                   </svg>
                              </Link>
                              <Link
                                   href="#"
                                   aria-label="Instagram"
                                   className="group"
                              >
                                   <svg
                                        className="h-5 w-5 text-gray-600 group-hover:text-emerald-600 transition-colors"
                                        fill="currentColor"
                                        viewBox="0 0 24 24"
                                        aria-hidden="true"
                                   >
                                        <path
                                             fillRule="evenodd"
                                             d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z"
                                             clipRule="evenodd"
                                        />
                                   </svg>
                              </Link>
                              <Link
                                   href="#"
                                   aria-label="Twitter"
                                   className="group"
                              >
                                   <svg
                                        className="h-5 w-5 text-gray-600 group-hover:text-emerald-600 transition-colors"
                                        fill="currentColor"
                                        viewBox="0 0 24 24"
                                        aria-hidden="true"
                                   >
                                        <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                                   </svg>
                              </Link>
                              <Link
                                   href="#"
                                   aria-label="LinkedIn"
                                   className="group"
                              >
                                   <svg
                                        className="h-5 w-5 text-gray-600 group-hover:text-emerald-600 transition-colors"
                                        fill="currentColor"
                                        viewBox="0 0 24 24"
                                        aria-hidden="true"
                                   >
                                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                                   </svg>
                              </Link>
                         </div>

                         <p className="text-xs text-gray-500">
                              © 2025 NeoScribe. Engineered by Neolytix.
                              Resistance is futile.
                         </p>
                    </div>
               </footer>

               <style jsx>{`
                    @keyframes fade-in {
                         from {
                              opacity: 0;
                              transform: translateY(20px);
                         }
                         to {
                              opacity: 1;
                              transform: translateY(0);
                         }
                    }

                    @keyframes shake {
                         0%,
                         100% {
                              transform: translateX(0);
                         }
                         10%,
                         30%,
                         50%,
                         70%,
                         90% {
                              transform: translateX(-2px);
                         }
                         20%,
                         40%,
                         60%,
                         80% {
                              transform: translateX(2px);
                         }
                    }

                    .animate-fade-in {
                         animation: fade-in 0.8s ease-out;
                    }

                    .animate-shake {
                         animation: shake 0.5s ease-in-out;
                    }
               `}</style>
          </div>
     );
}
