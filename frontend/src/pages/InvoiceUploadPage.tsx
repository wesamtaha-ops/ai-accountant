import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type InvoiceReadInput } from "../api/client";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Page } from "../components/ui/Page";
import { PageHeader } from "../components/ui/PageHeader";
import { storeReadResult } from "../lib/invoiceReadStore";
import { ar } from "../locales/ar";

const demos: Array<{ scenario: InvoiceReadInput["scenario"]; title: string; hint: string }> = [
  { scenario: "demo", title: ar.invoices.demoError, hint: ar.invoices.demoErrorHint },
  { scenario: "clean", title: ar.invoices.demoClean, hint: ar.invoices.demoCleanHint },
  { scenario: "duplicate", title: ar.invoices.demoDuplicate, hint: ar.invoices.demoDuplicateHint },
];

export function InvoiceUploadPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);

  async function startRead(payload: InvoiceReadInput) {
    setReading(true);
    setError("");
    try {
      const result = await api.readInvoice(payload);
      storeReadResult(result);
      navigate("/invoices/review");
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : ar.dashboard.disconnected);
    } finally {
      setReading(false);
    }
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    const contentBase64 = await fileToBase64(file);
    await startRead({
      fileName: file.name,
      mimeType: file.type,
      contentBase64,
    });
  }

  return (
    <Page>
      <PageHeader
        title={ar.invoices.uploadTitle}
        subtitle={ar.invoices.uploadSubtitle}
        actions={
          <Button variant="ghost" onClick={() => navigate("/invoices")}>
            {ar.common.back}
          </Button>
        }
      />

      {reading ? <Alert tone="info">{ar.invoices.reading}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <article className="dropzone">
        <input
          ref={inputRef}
          className="hidden"
          type="file"
          accept="image/*,.pdf,application/pdf"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              handleFile(file).catch(() => setError(ar.dashboard.disconnected));
            }
          }}
        />
        <p className="card-title">{ar.invoices.chooseFile}</p>
        <p className="muted">{ar.invoices.uploadHint}</p>
        <Button onClick={() => inputRef.current?.click()} disabled={reading}>
          {ar.invoices.chooseFile}
        </Button>
        {fileName ? <p className="muted">{fileName}</p> : null}
      </article>

      <div className="list-stack">
        <p className="page-eyebrow">{ar.invoices.demoSection}</p>
        <div className="choice-grid">
          {demos.map((demo) => (
            <button
              key={demo.scenario}
              type="button"
              disabled={reading}
              className={demo.scenario === "demo" ? "choice-card is-recommended" : "choice-card"}
              onClick={() => startRead({ scenario: demo.scenario })}
            >
              {demo.scenario === "demo" ? <Badge tone="ok">{ar.common.recommended}</Badge> : null}
              <h3 className="card-title">{demo.title}</h3>
              <p className="muted">{demo.hint}</p>
            </button>
          ))}
        </div>
      </div>
    </Page>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
