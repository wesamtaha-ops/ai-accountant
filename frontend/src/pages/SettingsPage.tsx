import { useEffect, useState, type FormEvent } from "react";
import { api, type Settings } from "../api/client";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Field, inputClassName } from "../components/ui/Field";
import { Page } from "../components/ui/Page";
import { PageHeader } from "../components/ui/PageHeader";
import { ar } from "../locales/ar";

export function SettingsPage() {
  const [form, setForm] = useState<Settings | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .settings()
      .then(setForm)
      .catch(() => setError(ar.dashboard.disconnected));
  }, []);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form) {
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const saved = await api.updateSettings(form);
      setForm(saved);
      setNotice(ar.settings.saved);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : ar.dashboard.disconnected);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page>
      <PageHeader title={ar.settings.title} subtitle={ar.settings.subtitle} />

      {form ? (
        <form className="list-stack" onSubmit={handleSubmit}>
          <Card title={ar.settings.company}>
            <div className="form-grid">
              <Field label={ar.settings.companyName}>
                <input
                  className={inputClassName}
                  value={form.companyName}
                  onChange={(event) => update("companyName", event.target.value)}
                  required
                />
              </Field>
              <Field label={ar.settings.currency}>
                <input
                  className={inputClassName}
                  value={form.currency}
                  onChange={(event) => update("currency", event.target.value)}
                  required
                />
              </Field>
            </div>
            <p className="muted">{ar.settings.currencyHelp}</p>
          </Card>

          <Card title={ar.settings.prices}>
            <div className="form-grid">
              <Field label={ar.settings.tolerance}>
                <input
                  className={inputClassName}
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.priceTolerancePercent}
                  onChange={(event) => update("priceTolerancePercent", Number(event.target.value))}
                  required
                />
              </Field>
              <Field label={ar.settings.tax}>
                <input
                  className={inputClassName}
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.defaultTaxPercent}
                  onChange={(event) => update("defaultTaxPercent", Number(event.target.value))}
                  required
                />
              </Field>
              <Field label={ar.settings.openingCash}>
                <input
                  className={inputClassName}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.openingCashBalance}
                  onChange={(event) => update("openingCashBalance", Number(event.target.value))}
                  required
                />
              </Field>
            </div>
            <p className="muted">{ar.settings.toleranceHelp}</p>
            <div className="alert alert-warn">
              <p className="card-title">{ar.settings.exampleTitle}</p>
              <p>{ar.settings.exampleText}</p>
            </div>
          </Card>

          {notice ? <Alert tone="ok">{notice}</Alert> : null}
          {error ? <Alert tone="error">{error}</Alert> : null}

          <div className="page-actions">
            <Button type="submit" disabled={saving}>
              {ar.common.save}
            </Button>
          </div>
        </form>
      ) : (
        <p className="muted">{ar.common.loading}</p>
      )}
    </Page>
  );
}
