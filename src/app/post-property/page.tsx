import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import ChatWidget from '@/components/ChatWidget'
import WhatsAppFloat from '@/components/WhatsAppFloat'
import PostPropertyForm from './PostPropertyForm'

export const metadata: Metadata = {
  title: 'Post your property — Saarthi',
  description: 'List your property with Saarthi for free. AI-assisted listing that reaches qualified buyers and tenants on WhatsApp.',
}

export default function PostPropertyPage() {
  return (
    <>
      <Nav />
      <main className="page">
        <div className="wrap">
          <div className="page-head">
            <h1 className="page-title">
              List your property with <em>Saarthi</em>
            </h1>
            <p className="page-sub">Free listing · AI-assisted · Reaches qualified buyers on WhatsApp</p>
          </div>
          <PostPropertyForm />
          <div style={{ height: '4rem' }} />
        </div>
      </main>
      <Footer />
      <WhatsAppFloat text="Hi Saarthi! I want to list my property." />
      <ChatWidget />
    </>
  )
}
