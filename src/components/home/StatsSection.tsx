'use client'

import { useEffect, useRef, useState } from 'react'

const stats = [
  { value: '30 min', label: 'Délai moyen de livraison',         emoji: '⚡', num: 30,  suffix: ' min'  },
  { value: '100%',   label: 'Coursiers vérifiés CNI+Permis',    emoji: '🛡️', num: 100, suffix: '%'     },
  { value: '3',      label: 'Opérateurs Mobile Money acceptés', emoji: '💳', num: 3,   suffix: ' ops'  },
  { value: '24h/7j', label: 'Service client disponible',        emoji: '🎧', num: 24,  suffix: 'h/7j'  },
]

function CountUp({ target, suffix, active }: { target: number; suffix: string; active: boolean }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!active) return
    let start = 0
    const duration = 1500
    const step = Math.ceil(target / (duration / 16))
    const timer = setInterval(() => {
      start += step
      if (start >= target) { setCount(target); clearInterval(timer) }
      else setCount(start)
    }, 16)
    return () => clearInterval(timer)
  }, [active, target])
  return <>{count}{suffix}</>
}

export default function StatsSection() {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setActive(true); observer.disconnect() } },
      { threshold: 0.3 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section className="relative py-12 sm:py-16 bg-nyme-blue-mid overflow-hidden" ref={ref}>
      <div className="absolute inset-0 bg-gradient-to-r from-nyme-orange/6 via-transparent to-nyme-blue-light/6" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className="text-center p-4 sm:p-6 nyme-card"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="text-2xl sm:text-3xl mb-2">{stat.emoji}</div>
              <div className="font-heading text-xl sm:text-2xl lg:text-3xl font-extrabold text-nyme-orange mb-1">
                {stat.label.includes('Service') || stat.label.includes('Mobile')
                  ? stat.value
                  : <CountUp target={stat.num} suffix={stat.suffix} active={active} />
                }
              </div>
              <div className="text-white/65 text-[10px] sm:text-xs font-body leading-snug">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
