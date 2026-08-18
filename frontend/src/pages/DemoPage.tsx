import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { HeroBanner } from "../components/ui/HeroBanner";
import { Page } from "../components/ui/Page";
import { PageHeader } from "../components/ui/PageHeader";
import { ar } from "../locales/ar";

const storageKey = "jaafar-demo-steps";

const steps = [
  { to: "/", title: ar.demo.step1, hint: ar.demo.step1Hint },
  { to: "/invoices/upload", title: ar.demo.step2, hint: ar.demo.step2Hint },
  { to: "/invoices/review", title: ar.demo.step3, hint: ar.demo.step3Hint },
  { to: "/invoices/review", title: ar.demo.step4, hint: ar.demo.step4Hint },
  { to: "/invoices/review", title: ar.demo.step5, hint: ar.demo.step5Hint },
  { to: "/invoices/review", title: ar.demo.step6, hint: ar.demo.step6Hint },
  { to: "/invoices/review", title: ar.demo.step7, hint: ar.demo.step7Hint },
  { to: "/invoices", title: ar.demo.step8, hint: ar.demo.step8Hint },
  { to: "/stock", title: ar.demo.step9, hint: ar.demo.step9Hint },
  { to: "/cash", title: ar.demo.step10, hint: ar.demo.step10Hint },
  { to: "/reports/profit", title: ar.demo.step11, hint: ar.demo.step11Hint },
  { to: "/analytics", title: ar.demo.step12, hint: ar.demo.step12Hint },
  { to: "/analytics", title: ar.demo.step13, hint: ar.demo.step13Hint },
  { to: "/forecast", title: ar.demo.step14, hint: ar.demo.step14Hint },
  { to: "/forecast", title: ar.demo.step15, hint: ar.demo.step15Hint },
  { to: "/analytics", title: ar.demo.step16, hint: ar.demo.step16Hint },
];

export function DemoPage() {
  const [done, setDone] = useState<boolean[]>(() => steps.map(() => false));

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as boolean[];
      if (Array.isArray(parsed) && parsed.length === steps.length) {
        setDone(parsed);
      }
    } catch {
      sessionStorage.removeItem(storageKey);
    }
  }, []);

  function toggle(index: number) {
    const next = done.map((value, current) => (current === index ? !value : value));
    setDone(next);
    sessionStorage.setItem(storageKey, JSON.stringify(next));
  }

  function reset() {
    const next = steps.map(() => false);
    setDone(next);
    sessionStorage.removeItem(storageKey);
  }

  const completed = done.filter(Boolean).length;

  return (
    <Page>
      <PageHeader
        title={ar.demo.title}
        subtitle={ar.demo.subtitle}
        actions={
          <Button variant="secondary" onClick={reset}>
            {ar.demo.reset}
          </Button>
        }
      />

      <HeroBanner
        label={`${ar.demo.progress} ${completed} / ${steps.length}`}
        text={ar.demo.rule}
        actions={
          <div className="progress-track">
            {done.map((value, index) => (
              <span key={steps[index].title} className={value ? "progress-dot is-on" : "progress-dot"} />
            ))}
          </div>
        }
      />

      <div className="step-list">
        {steps.map((step, index) => (
          <article key={`${step.title}-${index}`} className={done[index] ? "step-card is-done" : "step-card"}>
            <div className="brand-row">
              <span className="step-index">{index + 1}</span>
              <div className="step-copy">
                <p className="muted">
                  {ar.demo.stepLabel} {index + 1}
                </p>
                <h3 className="card-title">{step.title}</h3>
                <p className="muted">{step.hint}</p>
                <Link to={step.to} className="link-quiet">
                  {ar.demo.open}
                </Link>
              </div>
            </div>
            <Button variant={done[index] ? "secondary" : "primary"} onClick={() => toggle(index)}>
              {done[index] ? ar.demo.done : ar.demo.markDone}
            </Button>
          </article>
        ))}
      </div>
    </Page>
  );
}
