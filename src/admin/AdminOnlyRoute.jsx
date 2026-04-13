import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { isAdmin } from "../lib/authz.js";

export default function AdminOnlyRoute({ children }) {
  const { user } = useAuth();
  if (!isAdmin(user)) {
    return <Navigate to="/admin/customers" replace />;
  }
  return children;
}
