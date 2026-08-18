export function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="loading-panel">
      <span className="loading-spinner" />
      <p className="loading-text">{label}</p>
    </div>
  );
}
