const WA = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '919826078459'

export default function WhatsAppFloat({ text }: { text?: string }) {
  const href = `https://wa.me/${WA}${text ? `?text=${encodeURIComponent(text)}` : ''}`
  return (
    <a href={href} className="wa-float" target="_blank" rel="noopener noreferrer" style={{ bottom: '6.5rem' }}>
      <div className="wa-float-dot"></div>
      WhatsApp us
    </a>
  )
}
