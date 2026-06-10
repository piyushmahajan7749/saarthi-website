import SimulatorClient from './SimulatorClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Bot Simulator — Saarthi Command Center' }

export default function SimulatorPage() {
  return (
    <div>
      <header style={{ marginBottom: '1.6rem' }}>
        <h1 className="admin-title">Bot <em style={{ color: 'var(--o)' }}>simulator</em></h1>
        <p className="admin-sub">
          Chat as a fake buyer — watch the AI qualify, match properties, and ping the broker. No WhatsApp setup needed.
        </p>
      </header>
      <SimulatorClient />
    </div>
  )
}
