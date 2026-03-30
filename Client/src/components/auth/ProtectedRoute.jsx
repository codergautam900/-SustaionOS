import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../../context/auth-context";

const ProtectedRoute = ({ children }) => {

  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 px-6 py-10 text-white">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-sm font-medium text-slate-200">
          Restoring your workspace session...
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
