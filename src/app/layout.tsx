import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Saarthi — Har saude mein saath.',
  description: 'India\'s AI property guide. From the first message to the final keys — Saarthi is the intelligent guide that sits beside every broker and every buyer.',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Outfit:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
