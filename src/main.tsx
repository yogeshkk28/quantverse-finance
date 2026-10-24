import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import RequireAuth from "./app/RequireAuth";
import ErrorBoundary from "./app/ErrorBoundary";
import "./index.css";

// Separate chunks: terminal users never download the landing animations, and vice versa.
const LandingPage = lazy(() => import("./landing/LandingPage"));
const App = lazy(() => import("./App"));
const PrivacyPage = lazy(() => import("./landing/PrivacyPage"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <ErrorBoundary>
          <Suspense fallback={<div className="min-h-screen bg-black" />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route
                path="/app/:tab?"
                element={
                  <RequireAuth>
                    <App />
                  </RequireAuth>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
