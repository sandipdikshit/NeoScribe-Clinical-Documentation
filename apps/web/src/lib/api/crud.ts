import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { API_URL } from "@/config/apiConfig";
import { isTokenExpired } from "@/shared/lib/auth";
import { redirectToLogin } from "@/shared/utils/navigation.utils";
import { getToken } from "@/shared/lib/auth";

// Create axios instance
const apiClient: AxiosInstance = axios.create({
     baseURL: API_URL,
     headers: {
          "Content-Type": "multipart/form-data",
     },
});

// Add a request interceptor to include the Bearer token and handle encryption
apiClient.interceptors.request.use(
     (config: InternalAxiosRequestConfig) => {
          // Add authentication token
          const token = getToken();
          if (token) {
               if (isTokenExpired(token)) {
                    // Token is expired, redirect to login
                    redirectToLogin();
                    // Reject the request to prevent it from proceeding
                    return Promise.reject(
                         new Error("Authentication token has expired")
                    );
               }

               config.headers = config.headers || {};
               config.headers.Authorization = `Bearer ${token}`;
          }

          return config;
     },
     (error) => {
          return Promise.reject(error);
     }
);

/**
 * GET request
 * @param endpoint API endpoint
 * @returns Promise with response data
 */
export const getData = async (endpoint: string) => {
     try {
          const response = await apiClient.get(endpoint);
          return response.data;
     } catch (error: any) {
          if (error.response.status === 401) {
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
 * @returns Promise with response data
 */
export const postData = async (
     endpoint: string,
     data?: any,
     content?: string,
     signal?: AbortSignal
) => {
     try {
          if (content === "application/json") {
               data = JSON.stringify(data);
               const response = await apiClient.post(endpoint, data, {
                    headers: {
                         "Content-Type": "application/json",
                    },
               });
               return response.data;
          } else if (content === "multipart/form-data") { 
               const response = await apiClient.post(endpoint, data, {
                    headers: {
                         "Content-Type": "multipart/form-data",
                    },
               });
               return response.data;
          }else {
               const response = await apiClient.post(endpoint, data);
               return response.data;
          }
     } catch (error: any) {
          if (error.response.status === 401) {
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
 * @returns Promise with response data
 */
export const putData = async (
     endpoint: string,
     data: any,
     content?: string
) => {
     try {
          if (content === "application/json") {
               data = JSON.stringify(data);
               const response = await apiClient.put(endpoint, data, {
                    headers: {
                         "Content-Type": "application/json",
                    },
               });
               return response.data;
          } else {
               const response = await apiClient.put(endpoint, data);
               return response.data;
          }
     } catch (error: any) {
          if (error.response.status === 401) {
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
 * @returns Promise with response data
 */
export const patchData = async (endpoint: string, data: any) => {
     try {
          const response = await apiClient.patch(endpoint, data);
          return response.data;
     } catch (error: any) {
          if (error.response.status === 401) {
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
export const deleteData = async (endpoint: string) => {
     try {
          const response = await apiClient.delete(endpoint);
          return response.data;
     } catch (error: any) {
          if (error.response.status === 401) {
               redirectToLogin();
          }
          console.error("Error deleting data:", error);
          throw error;
     }
};

// Export apiClient for advanced use cases
export { apiClient };
