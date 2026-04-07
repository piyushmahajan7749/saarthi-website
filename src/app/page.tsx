'use client'

import { useEffect } from 'react'
import Image from 'next/image'

function PhoneIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 5.5C3 14.06 9.94 21 18.5 21c.386 0 .77-.014 1.148-.042.435-.032.653-.048.851-.162a1.67 1.67 0 00.565-.567c.112-.197.128-.416.16-.851l.247-3.166c.03-.385.046-.578-.012-.747a1 1 0 00-.36-.479c-.144-.108-.33-.157-.702-.255l-2.943-.736c-.402-.1-.603-.151-.787-.116a1 1 0 00-.536.305c-.128.144-.192.337-.32.724l-.547 1.64a13.045 13.045 0 01-6.328-6.328l1.64-.546c.387-.129.58-.193.724-.321a1 1 0 00.305-.536c.035-.184-.016-.385-.116-.787l-.736-2.943c-.098-.372-.147-.558-.255-.702a1 1 0 00-.479-.36C9.623 3.046 9.43 3.062 9.044 3.09L5.879 3.34c-.435.031-.653.047-.851.16a1.67 1.67 0 00-.567.564c-.114.199-.13.418-.162.852z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <polyline points="20 6 9 17 4 12" stroke="#C8601A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Home() {
  useEffect(() => {
    // Scroll reveal
    const reveals = document.querySelectorAll('.reveal')
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('visible')
            obs.unobserve(e.target)
          }
        })
      },
      { threshold: 0.12 }
    )
    reveals.forEach((r) => obs.observe(r))

    // Nav scroll effect
    const handleScroll = () => {
      const nav = document.querySelector('nav')
      if (nav) {
        nav.style.background = window.scrollY > 80 ? 'rgba(14,10,6,0.92)' : 'rgba(14,10,6,0.7)'
      }
    }
    window.addEventListener('scroll', handleScroll)

    return () => {
      obs.disconnect()
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const marqueeItems = [
    { highlight: 'Indore', text: 'MagicBricks verified' },
    { highlight: '2BHK ready to move', text: 'Found in 11 minutes' },
    { highlight: 'RERA clean developer', text: '22 min commute' },
    { highlight: 'Fair price', text: '₹1.5L negotiated off asking' },
    { highlight: 'Deal closed', text: '9 days from first message' },
    { highlight: 'Pune', text: 'No broker fee' },
    { highlight: 'Bhopal', text: '5,800+ live listings scanned' },
  ]

  return (
    <>
      {/* NAV */}
      <nav>
        <div className="nav-logo">
          <Image src="/logo-transparent.png" alt="Saarthi" width={72} height={72} style={{ objectFit: 'contain' }} />
          <div>
            <div className="nav-logo-text">Saar<span>thi</span></div>
            <div className="nav-logo-hi">सारथी</div>
          </div>
        </div>
        <div className="nav-links">
          <a href="#what">What it is</a>
          <a href="#how">How it works</a>
          <a href="#brokers">For brokers</a>
          <a href="#cities">Cities</a>
        </div>
        <a href="#cta" className="nav-cta">WhatsApp us →</a>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-bg"></div>
        <div className="hero-grid"></div>
        <div className="hero-eyebrow"><span className="hero-dot"></span>India&apos;s AI property guide</div>
        <h1 className="hero-title">Har saude<br />mein <em>saath.</em></h1>
        <div className="hero-title-hi">हर सौदे में साथ।</div>
        <p className="hero-sub">From the first message to the final keys — <strong>Saarthi is the intelligent guide</strong> that sits beside every broker and every buyer, making India&apos;s real estate market finally work in your favour.</p>
        <div className="hero-actions">
          <a href="#cta" className="btn-primary">
            <PhoneIcon size={16} />
            WhatsApp us now
          </a>
          <a href="#how" className="btn-ghost">See how it works ↓</a>
        </div>
        <div className="hero-stats">
          <div className="stat-item">
            <div className="stat-num">9 days</div>
            <div className="stat-label">Average time to close a deal</div>
          </div>
          <div className="stat-div"></div>
          <div className="stat-item">
            <div className="stat-num">0</div>
            <div className="stat-label">Apps to download or learn</div>
          </div>
          <div className="stat-div"></div>
          <div className="stat-item">
            <div className="stat-num">24/7</div>
            <div className="stat-label">AI working while you sleep</div>
          </div>
          <div className="stat-div"></div>
          <div className="stat-item">
            <div className="stat-num">Free</div>
            <div className="stat-label">For property seekers</div>
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="marquee-wrap">
        <div className="marquee-track">
          {[...marqueeItems, ...marqueeItems].map((item, i) => (
            <span className="marquee-item" key={i}>
              <span>{item.highlight}</span> <span className="marquee-sep">·</span> {item.text}
            </span>
          ))}
        </div>
      </div>

      {/* WHAT IS SAARTHI */}
      <section className="what-section" id="what">
        <div className="container">
          <div className="what-grid">
            <div>
              <p className="section-eyebrow reveal">What is Saarthi</p>
              <h2 className="section-title reveal reveal-delay-1">The guide you never had for <em>property</em></h2>
              <p className="section-body reveal reveal-delay-2">
                In the Mahabharata, Saarthi was the charioteer who navigated the battlefield — not the warrior, but the intelligence beside him. Krishna was Arjuna&apos;s Saarthi.<br /><br />
                We built that same relationship into India&apos;s real estate market. Whether you&apos;re a broker closing deals or a family finding a home — Saarthi is the intelligence always on your side.
              </p>
              <div className="what-cards-stack" style={{ marginTop: '2.5rem' }}>
                <div className="what-small-card reveal reveal-delay-2">
                  <div className="what-small-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 5.5C3 14.06 9.94 21 18.5 21c.386 0 .77-.014 1.148-.042.435-.032.653-.048.851-.162a1.67 1.67 0 00.565-.567c.112-.197.128-.416.16-.851l.247-3.166c.03-.385.046-.578-.012-.747a1 1 0 00-.36-.479c-.144-.108-.33-.157-.702-.255l-2.943-.736c-.402-.1-.603-.151-.787-.116a1 1 0 00-.536.305c-.128.144-.192.337-.32.724l-.547 1.64a13.045 13.045 0 01-6.328-6.328l1.64-.546c.387-.129.58-.193.724-.321a1 1 0 00.305-.536c.035-.184-.016-.385-.116-.787l-.736-2.943c-.098-.372-.147-.558-.255-.702a1 1 0 00-.479-.36C9.623 3.046 9.43 3.062 9.044 3.09L5.879 3.34c-.435.031-.653.047-.851.16a1.67 1.67 0 00-.567.564c-.114.199-.13.418-.162.852z" stroke="#C8601A" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                  </div>
                  <div>
                    <div className="what-small-title">Lives entirely in WhatsApp</div>
                    <div className="what-small-body">No app to download, no login to remember. Saarthi operates on the number you already use, the way you already communicate.</div>
                  </div>
                </div>
                <div className="what-small-card reveal reveal-delay-3">
                  <div className="what-small-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#C8601A" strokeWidth="1.5" /><path d="M12 7v5l3 3" stroke="#C8601A" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  </div>
                  <div>
                    <div className="what-small-title">Works while you sleep</div>
                    <div className="what-small-body">Every night, Saarthi scans thousands of listings, monitors price drops, watches your active deals, and prepares your morning brief.</div>
                  </div>
                </div>
                <div className="what-small-card reveal reveal-delay-4">
                  <div className="what-small-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2L3 7l9 5 9-5-9-5zM3 17l9 5 9-5M3 12l9 5 9-5" stroke="#C8601A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                  <div>
                    <div className="what-small-title">Gets smarter every deal</div>
                    <div className="what-small-body">Every closed deal teaches Saarthi what works. By month three, it knows the Indore market better than any portal ever will.</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="what-visual reveal reveal-delay-2">
              <div className="what-card">
                <div className="what-card-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" stroke="white" strokeWidth="1.5" /><path d="M8 12h8M12 8l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div className="what-card-title">From search to keys</div>
                <div className="what-card-body">Saarthi handles the entire journey — understanding what you want, scanning the market, shortlisting the best options, scheduling visits, and watching every deal until it closes. All through one WhatsApp conversation.</div>
                <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(200,96,26,0.15)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: '.875rem' }}>The Saarthi journey</div>
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
                    {['Tell Saarthi what you need', 'Receive a curated shortlist in minutes', 'Visit scheduled automatically', 'Deal closed. Keys in hand.'].map((text, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--cream)' }}>
                        <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(200,96,26,0.2)', border: '1px solid rgba(200,96,26,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'var(--o)', flexShrink: 0 }}>{i + 1}</span>
                        {text}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* THE PROBLEM */}
      <section className="problem-section">
        <div className="problem-bg"></div>
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <p className="section-eyebrow reveal">The problem we solve</p>
            <h2 className="section-title reveal reveal-delay-1" style={{ maxWidth: '600px', margin: '0 auto 0' }}>India&apos;s property market is <em>broken</em> for everyone</h2>
          </div>
          <div className="problem-grid">
            {[
              { num: '01', title: 'Buyers waste weekends', body: 'The average Indian property seeker spends 6–8 weekends visiting flats that looked nothing like the photos. Time lost. Trust broken. No system to protect them.' },
              { num: '02', title: 'Brokers work without intelligence', body: 'The best broker in any city still manually scrolls 99acres at midnight, manually builds shortlists, and manually follows up — with no system watching deals while they sleep.' },
              { num: '03', title: 'Markets move faster than people', body: 'A motivated seller, a price drop, a new listing — these signals last hours in a hot market. Without real-time intelligence, every missed signal is a missed deal.' },
            ].map((card, i) => (
              <div className={`problem-card reveal ${i > 0 ? `reveal-delay-${i}` : ''}`} key={i}>
                <div className="problem-num">{card.num}</div>
                <div className="problem-title">{card.title}</div>
                <div className="problem-body">{card.body}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: '3rem' }}>
            <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '22px', fontStyle: 'italic', color: 'var(--muted)' }}>Saarthi fixes all three.</p>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="how-section" id="how">
        <div className="container">
          <p className="section-eyebrow reveal">How it works</p>
          <h2 className="section-title reveal reveal-delay-1">One conversation.<br /><em>Every answer.</em></h2>
          <p className="section-body reveal reveal-delay-2">Saarthi conducts a natural WhatsApp conversation to understand exactly what you need — then handles everything else without being asked.</p>
          <div className="steps-wrap">
            <div className="steps-line"></div>
            {[
              { num: 1, tag: 'Client intake', title: 'Saarthi listens before it searches', body: "A natural Hindi-English conversation — not a form, not a dropdown. Saarthi asks about your budget, your commute, your family's needs, your dealbreakers. It understands context that no portal ever captures.", pills: ['Budget + stretch', 'Commute tolerance', 'School proximity', 'Timeline', 'Dealbreakers'] },
              { num: 2, tag: 'Market scan', title: '1,200+ listings scanned in under 11 minutes', body: 'Saarthi searches every major portal, private Facebook groups, broker WhatsApp groups, and Instagram pages simultaneously — sources no individual broker monitors. Every listing is checked for fair pricing against 90-day closed sales.', pills: ['99acres + MagicBricks', 'Facebook groups', 'Broker WA groups', 'RERA verification', 'Fair price check'] },
              { num: 3, tag: 'Intelligence report', title: 'A report that makes you the most prepared person in any room', body: 'Each property comes with a fair price score, developer trust score, locality outlook, commute time, days on market, and a negotiation script — generated from real market data.', pills: ['Fair price score', 'RERA clean / review flag', 'Negotiation edge', '3-year locality outlook'] },
              { num: 4, tag: 'Scheduling + monitoring', title: 'Saarthi never lets a deal go cold', body: "When you express interest, Saarthi automatically offers visit slots from the broker's calendar. After the visit, it monitors the property 24/7 — flagging price drops, status changes, competing interest.", pills: ['Calendar integration', '72hr silence detection', 'Price drop alerts', 'Re-engagement scripts'] },
            ].map((step) => (
              <div className="step reveal" key={step.num}>
                <div className="step-num">{step.num}</div>
                <div className="step-content">
                  <div className="step-tag">{step.tag}</div>
                  <div className="step-title">{step.title}</div>
                  <div className="step-body">{step.body}</div>
                  <div className="step-pills">
                    {step.pills.map((pill) => (
                      <span className="step-pill" key={pill}>{pill}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="features-section" id="features">
        <div className="features-bg"></div>
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <p className="section-eyebrow reveal">Capabilities</p>
          <h2 className="section-title reveal reveal-delay-1">Everything the market<br />never gave <em>you</em></h2>
          <div className="features-grid">
            {[
              { icon: '🔍', title: 'Multi-source scanning', body: "Portals, Facebook groups, Instagram pages, and private broker WhatsApp groups — all scanned simultaneously. Access inventory that never appears on 99acres." },
              { icon: '⚖️', title: 'Fair price intelligence', body: 'Every listing compared against 90-day closed sales in the same locality. Know immediately if a property is overpriced, fairly priced, or a rare deal.' },
              { icon: '🏛️', title: 'RERA developer scoring', body: 'Every developer automatically checked for RERA registration status, delivery track record, and active complaints before they ever appear in a shortlist.' },
              { icon: '📍', title: 'Locality future score', body: 'Infrastructure pipeline data — upcoming metro routes, schools, hospitals, commercial zones — scored into a 3-year locality outlook for every area.' },
              { icon: '🗓️', title: 'Automatic scheduling', body: "Saarthi reads the broker's calendar and offers two visit slots the moment a client expresses interest. One reply. Visit confirmed. No back-and-forth." },
              { icon: '📊', title: 'Weekly deal intelligence', body: 'Every Monday at 8:30am, a full performance brief arrives in WhatsApp. Deals closed, leads lost, where things are stalling, and three priority actions for the week.' },
              { icon: '🧠', title: 'Self-improving AI', body: 'Every night, Saarthi analyses what worked, finds patterns across all closed deals, and updates its own approach. Week twelve is dramatically smarter than week one.' },
              { icon: '🔔', title: 'Deal monitor alerts', body: 'Price drops, status changes, developer news, client silence — Saarthi watches every active deal and alerts the broker before anything slips through the cracks.' },
              { icon: '💬', title: 'Zero new apps', body: 'Entirely WhatsApp-native. Brokers use the number they already have. Clients message like they always would. No training, no onboarding, no friction.' },
            ].map((f, i) => (
              <div className={`feature-card reveal ${i % 3 === 1 ? 'reveal-delay-1' : i % 3 === 2 ? 'reveal-delay-2' : ''}`} key={i}>
                <div className="feature-icon">{f.icon}</div>
                <div className="feature-title">{f.title}</div>
                <div className="feature-body">{f.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOR BROKERS */}
      <section className="brokers-section" id="brokers">
        <div className="brokers-glow"></div>
        <div className="container">
          <div className="brokers-grid">
            <div>
              <p className="section-eyebrow reveal">For brokers</p>
              <h2 className="section-title reveal reveal-delay-1">The best broker in every city<br />uses <em>Saarthi</em></h2>
              <p className="section-body reveal reveal-delay-2">We don&apos;t replace brokers. We give one broker in every city an edge so decisive that the rest of the market wonders what changed.</p>
              <div className="brokers-metrics reveal reveal-delay-3">
                {[
                  { big: '9d', label: 'Average deal close time with Saarthi' },
                  { big: '3×', label: 'More deals per month vs. manual workflow' },
                  { big: '0%', label: 'Commission to Saarthi unless your deal closes' },
                  { big: '11m', label: 'From client intake to ready shortlist' },
                ].map((m, i) => (
                  <div className="metric-card" key={i}>
                    <div className="metric-big">{m.big}</div>
                    <div className="metric-label">{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="brokers-list reveal reveal-delay-2">
              {[
                { title: 'Your existing WhatsApp number becomes AI-powered overnight', body: 'Saarthi plugs into the number you already use. Your clients message you like always. Saarthi handles the intelligence layer invisibly.' },
                { title: 'Your WhatsApp broker groups become an exclusive data source', body: 'Every listing shared in groups where you\'re a member gets automatically indexed. You see off-market deals before anyone else.' },
                { title: 'Walk into every site visit already knowing the answer', body: 'Saarthi generates a property-specific inspection checklist, the right questions to ask the developer, and your exact negotiation opening.' },
                { title: 'Never lose a deal to silence again', body: 'When a client goes quiet for 48 hours, Saarthi detects it and sends you the perfect re-engagement message — timed to a price drop, a deadline, or a new listing.' },
                { title: 'Pay nothing unless you close', body: 'Saarthi earns on performance. We take a share only when a deal closes through the platform. No upfront fees. No risk. Just results.' },
              ].map((item, i) => (
                <div className="broker-item" key={i}>
                  <div className="broker-check"><CheckIcon /></div>
                  <div>
                    <div className="broker-item-title">{item.title}</div>
                    <div className="broker-item-body">{item.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="testimonials-section">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <p className="section-eyebrow reveal">Real results</p>
            <h2 className="section-title reveal reveal-delay-1">What brokers and buyers say</h2>
          </div>
          <div className="testimonials-grid">
            {[
              { featured: true, text: 'Pehle ek deal mein 6 hafte lagte the. Ab 9 din mein ho jaata hai. Saarthi ne mera kaam hi badal diya — clients ko aisa report milta hai ki doosre broker se baat karna band ho jaata hai unka.', initials: 'RV', name: 'Rajan Verma', role: 'Senior broker · Indore · 14 deals closed with Saarthi', color: 'rgba(200,96,26,0.2)', textColor: 'var(--o)' },
              { featured: false, text: 'Teen weekend waste ho gaye the flats dhundte dhundte. Saarthi se ek WhatsApp kiya, 11 minute mein 4 options aaye — aur doosre din visit book ho gayi. Ab ghar aa gaya hain hum.', initials: 'SM', name: 'Suresh Mehta', role: 'Buyer · 2BHK · Scheme 54, Indore', color: 'rgba(26,92,78,0.3)', textColor: '#4DC8A8' },
              { featured: false, text: "The RERA flagging alone is worth everything. I almost put my client into a project with a delay history. Saarthi caught it before the visit. That's trust you can't put a number on.", initials: 'PJ', name: 'Priya Joshi', role: 'Broker · Indore · 3 deals in first month', color: 'rgba(184,134,26,0.2)', textColor: 'var(--gold)' },
            ].map((t, i) => (
              <div className={`testimonial-card ${t.featured ? 'featured' : ''} reveal ${i > 0 ? `reveal-delay-${i}` : ''}`} key={i}>
                <div className="quote-mark">&ldquo;</div>
                <div className="testimonial-text">{t.text}</div>
                <div className="testimonial-author">
                  <div className="author-avatar" style={{ background: t.color, color: t.textColor }}>{t.initials}</div>
                  <div>
                    <div className="author-name">{t.name}</div>
                    <div className="author-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CITIES */}
      <section className="cities-section" id="cities">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <p className="section-eyebrow reveal">Where we operate</p>
            <h2 className="section-title reveal reveal-delay-1">Starting in <em>Central India.</em><br />Expanding fast.</h2>
            <p className="section-body reveal reveal-delay-2" style={{ margin: '0 auto', textAlign: 'center' }}>Each city gets one deeply embedded broker partner first — then expands. We don&apos;t launch thin. We build deep.</p>
          </div>
          <div className="cities-grid">
            {[
              { name: 'Indore', state: 'Madhya Pradesh', status: 'Live now', active: true },
              { name: 'Bhopal', state: 'Madhya Pradesh', status: 'Month 2', active: false },
              { name: 'Pune', state: 'Maharashtra', status: 'Onboarding', active: false },
              { name: 'Mumbai', state: 'Maharashtra', status: 'Q2 2025', active: false },
            ].map((city, i) => (
              <div className={`city-card ${city.active ? 'active' : ''} reveal ${i > 0 ? `reveal-delay-${i}` : ''}`} key={i}>
                <div className="city-name">{city.name}</div>
                <div className="city-state">{city.state}</div>
                <div className="city-status">{city.status}</div>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--muted)', marginTop: '2rem', fontStyle: 'italic' }}>Each city launches with a single anchor broker. Their results become the proof for the next city.</p>
        </div>
      </section>

      {/* TECHNOLOGY */}
      <section className="tech-section">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <p className="section-eyebrow reveal">Under the hood</p>
            <h2 className="section-title reveal reveal-delay-1">Built on the same stack<br />as <em>the world&apos;s best AI</em></h2>
            <p className="section-body reveal reveal-delay-2" style={{ margin: '0 auto', textAlign: 'center' }}>Saarthi uses the most advanced AI infrastructure available — but you&apos;ll never see it. You&apos;ll only see the results.</p>
          </div>
          <div className="tech-grid">
            {[
              { badge: 'Data', name: 'Firecrawl', desc: 'Scrapes every major portal every 6 hours. 1,200+ live listings always fresh.' },
              { badge: 'Intelligence', name: 'Advanced RAG', desc: 'Retrieval-augmented generation that matches client profiles to live market data with precision.' },
              { badge: 'Messaging', name: 'OpenClaw + WhatsApp', desc: "Agent-orchestration framework running natively on the broker's WhatsApp Business number." },
              { badge: 'AI', name: 'Claude (Anthropic)', desc: 'The most capable and safety-conscious AI model powering every conversation and report.' },
              { badge: 'Memory', name: 'pgvector + Postgres', desc: 'Every client, every deal, every conversation — stored and searchable in a vector database that never forgets.' },
              { badge: 'Automation', name: 'Cron jobs', desc: 'Price alerts, listing freshness, deal monitoring, weekly reports — all automated and running 24/7.' },
              { badge: 'Learning', name: 'Autoresearch loop', desc: "Inspired by Karpathy's research framework — Saarthi analyses its own performance every night and updates its strategy." },
              { badge: 'Infrastructure', name: 'Azure VM', desc: 'Multi-tenant architecture on Azure. One platform, any number of broker instances across any city.' },
            ].map((tech, i) => (
              <div className={`tech-card reveal ${i % 4 > 0 ? `reveal-delay-${i % 4}` : ''}`} key={i}>
                <div className="tech-badge">{tech.badge}</div>
                <div className="tech-name">{tech.name}</div>
                <div className="tech-desc">{tech.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section" id="cta">
        <div className="cta-glow"></div>
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <h2 className="cta-title reveal">Talash se ghar tak —<br /><em>Saarthi.</em></h2>
          <p className="cta-sub reveal reveal-delay-1">Whether you&apos;re searching for a home or closing more deals — one WhatsApp message is all it takes to get started.</p>
          <div className="cta-actions reveal reveal-delay-2">
            <a href="https://wa.me/919826078459" className="btn-primary" style={{ fontSize: '17px', padding: '1.1rem 2.5rem' }}>
              <PhoneIcon size={18} />
              Start on WhatsApp
            </a>
            <a href="mailto:hello@saarthi.ai" className="btn-ghost" style={{ fontSize: '17px', padding: '1.1rem 2.5rem' }}>Email us</a>
          </div>
          <p className="cta-note reveal reveal-delay-3">Free for property seekers · No brokerage charges · Available in Indore now</p>
          <div style={{ marginTop: '3rem', paddingTop: '3rem', borderTop: '1px solid rgba(200,96,26,0.12)', display: 'flex', justifyContent: 'center', gap: '4rem', flexWrap: 'wrap' as const }} className="reveal reveal-delay-4">
            {[
              { big: 'Free', label: 'For buyers & renters' },
              { big: 'Performance', label: 'Broker pays only on closed deals' },
              { big: 'RERA', label: 'All data from public sources' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: i < 2 ? '4rem' : '0' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '32px', fontWeight: 600, color: 'var(--o)' }}>{item.big}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '3px' }}>{item.label}</div>
                </div>
                {i < 2 && <div style={{ width: '1px', background: 'rgba(200,96,26,0.15)', height: '50px', marginLeft: '4rem' }}></div>}
              </div>
            ))}
          </div>
        </div>
      </section>

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
            <a href="#what" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>What it is</a>
            <a href="#how" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>How it works</a>
            <a href="#brokers" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>For brokers</a>
            <a href="#cities" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>Cities</a>
            <a href="/privacy-policy" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>Privacy Policy</a>
            <a href="/terms" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>Terms of Service</a>
            <a href="/data-deletion" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>Data Deletion</a>
          </div>
          <div className="footer-meta">© 2025 Saarthi AI · Indore, India</div>
        </div>
      </footer>

      {/* WhatsApp float */}
      <a href="https://wa.me/919826078459" className="wa-float">
        <div className="wa-float-dot"></div>
        WhatsApp us
      </a>
    </>
  )
}
