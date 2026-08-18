import { Button } from "../ui/Button";
import { Field, inputClassName } from "../ui/Field";
import { ar } from "../../locales/ar";
import type { PeriodPreset } from "../../api/client";

export type PeriodValue = {
  period: PeriodPreset;
  from: string;
  to: string;
};

const presets: PeriodPreset[] = ["today", "week", "month", "custom"];

export function defaultPeriod(): PeriodValue {
  const today = new Date();
  const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  return {
    period: "month",
    from: from.toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
  };
}

export function PeriodFilter({
  value,
  onChange,
}: {
  value: PeriodValue;
  onChange: (next: PeriodValue) => void;
}) {
  return (
    <div className="toolbar">
      <div className="page-actions">
        {presets.map((preset) => (
          <Button
            key={preset}
            variant={value.period === preset ? "primary" : "secondary"}
            onClick={() => onChange({ ...value, period: preset })}
          >
            {ar.period[preset]}
          </Button>
        ))}
      </div>
      {value.period === "custom" ? (
        <div className="toolbar">
          <Field label={ar.period.from}>
            <input
              className={inputClassName}
              type="date"
              value={value.from}
              onChange={(event) => onChange({ ...value, from: event.target.value })}
            />
          </Field>
          <Field label={ar.period.to}>
            <input
              className={inputClassName}
              type="date"
              value={value.to}
              onChange={(event) => onChange({ ...value, to: event.target.value })}
            />
          </Field>
        </div>
      ) : null}
    </div>
  );
}
