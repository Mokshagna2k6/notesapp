"use client";

import { useEffect } from "react";
import AuthProvider, { useAuth } from "@/components/AuthProvider";
import LoginPage from "@/components/LoginPage";
import Dashboard from "@/components/Dashboard";

function AppContent() {
  useEffect(() => {
    try {
      const theme = localStorage.getItem("excalidraw-theme") || "dark";
      document.documentElement.setAttribute("data-theme", theme);
    } catch {}
  }, []);
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2"
          style={{ borderColor: "var(--accent)" }}
        />
      </div>
    );
  }

  if (!user) return <LoginPage />;
  return <Dashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
