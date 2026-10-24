import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/** Sends visitors without a session back to the landing page's gate. */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-[#070707]" aria-busy="true" />;
  if (!user) return <Navigate to="/#gate" replace />;
  return <>{children}</>;
}
