'use client'

import Image from 'next/image'

export default function DataDeletion() {
  return (
    <>
      {/* NAV */}
      <nav>
        <a href="/" className="nav-logo" style={{ textDecoration: 'none' }}>
          <Image src="/logo-transparent.png" alt="Saarthi" width={72} height={72} style={{ objectFit: 'contain' }} />
          <div>
            <div className="nav-logo-text">Saar<span>thi</span></div>
            <div className="nav-logo-hi">सारथी</div>
          </div>
        </a>
        <div className="nav-links">
          <a href="/#what">What it is</a>
          <a href="/#how">How it works</a>
          <a href="/#brokers">For brokers</a>
          <a href="/#cities">Cities</a>
        </div>
        <a href="/#cta" className="nav-cta">WhatsApp us →</a>
      </nav>

      {/* CONTENT */}
      <div className="legal-page">
        <div className="legal-container">
          <h1 className="legal-title">Data Deletion Request</h1>
          <p className="legal-updated">Your data, your choice</p>

          <div className="legal-section">
            <p>At Saarthi, we respect your privacy and your right to control your personal data. You can request deletion of all data we hold about you at any time.</p>
          </div>

          <div className="legal-section">
            <h2>What data do we store?</h2>
            <p>When you interact with Saarthi through WhatsApp, we may collect and store the following information:</p>
            <ul>
              <li>Your WhatsApp phone number and display name</li>
              <li>Messages and conversations with Saarthi</li>
              <li>Property search preferences (budget, location, requirements)</li>
              <li>Shortlisted properties and visit history</li>
              <li>Deal progress and transaction-related notes</li>
            </ul>
          </div>

          <div className="legal-section">
            <h2>How to request data deletion</h2>
            <p>You can request deletion of your data through any of the following methods:</p>

            <div className="deletion-methods">
              <div className="deletion-card">
                <div className="deletion-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 5.5C3 14.06 9.94 21 18.5 21c.386 0 .77-.014 1.148-.042.435-.032.653-.048.851-.162a1.67 1.67 0 00.565-.567c.112-.197.128-.416.16-.851l.247-3.166c.03-.385.046-.578-.012-.747a1 1 0 00-.36-.479c-.144-.108-.33-.157-.702-.255l-2.943-.736c-.402-.1-.603-.151-.787-.116a1 1 0 00-.536.305c-.128.144-.192.337-.32.724l-.547 1.64a13.045 13.045 0 01-6.328-6.328l1.64-.546c.387-.129.58-.193.724-.321a1 1 0 00.305-.536c.035-.184-.016-.385-.116-.787l-.736-2.943c-.098-.372-.147-.558-.255-.702a1 1 0 00-.479-.36C9.623 3.046 9.43 3.062 9.044 3.09L5.879 3.34c-.435.031-.653.047-.851.16a1.67 1.67 0 00-.567.564c-.114.199-.13.418-.162.852z" stroke="#C8601A" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                </div>
                <div>
                  <div className="deletion-title">WhatsApp</div>
                  <div className="deletion-body">Send a message saying <strong>&quot;Delete my data&quot;</strong> to our WhatsApp number <a href="https://wa.me/919826078459">+91 98260 78459</a></div>
                </div>
              </div>

              <div className="deletion-card">
                <div className="deletion-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M2 6a2 2 0 012-2h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" stroke="#C8601A" strokeWidth="1.5" /><path d="M2 6l10 7 10-7" stroke="#C8601A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div>
                  <div className="deletion-title">Email</div>
                  <div className="deletion-body">Send an email to <a href="mailto:hello@saarthi.ai">hello@saarthi.ai</a> with the subject line <strong>&quot;Data Deletion Request&quot;</strong> and include your registered phone number.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="legal-section">
            <h2>What happens after you request deletion?</h2>
            <ul>
              <li>We will verify your identity using your WhatsApp number or email.</li>
              <li>All your personal data will be permanently deleted from our systems within <strong>30 days</strong> of the request.</li>
              <li>You will receive a confirmation once the deletion is complete.</li>
              <li>Any active deals or ongoing conversations will be terminated.</li>
            </ul>
          </div>

          <div className="legal-section">
            <h2>What data is retained?</h2>
            <p>After deletion, we may retain the following in anonymised form for analytics and service improvement purposes:</p>
            <ul>
              <li>Aggregated, non-identifiable usage statistics</li>
              <li>Market data and property information (not linked to you)</li>
            </ul>
            <p>No personally identifiable information will be retained after a deletion request is processed.</p>
          </div>

          <div className="legal-section">
            <h2>Third-party data</h2>
            <p>Saarthi operates on WhatsApp&apos;s platform. Messages stored by WhatsApp on your device or their servers are governed by <a href="https://www.whatsapp.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">WhatsApp&apos;s Privacy Policy</a>. Our deletion process covers only the data stored on Saarthi&apos;s systems.</p>
          </div>

          <div className="legal-section">
            <h2>Questions?</h2>
            <p>If you have any questions about your data or this process, reach out to us at <a href="mailto:hello@saarthi.ai">hello@saarthi.ai</a>.</p>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer>
        <div className="footer-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/logo-transparent.png" alt="Saarthi" width={64} height={64} style={{ objectFit: 'contain' }} />
            <div>
              <div className="footer-logo">Saar<span>thi</span> · सारथी</div>
              <div className="footer-tagline" style={{ marginTop: '6px' }}>Har saude mein saath.</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '3rem', flexWrap: 'wrap' as const }}>
            <a href="/#what" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>What it is</a>
            <a href="/#how" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>How it works</a>
            <a href="/#brokers" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>For brokers</a>
            <a href="/#cities" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>Cities</a>
            <a href="/privacy-policy" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>Privacy Policy</a>
            <a href="/data-deletion" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>Data Deletion</a>
          </div>
          <div className="footer-meta">© 2025 Saarthi AI · Indore, India</div>
        </div>
      </footer>
    </>
  )
}
