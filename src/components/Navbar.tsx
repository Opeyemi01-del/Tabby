// The top bar shown on the freelancer's pages.
// To add a page to the menu, add a line to the `links` list.
import Link from "next/link";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/deals/new", label: "New deal" },
  { href: "/disputes", label: "Disputes" },
];

export default function Navbar() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-xl font-bold text-brand-700">
          Tabby
        </Link>
        <div className="flex gap-1 text-sm font-medium">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
