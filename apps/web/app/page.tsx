const capabilities = [
  { label: 'Payment initiation', status: 'Disabled', tone: 'muted' },
  { label: 'Connected accounts', status: 'Not available', tone: 'muted' },
  { label: 'Mock connector', status: 'Pending-only', tone: 'simulated' },
] as const;

export default function Home() {
  return (
    <main className="workspace">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="KLIKS foundation home">
          KLIKS<span className="wordmark-dot">.</span>
        </a>
        <div className="environment-label">
          <span className="environment-mark" aria-hidden="true" />
          DEVELOPMENT ENVIRONMENT
        </div>
      </header>

      <section className="intro" aria-labelledby="page-title">
        <p className="eyebrow">PHASE 01 / FOUNDATION</p>
        <h1 id="page-title">The payment layer starts here.</h1>
        <p className="intro-copy">
          KLIKS is building a simpler way to pay people and businesses from the bank accounts they
          already use.
        </p>
      </section>

      <section className="simulation-notice" aria-label="Simulation notice">
        <span className="notice-symbol" aria-hidden="true">
          !
        </span>
        <div>
          <strong>Simulation only</strong>
          <p>No payment has been made. Real banking and payment flows are not enabled.</p>
        </div>
        <span className="notice-tag">NO MONEY MOVES</span>
      </section>

      <section className="capability-section" aria-labelledby="capability-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">SYSTEM BOUNDARIES</p>
            <h2 id="capability-title">What is available</h2>
          </div>
          <a
            className="docs-link"
            href="http://localhost:3001/docs"
            target="_blank"
            rel="noreferrer"
          >
            API reference <span aria-hidden="true">↗</span>
          </a>
        </div>

        <ul className="capability-list">
          {capabilities.map((capability, index) => (
            <li className="capability-row" key={capability.label}>
              <span className="row-index">0{index + 1}</span>
              <span className="capability-name">{capability.label}</span>
              <span className={`capability-status ${capability.tone}`}>
                <span aria-hidden="true" />
                {capability.status}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="footer">
        <span>Veç kliko. U kry.</span>
        <span>Kosovo · EUR</span>
      </footer>
    </main>
  );
}
