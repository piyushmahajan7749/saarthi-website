import Link from 'next/link'
import { transcriptionConfigured } from '@/lib/transcription'
import { aiEnabled } from '@/lib/ai'
import AddLeadClient from './AddLeadClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Add lead — Saarthi Command Center' }

export default function AddLeadPage() {
  return (
    <div>
      <Link href="/admin/leads" className="hint" style={{ textDecoration: 'none' }}>← Back to CRM</Link>
      <h1 className="admin-title" style={{ marginTop: 8 }}>Add a <em style={{ color: 'var(--o)' }}>lead</em></h1>
      <p className="admin-sub" style={{ marginBottom: '1.6rem' }}>
        Speak or type a quick note — Saarthi AI extracts the details, creates the lead, and starts the WhatsApp conversation automatically.
      </p>
      <AddLeadClient transcriptionEnabled={transcriptionConfigured()} aiEnabled={aiEnabled()} />
    </div>
  )
}
