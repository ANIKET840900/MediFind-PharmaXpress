import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Home from "./pages/Home";
import Search from "./pages/Search";
import Cart from "./pages/Cart";
import Profile from "./pages/Profile";
import ShopRegister from "./pages/ShopRegister";
import Orders from "./pages/Orders";
import MyMedicines from "./pages/MyMedicines";
import Wishlist from "./pages/Wishlist";
import MedicineDetails from "./pages/MedicineDetails";
import Notifications from "./pages/Notifications";
import SellerOperations from "./pages/SellerOperations";
import Payments from "./pages/Payments";
import PaymentsOps from "./pages/PaymentsOps";
import ForgotUsername from "./pages/ForgotUsername";
import ForgotPassword from "./pages/ForgotPassword";
import { getAuthToken } from "./api";
import "./styles.css";

function RequireAuth({ children }) {
  if (!getAuthToken()) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AppShell() {
  const location = useLocation();
  const hideNavbarRoutes = ["/login", "/signup", "/forgot-username", "/forgot-password"];
  const isAuthPage = hideNavbarRoutes.some(
    (route) => location.pathname === route || location.pathname.startsWith(`${route}/`)
  ) || location.pathname.startsWith("/auth/");
  const isLoggedIn = Boolean(getAuthToken());
  const showNavbar = isLoggedIn && !isAuthPage;

  return (
    <>
      {showNavbar && <Navbar />}
      <Routes>
        <Route path="/" element={<Navigate to={getAuthToken() ? "/home" : "/login"} replace />} />
        <Route path="/home" element={<RequireAuth><Home /></RequireAuth>} />
        <Route path="/search" element={<RequireAuth><Search /></RequireAuth>} />
        <Route path="/cart" element={<RequireAuth><Cart /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/shop-register" element={<RequireAuth><ShopRegister /></RequireAuth>} />
        <Route path="/my-medicines" element={<RequireAuth><MyMedicines /></RequireAuth>} />
        <Route path="/wishlist" element={<RequireAuth><Wishlist /></RequireAuth>} />
        <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
        <Route path="/payments" element={<RequireAuth><Payments /></RequireAuth>} />
        <Route path="/payments-ops" element={<RequireAuth><PaymentsOps /></RequireAuth>} />
        <Route path="/seller-ops" element={<RequireAuth><SellerOperations /></RequireAuth>} />
        <Route path="/medicine/:id" element={<RequireAuth><MedicineDetails /></RequireAuth>} />
        <Route path="/orders" element={<RequireAuth><Orders /></RequireAuth>} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-username" element={<ForgotUsername />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="*" element={<Navigate to={getAuthToken() ? "/home" : "/login"} replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppShell />
    </BrowserRouter>
  );
}