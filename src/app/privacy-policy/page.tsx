import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'Privacy Policy — Saarthi',
  description: 'Privacy Policy for Saarthi AI — how we collect, use, and protect your data.',
}

export default function PrivacyPolicy() {
  return (
    <>
      <nav>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <Image src="/logo-transparent.png" alt="Saarthi" width={72} height={72} style={{ objectFit: 'contain' }} />
          <span className="nav-logo">Saar<span>thi</span></span>
        </Link>
        <div className="nav-links">
          <Link href="/#what">What it is</Link>
          <Link href="/#how">How it works</Link>
          <Link href="/#brokers">For brokers</Link>
          <Link href="/#cities">Cities</Link>
        </div>
        <a href="https://wa.me/919826078459" className="nav-cta">Start on WhatsApp</a>
      </nav>

      <main className="legal-page">
        <div className="legal-container">
          <h1 className="legal-title">Privacy Policy</h1>
          <p className="legal-updated">Last updated: 7 April 2026</p>

          <section className="legal-section">
            <h2>1. Introduction</h2>
            <p>
              Saarthi AI (&quot;Saarthi&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates an AI-powered property guide service accessible via WhatsApp and our website at saarthi.ai. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you interact with our services.
            </p>
            <p>
              By using Saarthi, you agree to the collection and use of information in accordance with this policy. If you do not agree, please discontinue use of our services.
            </p>
          </section>

          <section className="legal-section">
            <h2>2. Information We Collect</h2>
            <h3>2.1 Information You Provide</h3>
            <ul>
              <li><strong>Contact information:</strong> Your phone number and name as shared via WhatsApp.</li>
              <li><strong>Property preferences:</strong> Location, budget, property type, and other search criteria you share during conversations.</li>
              <li><strong>Broker details:</strong> If you are a real estate broker, we may collect your business name, RERA registration number, and listing information.</li>
            </ul>

            <h3>2.2 Information Collected Automatically</h3>
            <ul>
              <li><strong>Usage data:</strong> Interaction patterns, conversation timestamps, and feature usage within WhatsApp.</li>
              <li><strong>Device information:</strong> Device type, operating system, and browser type when you visit our website.</li>
              <li><strong>Log data:</strong> IP address, access times, and pages viewed on our website.</li>
            </ul>

            <h3>2.3 Information from Public Sources</h3>
            <ul>
              <li><strong>Property data:</strong> We aggregate publicly available property listings and RERA-registered project information to power our recommendations.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Provide personalised property recommendations and search results.</li>
              <li>Connect property seekers with relevant brokers.</li>
              <li>Improve and optimise our AI models and service quality.</li>
              <li>Communicate updates, alerts, and promotional information related to your property search.</li>
              <li>Monitor and analyse usage trends to enhance user experience.</li>
              <li>Comply with legal obligations and enforce our terms.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>4. Sharing of Information</h2>
            <p>We may share your information in the following circumstances:</p>
            <ul>
              <li><strong>With brokers:</strong> When you express interest in a property, we share relevant contact details with the associated broker to facilitate the transaction.</li>
              <li><strong>Service providers:</strong> We work with third-party providers (cloud hosting, analytics, messaging platforms) who process data on our behalf under strict confidentiality agreements.</li>
              <li><strong>Legal requirements:</strong> We may disclose information if required by law, regulation, or legal process.</li>
              <li><strong>Business transfers:</strong> In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction.</li>
            </ul>
            <p>We do not sell your personal information to third parties.</p>
          </section>

          <section className="legal-section">
            <h2>5. Data Storage and Security</h2>
            <p>
              Your data is stored on secure servers within India. We implement industry-standard security measures including encryption in transit and at rest, access controls, and regular security audits to protect your information.
            </p>
            <p>
              While we strive to protect your data, no method of electronic transmission or storage is 100% secure. We cannot guarantee absolute security.
            </p>
          </section>

          <section className="legal-section">
            <h2>6. Data Retention</h2>
            <p>
              We retain your personal information for as long as your account is active or as needed to provide our services. If you request deletion of your data, we will remove it within 30 days, except where retention is required by law.
            </p>
          </section>

          <section className="legal-section">
            <h2>7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong>Correction:</strong> Request correction of inaccurate or incomplete data.</li>
              <li><strong>Deletion:</strong> Request deletion of your personal data.</li>
              <li><strong>Withdraw consent:</strong> Withdraw your consent to data processing at any time.</li>
              <li><strong>Data portability:</strong> Request your data in a structured, machine-readable format.</li>
            </ul>
            <p>
              To exercise any of these rights, contact us at <a href="mailto:hello@saarthi.ai">hello@saarthi.ai</a>.
            </p>
          </section>

          <section className="legal-section">
            <h2>8. WhatsApp and Third-Party Platforms</h2>
            <p>
              Our primary service operates via WhatsApp, which is owned by Meta Platforms, Inc. Your use of WhatsApp is governed by WhatsApp&apos;s own privacy policy and terms of service. We are not responsible for the data practices of WhatsApp or any other third-party platform.
            </p>
          </section>

          <section className="legal-section">
            <h2>9. Cookies and Tracking</h2>
            <p>
              Our website may use essential cookies to ensure proper functionality. We do not use advertising or tracking cookies. Analytics, if any, are privacy-respecting and anonymised.
            </p>
          </section>

          <section className="legal-section">
            <h2>10. Children&apos;s Privacy</h2>
            <p>
              Saarthi is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from children. If we learn that we have collected data from a child, we will delete it promptly.
            </p>
          </section>

          <section className="legal-section">
            <h2>11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated &quot;Last updated&quot; date. Continued use of our services after changes constitutes acceptance of the revised policy.
            </p>
          </section>

          <section className="legal-section">
            <h2>12. Contact Us</h2>
            <p>If you have questions or concerns about this Privacy Policy, please contact us:</p>
            <ul>
              <li><strong>Email:</strong> <a href="mailto:hello@saarthi.ai">hello@saarthi.ai</a></li>
              <li><strong>WhatsApp:</strong> <a href="https://wa.me/919826078459">+91 98260 78459</a></li>
              <li><strong>Location:</strong> Indore, Madhya Pradesh, India</li>
            </ul>
          </section>
        </div>
      </main>

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
            <Link href="/#what" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>What it is</Link>
            <Link href="/#how" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>How it works</Link>
            <Link href="/#brokers" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>For brokers</Link>
            <Link href="/#cities" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>Cities</Link>
            <Link href="/privacy-policy" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>Privacy Policy</Link>
          </div>
          <div className="footer-meta">© 2025 Saarthi AI · Indore, India</div>
        </div>
      </footer>
    </>
  )
}
