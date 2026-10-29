const foundationItems = [
  {
    label: 'Money model',
    detail: 'Euro amounts use exact minor units.',
    status: 'READY',
    tone: 'ready',
  },
  {
    label: 'Mock Bank',
    detail: 'A deterministic, pending-only simulation.',
    status: 'SIMULATED',
    tone: 'simulated',
  },
  {
    label: 'Payment flows',
    detail: 'No account connection or money movement.',
    status: 'DISABLED',
    tone: 'disabled',
  },
] as const;

export default function Home() {
  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="KLIKS home">
          <span className="brand-mark" aria-hidden="true">
            k
          </span>
          <span className="brand-name">
            KLIKS<span>.</span>
          </span>
        </a>
        <div className="topbar-meta">
          <span className="locale-label">
            KOSOVO <span>/</span> EUR
          </span>
          <span className="preview-label">
            <span aria-hidden="true" /> PRIVATE PREVIEW
          </span>
        </div>
      </header>

      <section className="hero" aria-labelledby="page-title">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="eyebrow-mark" /> THE SIMPLE WAY TO PAY
          </p>
          <h1 id="page-title">
            Pay the person.
            <br />
            <span>Skip the bank form.</span>
          </h1>
          <p className="hero-description">
            KLIKS is building a simpler way to pay anyone, using the bank you already have.
          </p>
          <p className="hero-slogan">Veç kliko. U kry.</p>
        </div>

        <figure className="flow-visual" aria-labelledby="flow-caption">
          <div className="flow-heading">
            <span>THE FUTURE FLOW</span>
            <span className="concept-label">CONCEPT ONLY</span>
          </div>
          <ol className="flow-list">
            <li>
              <span className="flow-index">01</span>
              <span>
                <strong>Find your person</strong>
                <small>Verified identity</small>
              </span>
            </li>
            <li>
              <span className="flow-index">02</span>
              <span>
                <strong>Check the details</strong>
                <small>Recipient + amount</small>
              </span>
            </li>
            <li>
              <span className="flow-index">03</span>
              <span>
                <strong>Authorize with your bank</strong>
                <small>Nothing held by KLIKS</small>
              </span>
            </li>
          </ol>
          <figcaption id="flow-caption">Not active in this preview.</figcaption>
        </figure>
      </section>

      <section className="simulation-notice" aria-label="Simulation notice">
        <span className="notice-symbol" aria-hidden="true">
          !
        </span>
        <div className="notice-copy">
          <strong>Nothing moves in this preview.</strong>
          <p>Payments are disabled. Mock Bank is for development tests only.</p>
        </div>
        <span className="notice-stamp">SIMULATION ONLY</span>
      </section>

      <section className="foundation-section" aria-labelledby="foundation-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE FOUNDATION</p>
            <h2 id="foundation-title">What’s real right now</h2>
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

        <ul className="foundation-list">
          {foundationItems.map((item, index) => (
            <li className="foundation-row" key={item.label}>
              <span className="row-index">0{index + 1}</span>
              <span className="row-main">
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </span>
              <span className={`row-status ${item.tone}`}>
                <span aria-hidden="true" />
                {item.status}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="footer">
        <span>KLIKS never holds your balance.</span>
        <span>
          Built for Kosovo <span className="footer-dot">·</span> EUR
        </span>
      </footer>
    </main>
  );
}
