'use client'

// Listing media carousel — cycles through all photos and videos with
// arrows, a thumbnail strip, a counter and keyboard nav. Used on the public
// listing detail page where a listing can have many images plus videos.

import { useCallback, useEffect, useState } from 'react'

export interface MediaItem {
  type: 'image' | 'video'
  src: string
}

export default function MediaCarousel({
  media,
  title,
  listingFor,
  featured = false,
}: {
  media: MediaItem[]
  title: string
  listingFor: 'SALE' | 'RENT' | string
  featured?: boolean
}) {
  const [idx, setIdx] = useState(0)
  const count = media.length
  const current = media[Math.min(idx, count - 1)]

  const go = useCallback(
    (delta: number) => setIdx((i) => (i + delta + count) % count),
    [count]
  )

  useEffect(() => {
    if (count <= 1) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, count])

  if (count === 0) return null

  return (
    <div className="carousel">
      <div className="carousel-stage">
        {current.type === 'image' ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={current.src} alt={title} />
        ) : (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={current.src} controls preload="metadata" playsInline />
        )}

        <div className="prop-badges">
          <span className={`badge ${listingFor === 'RENT' ? 'badge-teal' : 'badge-orange'}`}>
            For {listingFor === 'RENT' ? 'Rent' : 'Sale'}
          </span>
          {featured && <span className="badge badge-gold">★ Featured</span>}
        </div>

        {count > 1 && (
          <>
            <button className="carousel-nav prev" onClick={() => go(-1)} aria-label="Previous">‹</button>
            <button className="carousel-nav next" onClick={() => go(1)} aria-label="Next">›</button>
            <div className="carousel-count">{Math.min(idx, count - 1) + 1} / {count}</div>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="carousel-thumbs">
          {media.map((m, i) => (
            <button
              key={m.src + i}
              className={`carousel-thumb ${i === idx ? 'active' : ''}`}
              onClick={() => setIdx(i)}
              aria-label={`Go to ${m.type} ${i + 1}`}
            >
              {m.type === 'image' ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={m.src} alt="" loading="lazy" />
              ) : (
                <span className="carousel-thumb-vid">▶</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
