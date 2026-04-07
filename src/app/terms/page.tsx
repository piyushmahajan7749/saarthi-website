'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function TermsOfService() {
  return (
    <>
      {/* NAV */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(14,10,6,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(200,96,26,0.08)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 2rem' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <Image src="/logo-transparent.png" alt="Saarthi" width={40} height={40} style={{ objectFit: 'contain' }} />
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '20px', fontWeight: 700, color: 'var(--cream)' }}>
              Saar<span style={{ color: 'var(--o)' }}>thi</span>
            </span>
          </Link>
          <Link href="/" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>
            &larr; Back to home
          </Link>
        </div>
      </nav>

      {/* CONTENT */}
      <main style={{ maxWidth: '780px', margin: '0 auto', padding: '8rem 2rem 4rem' }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 600, color: 'var(--cream)', marginBottom: '0.5rem' }}>
          Terms of Service
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '3rem' }}>
          Last updated: 7 April 2025
        </p>

        <div className="legal-content">
          <section>
            <h2>1. Introduction</h2>
            <p>
              Welcome to Saarthi (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). Saarthi is an AI-powered property discovery and advisory platform operated from Indore, India. By accessing or using our services through WhatsApp, our website at saarthi.ai, or any other channel we provide (collectively, the &quot;Services&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree, please do not use our Services.
            </p>
          </section>

          <section>
            <h2>2. Eligibility</h2>
            <p>
              You must be at least 18 years of age and legally capable of entering into binding contracts under applicable Indian law to use our Services. By using the Services, you represent and warrant that you meet these requirements.
            </p>
          </section>

          <section>
            <h2>3. Description of Services</h2>
            <p>Saarthi provides the following through AI-driven technology:</p>
            <ul>
              <li>Property discovery and shortlisting across multiple listing sources</li>
              <li>Fair price intelligence based on historical transaction data</li>
              <li>RERA developer scoring and locality assessments</li>
              <li>Visit scheduling and deal monitoring</li>
              <li>AI-powered tools for real estate brokers, including automatic shortlist generation, deal intelligence reports, and WhatsApp-based client management</li>
            </ul>
            <p>
              All interactions happen primarily via WhatsApp. You acknowledge that you are also subject to WhatsApp&apos;s own terms of service when using our WhatsApp-based features.
            </p>
          </section>

          <section>
            <h2>4. User Accounts &amp; Communication</h2>
            <p>
              Our Services are accessed via your WhatsApp number. You are responsible for maintaining the security of your WhatsApp account and for all activity that occurs through your number in connection with our Services. You agree to provide accurate information and to update it as necessary.
            </p>
          </section>

          <section>
            <h2>5. Fees &amp; Payment</h2>
            <p>
              <strong>For property seekers:</strong> Saarthi&apos;s core property discovery services are provided free of charge.
            </p>
            <p>
              <strong>For brokers:</strong> Saarthi operates on a performance-based pricing model. Fees are only charged upon the successful closure of a deal. Specific fee structures will be communicated to broker partners separately and may vary.
            </p>
            <p>
              We reserve the right to introduce, modify, or discontinue pricing at any time with reasonable prior notice.
            </p>
          </section>

          <section>
            <h2>6. AI-Generated Content &amp; Accuracy</h2>
            <p>
              Our Services rely on artificial intelligence to process information, generate property recommendations, provide price intelligence, and produce other outputs. While we strive for accuracy:
            </p>
            <ul>
              <li>AI-generated outputs are for informational purposes only and do not constitute professional real estate, legal, or financial advice.</li>
              <li>Property data is aggregated from third-party sources (listing platforms, public records, broker networks) and may not always be current or accurate.</li>
              <li>Price estimates, locality scores, and developer ratings are algorithmic assessments and should not be the sole basis for any property transaction decision.</li>
              <li>You should independently verify all material information before making any purchase, sale, or investment decision.</li>
            </ul>
          </section>

          <section>
            <h2>7. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul>
              <li>Use the Services for any unlawful purpose or in violation of any applicable law or regulation</li>
              <li>Provide false, misleading, or fraudulent information</li>
              <li>Attempt to reverse-engineer, scrape, or extract data from our AI systems</li>
              <li>Interfere with or disrupt the integrity or performance of the Services</li>
              <li>Use the Services to spam, harass, or send unsolicited communications</li>
              <li>Resell, redistribute, or commercially exploit any Service output without our written consent</li>
            </ul>
          </section>

          <section>
            <h2>8. Intellectual Property</h2>
            <p>
              All content, technology, branding, and materials provided through the Services (including AI models, algorithms, and generated outputs) are owned by or licensed to Saarthi and are protected under applicable intellectual property laws. You may use outputs generated for you through the Services for your personal or internal business purposes only.
            </p>
          </section>

          <section>
            <h2>9. Third-Party Services</h2>
            <p>
              Our Services integrate with or reference third-party platforms including WhatsApp, property listing sites (such as 99acres and MagicBricks), and other data sources. We are not responsible for the availability, accuracy, or policies of these third-party services. Your use of third-party services is governed by their respective terms.
            </p>
          </section>

          <section>
            <h2>10. Privacy &amp; Data</h2>
            <p>
              Your use of the Services is also governed by our Privacy Policy. By using the Services, you consent to the collection, use, and processing of your data as described therein. We process data in accordance with applicable Indian data protection laws, including the Digital Personal Data Protection Act, 2023.
            </p>
          </section>

          <section>
            <h2>11. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law:
            </p>
            <ul>
              <li>Saarthi provides the Services on an &quot;as is&quot; and &quot;as available&quot; basis without warranties of any kind, whether express or implied.</li>
              <li>We do not guarantee the accuracy, completeness, or reliability of any property data, price estimates, or AI-generated recommendations.</li>
              <li>We shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Services.</li>
              <li>Our total liability to you for any claim arising from these Terms or the Services shall not exceed the amount you paid to us in the twelve (12) months preceding the claim.</li>
            </ul>
          </section>

          <section>
            <h2>12. Indemnification</h2>
            <p>
              You agree to indemnify and hold Saarthi, its officers, employees, and agents harmless from any claims, damages, losses, or expenses (including reasonable legal fees) arising out of your use of the Services, your violation of these Terms, or your violation of any rights of a third party.
            </p>
          </section>

          <section>
            <h2>13. Termination</h2>
            <p>
              We may suspend or terminate your access to the Services at any time, with or without cause, and with or without notice. You may stop using the Services at any time. Upon termination, provisions of these Terms that by their nature should survive (including limitation of liability, indemnification, and governing law) shall remain in effect.
            </p>
          </section>

          <section>
            <h2>14. Modifications to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. Changes will be effective upon posting the updated Terms on our website. Your continued use of the Services following any changes constitutes your acceptance of the revised Terms. We will make reasonable efforts to notify users of material changes via WhatsApp or our website.
            </p>
          </section>

          <section>
            <h2>15. Governing Law &amp; Dispute Resolution</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of India. Any disputes arising out of or relating to these Terms or the Services shall be subject to the exclusive jurisdiction of the courts in Indore, Madhya Pradesh, India.
            </p>
          </section>

          <section>
            <h2>16. Contact Us</h2>
            <p>If you have any questions about these Terms, please reach out:</p>
            <ul>
              <li>Email: <a href="mailto:hello@saarthi.ai">hello@saarthi.ai</a></li>
              <li>WhatsApp: <a href="https://wa.me/919826078459">+91 98260 78459</a></li>
            </ul>
          </section>
        </div>
      </main>

      {/* FOOTER */}
      <footer>
        <div className="footer-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/logo-transparent.png" alt="Saarthi" width={64} height={64} style={{ objectFit: 'contain' }} />
            <div>
              <div className="footer-logo">Saar<span>thi</span> &middot; &#2360;&#2366;&#2352;&#2341;&#2368;</div>
              <div className="footer-tagline" style={{ marginTop: '6px' }}>Har saude mein saath.</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '3rem', flexWrap: 'wrap' as const }}>
            <Link href="/#what" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>What it is</Link>
            <Link href="/#how" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>How it works</Link>
            <Link href="/#brokers" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>For brokers</Link>
            <Link href="/#cities" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>Cities</Link>
          </div>
          <div className="footer-meta">&copy; 2025 Saarthi AI &middot; Indore, India</div>
        </div>
      </footer>
    </>
  );
}
