import { NextRouter } from "next/router";
import { redirect } from "next/navigation";
import { deleteCookie } from "@/services/authApis";
import { redirectToLogin } from "../utils/navigation.utils";

// Check if token exists in cookie
export const getToken = (): string | null => {
     if (typeof document === "undefined") return null; // Server-side check

     const name = "provider_auth_token=";
     const decodedCookie = decodeURIComponent(document.cookie);
     const cookieArray = decodedCookie.split(";");

     for (let i = 0; i < cookieArray.length; i++) {
          let cookie = cookieArray[i].trim();
          if (cookie.indexOf(name) === 0) {
               return cookie.substring(name.length, cookie.length);
          }
     }
     return null;
};

// Check if token is expired
export const isTokenExpired = (token: string): boolean => {
     try {
          // JWT tokens are in format: header.payload.signature
          const payload = token.split(".")[1];
          // Decode the base64 encoded payload
          const decodedPayload = JSON.parse(atob(payload));
          // Check if the token has an expiration time
          if (decodedPayload.exp) {
               // exp is in seconds, Date.now() is in milliseconds
               return decodedPayload.exp * 1000 < Date.now();
          }
          return false;
     } catch (error) {
          // If we can't decode the token, assume it's invalid
          deleteCookie("provider_auth_token");
          redirectToLogin();
          console.error("Error checking token expiration:", error);
          // If we can't decode the token, assume it's invalid
          return true;
     }
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
     const token = getToken();
     if (!token) return false;
     return !isTokenExpired(token);
};

// Redirect to login if not authenticated (client-side)
export const redirectIfUnauthenticated = (router: NextRouter): boolean => {
     if (typeof window !== "undefined" && !isAuthenticated()) {
          if (window.location.pathname !== "/register") {
               router.push("/login");
               return true;
          }
     }
     return false;
};

// For use in App Router (Next.js 13+)
export const requireAuth = () => {
     if (typeof window !== "undefined" && !isAuthenticated()) {
          if (window.location.pathname !== "/register") {
               redirect("/login");
          }
     }
};

// Parse login redirect URL to return to original page after login
export const getLoginRedirectUrl = (returnTo?: string): string => {
     const baseUrl = "/login";
     if (!returnTo) return baseUrl;

     return `${baseUrl}?returnTo=${encodeURIComponent(returnTo)}`;
};
