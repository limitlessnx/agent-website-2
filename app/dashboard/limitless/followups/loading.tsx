export default function FollowupsLoading() {
  return (
    <div className="admin-page" aria-busy="true" aria-live="polite">
      <div className="admin-page-header">
        <div>
          <p className="admin-kicker">Limitless Realty</p>
          <h1>Follow-up Control</h1>
          <p>Loading customer follow-ups, consent states and manual drafts.</p>
        </div>
        <span className="admin-status warning">Loading</span>
      </div>
      <section className="admin-panel" role="status">
        <div className="admin-panel-header">
          <div>
            <h2>Preparing your follow-up workspace</h2>
            <p>Retrieving the latest records. This screen will update when the data is ready.</p>
          </div>
        </div>
        <div className="admin-metric-grid">
          {Array.from({ length: 4 }, (_, index) => (
            <article className="admin-metric-card" key={index}>
              <p>Loading metric</p>
              <strong aria-hidden="true">—</strong>
              <span>Waiting for live data</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
