import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function AdminOnlyRoute({ children }) {
  const { user } = useAuth();
  const isSuperAdmin =
    String(user?.username || "").toLowerCase() === "elie" && user?.role === "admin";
  if (!isSuperAdmin) {
    return <Navigate to="/admin" replace />;
  }
  return children;
}
