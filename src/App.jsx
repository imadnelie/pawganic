import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import MarketingSite from "./pages/MarketingSite.jsx";
import Login from "./pages/Login.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import AdminLayout from "./admin/AdminLayout.jsx";
import ProtectedRoute from "./admin/ProtectedRoute.jsx";
import AdminOnlyRoute from "./admin/AdminOnlyRoute.jsx";
import Dashboard from "./admin/pages/Dashboard.jsx";
import Customers from "./admin/pages/Customers.jsx";
import CustomerDetail from "./admin/pages/CustomerDetail.jsx";
import Orders from "./admin/pages/Orders.jsx";
import Expenses from "./admin/pages/Expenses.jsx";
import Balance from "./admin/pages/Balance.jsx";
import Users from "./admin/pages/Users.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<MarketingSite />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="customers" element={<Customers />} />
            <Route path="customers/:id" element={<CustomerDetail />} />
            <Route path="orders" element={<Orders />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="balance" element={<Balance />} />
            <Route
              path="users"
              element={
                <AdminOnlyRoute>
                  <Users />
                </AdminOnlyRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
