import { Link } from "react-router-dom";

export const GlobalLogo = () => {
  return (
    <div className="fixed left-4 top-3 z-50">
      <Link to="/" className="inline-flex items-center gap-2 rounded-xl border bg-white/80 backdrop-blur px-3 py-2 shadow hover:shadow-md transition">
        <img
          src="/gabits-logo.png"
          alt="Gabits"
          className="h-12 w-auto object-contain"
          onError={(e) => {
            // graceful fallback to text if image not found
            const parent = (e.currentTarget.parentElement as HTMLElement);
            if (parent) {
              parent.innerHTML = '<span class="font-extrabold text-indigo-600 text-xl">Gabits</span>';
            }
          }}
        />
      </Link>
    </div>
  );
}
