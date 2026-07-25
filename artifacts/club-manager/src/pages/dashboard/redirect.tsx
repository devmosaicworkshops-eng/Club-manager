import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect } from "react";

export default function RedirectDashboard() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (user?.role === "Admin") setLocation("/dashboard/admin");
      else if (user?.role === "Coach") setLocation("/dashboard/coach");
      else if (user?.role === "User") setLocation("/dashboard/utilisateur");
      else setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}
