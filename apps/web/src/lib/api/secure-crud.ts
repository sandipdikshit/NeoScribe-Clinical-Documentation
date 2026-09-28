import axios, {
     AxiosInstance,
     InternalAxiosRequestConfig,
     AxiosResponse,
} from "axios";
import { API_URL } from "@/config/apiConfig";
import { isTokenExpired } from "@/shared/lib/auth";
import { redirectToLogin } from "@/shared/utils/navigation.utils";
import { getToken } from "@/shared/lib/auth";
import { cryptoService } from "../../../shared/crypto-utils";
import { deleteCookie } from "@/services/authApis";

// Create axios instance
const apiClient: AxiosInstance = axios.create({
     baseURL: API_URL,
     headers: {
          "Content-Type": "application/json",
     },
});

// Add a request interceptor to include the Bearer token and conditionally encrypt
apiClient.interceptors.request.use(
     async (config: InternalAxiosRequestConfig) => {
          // Add authentication token
          const token = getToken();
          if (token) {
               if (isTokenExpired(token)) {
                    redirectToLogin();
                    return Promise.reject(
                         new Error("Authentication token has expired")
                    );
               }

               config.headers = config.headers || {};
               config.headers.Authorization = `Bearer ${token}`;
          } else if (token == undefined) {
               // If no token is present, redirect to login
               deleteCookie("provider_auth_token");
          }

          // Check if encryption is requested via header
          const shouldEncrypt =
               config.headers["X-Encrypt-Request"] === "true" ||
               config.headers["x-encrypt-request"] === "true";

          // Encrypt request data if encryption header is set and data exists
          if (shouldEncrypt && config.data) {
               try {
                    config.data = await cryptoService.encrypt(
                         config.data,
                         process.env.NEXT_PUBLIC_AES_SECRET_KEY
                    );
                    // Add a header to indicate the request body is encrypted
                    // config.headers['X-Encrypted-Request'] = 'true';
               } catch (error) {
                    console.error("Failed to encrypt request:", error);
                    throw error;
               }
          }

          return config;
     },
     (error) => {
          return Promise.reject(error);
     }
);

// Add response interceptor to conditionally decrypt data
apiClient.interceptors.response.use(
     async (response: AxiosResponse) => {
          if (
               response.data.data &&
               JSON.stringify(response.data.data).includes("authTag")
          ) {
               try {
                    // Attempt decryption if the response is marked as encrypted
                    response.data.data = await cryptoService.decrypt(
                         response.data.data,
                         process.env.NEXT_PUBLIC_AES_SECRET_KEY
                    );
               } catch (error) {
                    console.error("Failed to decrypt response:", error);
                    // Keep the original response data if decryption fails
               }
          }
          return response;
     },
     (error) => {
          return Promise.reject(error);
     }
);

/**
 * GET request
 * @param endpoint API endpoint
 * @param encrypt_response Whether to encrypt the response (default: false)
 * @returns Promise with response data
 */
export const secureGetData = async ({
     endpoint,
     encrypt_response = false,
}: {
     endpoint: string;
     encrypt_response?: boolean;
}) => {
     const headers: any = {};

     if (encrypt_response) {
          headers["X-Encrypt-Response"] = "true";
     }

     try {
          const response = await apiClient.get(endpoint, { headers });

          if (encrypt_response) {
               // If response is encrypted, decrypt it
               response.data = await cryptoService.decrypt(
                    response.data,
                    process.env.NEXT_PUBLIC_AES_SECRET_KEY
               );
          }
          return response.data;
     } catch (error: any) {
          if (error.response?.status === 401) {
               redirectToLogin();
          }
          console.error("Error fetching data:", error);
          throw error;
     }
};

/**
 * POST request
 * @param endpoint API endpoint
 * @param data Request payload
 * @param content Content-Type header value
 * @param encrypt_request Whether to encrypt the request (default: false)
 * @param encrypt_response Whether to encrypt the response (default: false)
 * @returns Promise with response data
 */
export const securePostData = async ({
     endpoint,
     data,
     content,
     encrypt_request = false,
     encrypt_response = false,
}: {
     endpoint: string;
     data?: any;
     content?: string;
     encrypt_request?: boolean;
     encrypt_response?: boolean;
}) => {
     try {
          const headers: any = {
               "Content-Type": content || "application/json",
          };

          // Set encryption header if requested
          if (encrypt_request) {
               headers["X-Encrypt-Request"] = "true";
          }

          if (encrypt_response) {
               headers["X-Encrypt-Response"] = "true";
          }

          const response = await apiClient.post(endpoint, data, { headers });

          if (encrypt_response) {
               // If response is encrypted, decrypt it
               response.data.data = await cryptoService.decrypt(
                    response.data,
                    process.env.NEXT_PUBLIC_AES_SECRET_KEY
               );
          }

          return response;
     } catch (error: any) {
          if (error.response?.status === 401) {
               redirectToLogin();
          }
          console.error("Error posting data:", error);
          throw error;
     }
};

/**
 * PUT request
 * @param endpoint API endpoint
 * @param data Request payload
 * @param content Content-Type header value
 * @param encrypt_request Whether to encrypt the request (default: false)
 * @param encrypt_response Whether to encrypt the response (default: false)
 * @returns Promise with response data
 */
export const securePutData = async ({
     endpoint,
     data,
     content,
     encrypt_request,
     encrypt_response,
}: {
     endpoint: string;
     data?: any;
     content?: string;
     encrypt_request?: boolean;
     encrypt_response?: boolean;
}) => {
     try {
          const headers: any = {
               "Content-Type": content || "application/json",
          };

          // Set encryption header if requested
          if (encrypt_request) {
               headers["X-Encrypt-Request"] = "true";
          }

          if (encrypt_response) {
               headers["X-Encrypt-Response"] = "true";
          }

          const response = await apiClient.put(endpoint, data, { headers });

          if (encrypt_response) {
               // If response is encrypted, decrypt it
               response.data = await cryptoService.decrypt(
                    response.data,
                    process.env.NEXT_PUBLIC_AES_SECRET_KEY
               );
          }

          return response.data;
     } catch (error: any) {
          if (error.response?.status === 401) {
               redirectToLogin();
          }
          console.error("Error putting data:", error);
          throw error;
     }
};

/**
 * PATCH request
 * @param endpoint API endpoint
 * @param data Request payload
 * @param encrypt_request Whether to encrypt the request (default: false)
 * @param encrypt_response Whether to encrypt the response (default: false)
 * @returns Promise with response data
 */
export const securePatchData = async ({
     endpoint,
     data,
     encrypt_request = false,
     encrypt_response = false,
}: {
     endpoint: string;
     data: any;
     encrypt_request?: boolean;
     encrypt_response?: boolean;
}) => {
     try {
          const headers: any = {};

          // Set encryption header if requested
          if (encrypt_request) {
               headers["X-Encrypt-Request"] = "true";
          }

          if (encrypt_response) {
               headers["X-Encrypt-Response"] = "true";
          }

          const response = await apiClient.patch(endpoint, data, { headers });

          if (encrypt_response) {
               // If response is encrypted, decrypt it
               response.data = await cryptoService.decrypt(
                    response.data,
                    process.env.NEXT_PUBLIC_AES_SECRET_KEY
               );
          }
          return response.data;
     } catch (error: any) {
          if (error.response?.status === 401) {
               redirectToLogin();
          }
          console.error("Error patching data:", error);
          throw error;
     }
};

/**
 * DELETE request
 * @param endpoint API endpoint
 * @returns Promise with response data
 */
export const secureDeleteData = async (endpoint: string) => {
     try {
          const response = await apiClient.delete(endpoint);
          return response.data;
     } catch (error: any) {
          if (error.response?.status === 401) {
               redirectToLogin();
          }
          console.error("Error deleting data:", error);
          throw error;
     }
};

// Export apiClient for advanced use cases
export { apiClient };

// Helper function to create encrypted request config
export const createEncryptedConfig = (additionalHeaders?: any) => {
     return {
          headers: {
               "X-Encrypt-Request": "true",
               ...additionalHeaders,
          },
     };
};
