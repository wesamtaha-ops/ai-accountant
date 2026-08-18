import { useEffect, useState } from "react";
import type { Party, PartyInput } from "../../api/client";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Field, inputClassName } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { Page } from "../../components/ui/Page";
import { PageHeader } from "../../components/ui/PageHeader";
import { ar } from "../../locales/ar";

type PartyManagerProps = {
  title: string;
  subtitle: string;
  addLabel: string;
  editLabel: string;
  load: () => Promise<Party[]>;
  create: (payload: PartyInput) => Promise<Party>;
  update: (id: string, payload: PartyInput) => Promise<Party>;
  remove: (id: string) => Promise<void>;
};

const emptyForm: PartyInput = {
  name: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

export function PartyManager({
  title,
  subtitle,
  addLabel,
  editLabel,
  load,
  create,
  update,
  remove,
}: PartyManagerProps) {
  const [rows, setRows] = useState<Party[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Party | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<PartyInput>(emptyForm);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setRows(await load());
  }

  useEffect(() => {
    refresh().catch(() => setError(ar.dashboard.disconnected));
  }, []);

  function openCreate() {
    setForm(emptyForm);
    setCreating(true);
    setEditing(null);
  }

  function openEdit(party: Party) {
    setForm({
      name: party.name,
      phone: party.phone ?? "",
      email: party.email ?? "",
      address: party.address ?? "",
      notes: party.notes ?? "",
    });
    setEditing(party);
    setCreating(false);
  }

  function closeModal() {
    setCreating(false);
    setEditing(null);
  }

  async function handleSubmit() {
    setSaving(true);
    setError("");

    try {
      if (editing) {
        await update(editing.id, form);
      } else {
        await create(form);
      }
      setNotice(ar.parties.saved);
      closeModal();
      await refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : ar.dashboard.disconnected);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(party: Party) {
    if (!window.confirm(ar.common.confirmDelete)) {
      return;
    }

    try {
      await remove(party.id);
      setNotice(ar.parties.deleted);
      await refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : ar.dashboard.disconnected);
    }
  }

  const filtered = rows.filter((party) => party.name.includes(query.trim()) || (party.phone ?? "").includes(query.trim()));

  return (
    <Page>
      <PageHeader title={title} subtitle={subtitle} actions={<Button onClick={openCreate}>{addLabel}</Button>} />

      <div className="toolbar">
        <input
          className={inputClassName}
          placeholder={ar.common.search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {notice ? <Alert tone="ok">{notice}</Alert> : null}
      {error && !creating && !editing ? <Alert tone="error">{error}</Alert> : null}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{ar.common.name}</th>
              <th>{ar.common.phone}</th>
              <th>{ar.common.email}</th>
              <th>{ar.common.address}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td className="empty-cell" colSpan={5}>
                  {ar.common.empty}
                </td>
              </tr>
            ) : null}
            {filtered.map((party) => (
              <tr key={party.id}>
                <td>{party.name}</td>
                <td>{party.phone}</td>
                <td>{party.email}</td>
                <td>{party.address}</td>
                <td>
                  <div className="page-actions">
                    <Button variant="secondary" onClick={() => openEdit(party)}>
                      {ar.common.edit}
                    </Button>
                    <Button variant="ghost" onClick={() => handleDelete(party)}>
                      {ar.common.delete}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating || editing ? (
        <Modal title={editing ? editLabel : addLabel} onClose={closeModal}>
          <div className="list-stack">
            <Field label={ar.common.name}>
              <input className={inputClassName} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </Field>
            <div className="form-grid">
              <Field label={ar.common.phone}>
                <input className={inputClassName} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              </Field>
              <Field label={ar.common.email}>
                <input className={inputClassName} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              </Field>
            </div>
            <Field label={ar.common.address}>
              <input className={inputClassName} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
            </Field>
            <Field label={ar.common.notes}>
              <input className={inputClassName} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </Field>
            {error ? <Alert tone="error">{error}</Alert> : null}
            <div className="page-actions">
              <Button variant="ghost" onClick={closeModal}>
                {ar.common.cancel}
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {ar.common.save}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </Page>
  );
}
