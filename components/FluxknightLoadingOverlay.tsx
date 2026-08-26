"use client";

export default function FluxknightLoadingOverlay({ visible = false }: { visible?: boolean }) {
  if (!visible) return null;

  return (
    <div
      role="status"
      aria-label="Loading"
      className="flux-global-loading"
    >
      <span className="flux-loading-core" aria-hidden="true" />
    </div>
  );
}
