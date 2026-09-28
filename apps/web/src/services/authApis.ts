import axios from "axios";
import { API_URL, AUTH_URL } from "@/config/apiConfig";
import { securePostData, secureGetData } from "@/lib/api/secure-crud";
import { Provider } from "@/shared/types/provider.type";
import { EncryptedPayload, cryptoService } from "../../shared/crypto-utils";

export interface LoginCredentials {
     vEmail: string;
     txPassword: string;
}

export interface AuthResponse {
     access_token: string;
     message: string;
     code?: number;
     data?: {
          accessToken: string;
          refreshToken: string;
     };
}

// Token management
const TOKEN_KEY = "provider_auth_token";

// Helper function to set cookie with expiry
export const setCookie = (
     name: string,
     value: string,
     expiryDays: number = 1
): void => {
     const date = new Date();
     date.setTime(date.getTime() + expiryDays * 24 * 60 * 60 * 1000);
     const expires = `expires=${date.toUTCString()}`;
     document.cookie = `${name}=${value};${expires};path=/;SameSite=Strict`;
};

// Helper function to get cookie value
export const getCookie = (name: string): string | null => {
     const cookieName = `${name}=`;
     const cookies = document.cookie.split(";");

     for (let i = 0; i < cookies.length; i++) {
          let cookie = cookies[i].trim();
          if (cookie.indexOf(cookieName) === 0) {
               return cookie.substring(cookieName.length, cookie.length);
          }
     }
     return null;
};

export const getUserData = async () => {
     const dataToDecrypt = localStorage.getItem("auth_data");

     const dataToDecryptAsObject = JSON.parse(
          dataToDecrypt || "{}"
     ) as EncryptedPayload;
     const decryptedData = await cryptoService.decrypt(
          dataToDecryptAsObject,
          process.env.NEXT_PUBLIC_AES_SECRET_KEY
     );
     return decryptedData;
};

// Helper function to delete cookie
export const deleteCookie = (name: string): void => {
     document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Strict`;
};

export const setAuthToken = (token: string): void => {
     setCookie(TOKEN_KEY, token, 1);
     // Set default Authorization header for axios
     axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
};

export const getAuthToken = (): string | null => {
     return getCookie(TOKEN_KEY);
};

export const isAuthenticated = (): boolean => {
     return !!getAuthToken();
};

// Initialize auth header if token exists
export const initializeAuth = (): void => {
     const token = getAuthToken();
     if (token) {
          axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
     }
};
// Auth services
const authService = {
     // Register a new provider
     register: async (providerData: {
          vEmail: string;
          vName: string;
          vSpecialty: string;
          txPassword: string;
     }) => {
          try {
               const data = JSON.stringify({
                    vEmail: providerData.vEmail,
                    vName: providerData.vName,
                    vSpeciality: providerData.vSpecialty,
                    txPassword: providerData.txPassword,
               });

               const response = await securePostData({
                    endpoint: `${AUTH_URL}/client-signup`,
                    data,
                    content: "application/json",
               });

               const otp_data = JSON.stringify({
                    vEmail: providerData.vEmail,
               });

               await securePostData({
                    endpoint: `${AUTH_URL}/get-otp`,
                    data: otp_data,
                    content: "application/json",
               });

               return response.data;
          } catch (error) {
               console.error("Registration error:", error);
               throw error;
          }
     },

     get_otp: async (email: string) => {
          try {
               const data = JSON.stringify({
                    vEmail: email,
               });

               const response = await securePostData({
                    endpoint: `${AUTH_URL}/get-otp`,
                    data,
                    content: "application/json",
               });

               return response;
          } catch (error) {
               console.error("Registration error:", error);
               throw error;
          }
     },

     validate_otp: async (otp: string) => {
          try {
               const userData = await getUserData();
               const email = userData.email;
               const data = JSON.stringify({
                    vEmail: email,
                    otp: otp,
               });
               const response = await securePostData({
                    endpoint: `${AUTH_URL}/verofy-otp`,
                    data,
                    content: "application/json",
               });

               if (response.status == 200) {
                    const tempToken = localStorage.getItem("temp");

                    if (tempToken) {
                         setAuthToken(tempToken);
                    } else {
                         console.error("Decrypted token is undefined");
                    }
                    localStorage.removeItem("temp");
                    return {
                         success: true,
                         message: "OTP validated successfully",
                    };
               } else {
                    return { success: false, message: "OTP not validated" };
               }
          } catch (error) {
               console.error("Registration error:", error);
               throw error;
          }
     },

     // Login provider and get token
     login: async (credentials: { vEmail: string; txPassword: string }) => {
          try {
               const data = JSON.stringify({
                    vEmail: credentials.vEmail,
                    txPassword: credentials.txPassword,
               });

               const response = await securePostData({
                    endpoint: `${AUTH_URL}/client-login`,
                    data,
                    content: "application/json",
                    encrypt_request: true,
               });

               if (response.data.code == 200) {
                    localStorage.setItem(
                         "temp",
                         response.data.data.accessToken
                    );
                    return response.data;
               } else if (response.data.code > 400) {
                    return response.data;
               }
          } catch (error) {
               console.error("Login error:", error);
               throw error;
          }
     },

     // Logout provider
     logout: (): void => {
          deleteCookie(TOKEN_KEY);
          localStorage.clear();
          // Remove Authorization header
          delete axios.defaults.headers.common["Authorization"];
     },

     // Get current provider profile
     getCurrentProvider: async () => {
          try {
               const token = getAuthToken();

               if (!token) {
                    throw new Error("Not authenticated");
               }

               // const response = await getData(`${API_URL}/providers/me`);
               const response = await secureGetData({
                    endpoint: `${API_URL}/providers/me`,
                    encrypt_response: true,
               });
               return response;
          } catch (error) {
               console.error("Error fetching provider profile:", error);
               throw error;
          }
     },

     //setnewpassword
     reset_password: async ({
          email,
          password,
     }: {
          email: string;
          password: string;
     }) => {
          try {
               const data = JSON.stringify({
                    vEmail: email,
                    txPassword: password,
               });

               const response = await securePostData({
                    endpoint: `${AUTH_URL}/set-new-password`,
                    data,
                    content: "application/json",
               });

               if (response.status == 200) {
                    return {
                         success: true,
                         message: "Password reset successfully",
                    };
               } else {
                    return { success: false, message: "Password not reset" };
               }
          } catch (error) {
               throw error;
          }
     },

     // Update provider profile
     updateProfile: async (
          provider_id: number,
          providerData: Partial<Provider>
     ): Promise<Provider> => {
          try {
               const formData = new FormData();

               // Append only non-undefined fields
               Object.entries(providerData).forEach(([key, value]) => {
                    if (value !== undefined && value !== null) {
                         formData.append(key, value.toString());
                    }
               });

               const response = await axios.put(
                    `${API_URL}/api/v2/providers/${provider_id}`,
                    formData,
                    {
                         headers: {
                              Authorization: `Bearer ${getAuthToken()}`,
                         },
                    }
               );

               return response.data;
          } catch (error) {
               console.error("Error updating profile:", error);
               throw error;
          }
     },
};

export default authService;
