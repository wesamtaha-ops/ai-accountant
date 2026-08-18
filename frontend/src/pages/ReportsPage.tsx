import { Link } from "react-router-dom";
import { Page } from "../components/ui/Page";
import { PageHeader } from "../components/ui/PageHeader";
import { ar } from "../locales/ar";

const links = [
  { to: "/reports/sales", title: ar.reports.sales, subtitle: ar.reports.salesSubtitle },
  { to: "/reports/purchases", title: ar.reports.purchases, subtitle: ar.reports.purchasesSubtitle },
  { to: "/reports/profit", title: ar.reports.profit, subtitle: ar.reports.profitSubtitle },
  { to: "/forecast", title: ar.reports.forecast, subtitle: ar.reports.forecastSubtitle },
  { to: "/stock", title: ar.reports.stock, subtitle: ar.stock.subtitle },
  { to: "/cash", title: ar.reports.cash, subtitle: ar.cash.subtitle },
];

export function ReportsPage() {
  return (
    <Page>
      <PageHeader title={ar.reports.title} subtitle={ar.reports.subtitle} />
      <div className="choice-grid">
        {links.map((link) => (
          <Link key={link.to} to={link.to} className="choice-card">
            <h3 className="card-title">{link.title}</h3>
            <p className="muted">{link.subtitle}</p>
          </Link>
        ))}
      </div>
    </Page>
  );
}
