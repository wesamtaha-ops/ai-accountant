type AlertProps = {
  tone?: "ok" | "error" | "warn" | "info";
  children: string;
};

const tones = {
  ok: "alert-ok",
  error: "alert-error",
  warn: "alert-warn",
  info: "alert-info",
};

export function Alert({ tone = "info", children }: AlertProps) {
  return <p className={`alert ${tones[tone]}`}>{children}</p>;
}
