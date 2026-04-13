import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { isAdminOrStaff } from "../lib/authz.js";

/** Dashboard, orders, expenses, balance — admin or staff (`user`). */
export default function AdminOrStaffRoute({ children }) {
  const { user } = useAuth();
  if (!isAdminOrStaff(user)) {
    return <Navigate to="/admin/customers" replace />;
  }
  return children;
}
