import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ar } from "../locales/ar";

const groups = [
  {
    title: ar.nav.groupWork,
    links: [
      { to: "/", label: ar.nav.dashboard, icon: "home" },
      { to: "/invoices", label: ar.nav.invoices, icon: "invoice" },
      { to: "/products", label: ar.nav.products, icon: "box" },
      { to: "/stock", label: ar.nav.stock, icon: "stock" },
      { to: "/customers", label: ar.nav.customers, icon: "users" },
      { to: "/suppliers", label: ar.nav.suppliers, icon: "truck" },
      { to: "/cash", label: ar.nav.cash, icon: "cash" },
    ],
  },
  {
    title: ar.nav.groupInsight,
    links: [
      { to: "/reports", label: ar.nav.reports, icon: "chart" },
      { to: "/analytics", label: ar.nav.analytics, icon: "spark" },
      { to: "/forecast", label: ar.nav.forecast, icon: "trend" },
      { to: "/demo", label: ar.nav.demo, icon: "help" },
    ],
  },
  {
    title: ar.nav.groupSystem,
    links: [{ to: "/settings", label: ar.nav.settings, icon: "gear" }],
  },
];

export function AppLayout() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle("menu-open", menuOpen);
    return () => document.body.classList.remove("menu-open");
  }, [menuOpen]);

  return (
    <div className={menuOpen ? "app-shell is-menu-open" : "app-shell"}>
      <header className="topbar">
        <button type="button" className="menu-button" onClick={() => setMenuOpen(true)}>
          <MenuIcon />
          <span>{ar.layout.openMenu}</span>
        </button>
        <div className="brand-row">
          <span className="brand-mark">{ar.layout.shortName[0]}</span>
          <p className="topbar-title">{ar.appName}</p>
        </div>
      </header>

      <button type="button" className="sidebar-backdrop" onClick={() => setMenuOpen(false)}>
        {ar.layout.closeMenu}
      </button>

      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-row">
            <span className="brand-mark">{ar.layout.shortName[0]}</span>
            <div className="brand-copy">
              <p className="brand-phase">{ar.phaseBadge}</p>
              <h1 className="brand-name">{ar.appName}</h1>
            </div>
            <button type="button" className="sidebar-close" onClick={() => setMenuOpen(false)}>
              {ar.layout.closeMenu}
            </button>
          </div>
          <p className="sidebar-rule">{ar.layout.rule}</p>
        </div>
        <nav className="sidebar-nav">
          {groups.map((group) => (
            <div key={group.title} className="nav-group">
              <p className="nav-group-title">{group.title}</p>
              {group.links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === "/"}
                  className={({ isActive }) => (isActive ? "nav-link is-active" : "nav-link")}
                >
                  <NavIcon name={link.icon} />
                  {link.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function NavIcon({ name }: { name: string }) {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      {iconPath(name)}
    </svg>
  );
}

function iconPath(name: string) {
  switch (name) {
    case "home":
      return <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />;
    case "invoice":
      return <path d="M7 3.5h10a1 1 0 0 1 1 1V20l-3-1.5-3 1.5-3-1.5-3 1.5V4.5a1 1 0 0 1 1-1zm3 5h4M10 13h4" />;
    case "box":
      return <path d="M4 8 12 4l8 4-8 4-8-4zm0 0v8l8 4 8-4V8M12 12v8" />;
    case "stock":
      return <path d="M4 19V9m5 10V5m5 14v-7m5 7V8" />;
    case "users":
      return <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8-1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM4 19a5 5 0 0 1 10 0m3-2a4 4 0 0 1 4 3" />;
    case "truck":
      return <path d="M3 7h11v9H3zm11 3h4l3 3v3h-7zM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />;
    case "cash":
      return <path d="M4 7h16v10H4zm3 5h10M12 9v6" />;
    case "chart":
      return <path d="M4 19h16M7 16V9m5 7V6m5 10v-4" />;
    case "spark":
      return <path d="M12 3 9.5 9.5 3 12l6.5 2.5L12 21l2.5-6.5L21 12l-6.5-2.5z" />;
    case "trend":
      return <path d="M4 16 10 10l4 4 6-8M14 6h6v6" />;
    case "help":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.5a2.5 2.5 0 1 1 3.2 2.4c-.8.4-1.2.9-1.2 1.8V14" />
          <path d="M12 17h.01" />
        </>
      );
    default:
      return <path d="M6 8h12M6 12h12M6 16h8" />;
  }
}
