import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import AccessDenied from "./AccessDenied";

const ProtectedRoute = ({
  children,
  requiredRoles = [],
  requireAuth = false,
}) => {
  const { user, hasRole, loading } = useAuth();

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-ocean-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-ocean-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If authentication is required but user is not logged in
  if (requireAuth && !user) {
    return <Navigate to="/login" replace />;
  }

  // If user is logged in but doesn't have required role
  if (user && requiredRoles.length > 0 && !hasRole(requiredRoles)) {
    return <AccessDenied />;
  }

  // If no authentication required or user has proper access
  return children;
};

export default ProtectedRoute;
