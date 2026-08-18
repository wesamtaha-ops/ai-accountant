import { api } from "../api/client";
import { ar } from "../locales/ar";
import { PartyManager } from "./parties/PartyManager";

export function SuppliersPage() {
  return (
    <PartyManager
      title={ar.parties.suppliersTitle}
      subtitle={ar.parties.suppliersSubtitle}
      addLabel={ar.parties.addSupplier}
      editLabel={ar.parties.editSupplier}
      load={api.suppliers}
      create={api.createSupplier}
      update={api.updateSupplier}
      remove={api.deleteSupplier}
    />
  );
}
