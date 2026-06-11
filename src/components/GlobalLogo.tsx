import { Link, useLocation } from "react-router-dom";

export const GlobalLogo = () => {
  const location = useLocation();
  // Avoid overlapping key screens
  if (location.pathname.startsWith('/play')) {
    return null;
  }
  return (
    <div className="fixed left-2 top-2 sm:left-4 sm:top-3 z-40 pointer-events-auto">
      <Link to="/" className="inline-flex items-center gap-2 rounded-xl border bg-white/80 backdrop-blur px-2.5 py-1.5 sm:px-3 sm:py-2 shadow hover:shadow-md transition">
        <img
          src="/gabits-logo.png"
          alt="Gabits"
          className="h-8 sm:h-10 w-auto object-contain drop-shadow-md"
          onError={(e) => {
            // graceful fallback to text if image not found
            const parent = (e.currentTarget.parentElement as HTMLElement);
            if (parent) {
              parent.innerHTML = '<span class="font-extrabold text-indigo-600 text-lg sm:text-xl">Gabits</span>';
            }
          }}
        />
      </Link>
    </div>
  );
}
