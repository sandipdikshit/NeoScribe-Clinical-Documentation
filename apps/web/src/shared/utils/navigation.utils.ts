// Handle redirect to login page
export const redirectToLogin = () => {
     if (typeof window !== "undefined") {
          const currentPath = window.location.pathname;

          if (currentPath === "/login") {
               return; // Do not redirect if already on login page
          }

          // List of routes that should not be included in the return URL
          const excludedRoutes = [
               "/register",
               "/reset-password",
               "/reset-password",
          ];

          // Check if current path is in excluded routes
          const shouldIncludeReturnUrl = !excludedRoutes.some((route) =>
               currentPath.startsWith(route)
          );

          // Redirect with or without return URL based on the check
          window.location.href = shouldIncludeReturnUrl
               ? `/login?returnTo=${encodeURIComponent(currentPath)}`
               : "/login";
     }
};
