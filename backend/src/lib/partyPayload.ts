import { asObject, optionalText, requiredText } from "./validation.js";

export type PartyPayload = {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
};

export function parsePartyPayload(body: unknown, label: string): PartyPayload {
  const data = asObject(body, `بيانات ${label} غير صالحة`);

  return {
    name: requiredText(data.name, `اسم ${label}`),
    phone: optionalText(data.phone),
    email: optionalText(data.email),
    address: optionalText(data.address),
    notes: optionalText(data.notes),
  };
}
