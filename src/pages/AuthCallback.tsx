import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(window.location.search);
      if (error) {
        setError(error.message);
      } else {
        navigate("/", { replace: true });
      }
    };
    run();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-lg font-semibold">Completing sign-in...</p>
        {error && (
          <p className="mt-2 text-red-600">{error}</p>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
