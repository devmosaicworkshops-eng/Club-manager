import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useEffect } from "react";

export function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: ("Admin" | "Coach" | "User")[];
}) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    } else if (
      !isLoading &&
      user &&
      allowedRoles &&
      !allowedRoles.includes(user.role as any)
    ) {
      // Redirect to their own dashboard
      if (user.role === "Admin") setLocation("/dashboard/admin");
      else if (user.role === "Coach") setLocation("/dashboard/coach");
      else setLocation("/dashboard/utilisateur");
    }
  }, [user, isLoading, allowedRoles, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || (allowedRoles && !allowedRoles.includes(user.role as any))) {
    return null;
  }

  return <>{children}</>;
}
