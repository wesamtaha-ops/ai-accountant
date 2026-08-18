import { api } from "../api/client";
import { ar } from "../locales/ar";
import { PartyManager } from "./parties/PartyManager";

export function CustomersPage() {
  return (
    <PartyManager
      title={ar.parties.customersTitle}
      subtitle={ar.parties.customersSubtitle}
      addLabel={ar.parties.addCustomer}
      editLabel={ar.parties.editCustomer}
      load={api.customers}
      create={api.createCustomer}
      update={api.updateCustomer}
      remove={api.deleteCustomer}
    />
  );
}
