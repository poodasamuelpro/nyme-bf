'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, Zap } from 'lucide-react'

const navLinks = [
  { href: '/',                   label: 'Accueil' },
  { href: '/#fonctionnalites',   label: 'Fonctionnalités' },
  { href: '/#comment-ca-marche', label: 'Comment ça marche' },
  { href: '/partenaires',        label: 'Partenaires' },
  { href: '/service-client',     label: 'Support' },
  { href: '/contact',            label: 'Contact' },
]

/**
 * Pages à fond sombre → le header est transparent au sommet puis se colore au scroll
 * Toutes les pages sont maintenant sur fond nyme-dark
 */

export default function Header() {
  const [isScrolled,   setIsScrolled]   = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const handleResize = () => { if (window.innerWidth >= 768) setIsMobileOpen(false) }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    document.body.style.overflow = isMobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isMobileOpen])

  const headerBg =
    isScrolled || isMobileOpen
      ? 'bg-nyme-primary-dark/97 backdrop-blur-xl border-b border-white/10 shadow-lg shadow-black/20'
      : 'bg-transparent'

  const py = isScrolled || isMobileOpen ? 'py-3' : 'py-4 sm:py-5'

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${headerBg} ${py}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-12">

            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-2 sm:gap-3 group shrink-0"
              onClick={() => setIsMobileOpen(false)}
            >
              <div className="relative">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-nyme-orange to-[#d4691a] flex items-center justify-center shadow-lg shadow-nyme-orange/30">
                  <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-white" strokeWidth={2.5} />
                </div>
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-nyme-blue-light border-2 border-nyme-primary-dark animate-pulse" />
              </div>
              <div>
                <span className="font-heading text-xl sm:text-2xl font-extrabold text-white tracking-wider drop-shadow">NYME</span>
                <div className="hidden sm:block text-[10px] text-nyme-orange/90 font-body tracking-widest uppercase -mt-1 font-semibold">
                  Livraison Intelligente
                </div>
              </div>
            </Link>

            {/* Nav desktop */}
            <nav className="hidden md:flex items-center gap-4 lg:gap-6">
              {navLinks.map((link) => {
                const isActive = pathname === link.href
                const isPartner = link.label === 'Partenaires'
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`text-sm font-body font-semibold transition-colors duration-200 relative group whitespace-nowrap
                      ${isPartner
                        ? 'text-nyme-orange hover:text-nyme-orange/80'
                        : isActive
                          ? 'text-white'
                          : 'text-white/80 hover:text-white'
                      }`}
                  >
                    {link.label}
                    <span className={`absolute -bottom-1 left-0 h-0.5 bg-nyme-orange transition-all duration-300 ${isActive ? 'w-full' : 'w-0 group-hover:w-full'}`} />
                  </Link>
                )
              })}
            </nav>

            {/* CTA desktop */}
            <a
              href="#telecharger"
              className="hidden md:inline-flex px-4 py-2.5 lg:px-5 rounded-xl bg-gradient-to-r from-nyme-orange to-[#d4691a] text-white text-sm font-bold font-body hover:shadow-lg hover:shadow-nyme-orange/40 transition-all duration-300 hover:-translate-y-0.5 whitespace-nowrap"
            >
              Télécharger l'app
            </a>

            {/* Toggle mobile */}
            <button
              onClick={() => setIsMobileOpen(!isMobileOpen)}
              className="md:hidden relative z-50 p-2 -mr-2 text-white hover:text-nyme-orange transition-colors"
              aria-label="Menu"
            >
              {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      {/* Overlay mobile */}
      <div
        className={`fixed inset-0 z-40 md:hidden transition-all duration-300 ${
          isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsMobileOpen(false)} />
        <div className={`absolute top-0 left-0 right-0 bg-nyme-primary-dark border-b-2 border-nyme-orange/30 pt-20 pb-8 px-4 transition-transform duration-300 ${isMobileOpen ? 'translate-y-0' : '-translate-y-full'}`}>
          <nav className="flex flex-col gap-1 mb-6">
            {navLinks.map((link) => {
              const isPartner = link.label === 'Partenaires'
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-4 rounded-xl transition-all font-body font-semibold text-base border border-transparent ${
                    isPartner
                      ? 'text-nyme-orange bg-nyme-orange/10 border-nyme-orange/20 hover:bg-nyme-orange/20'
                      : 'text-white hover:text-nyme-orange hover:bg-white/5 hover:border-white/10'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isPartner ? 'bg-nyme-orange' : 'bg-nyme-orange/50'}`} />
                  {link.label}
                </Link>
              )
            })}
          </nav>
          <a href="#telecharger" onClick={() => setIsMobileOpen(false)} className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-gradient-to-r from-nyme-orange to-[#d4691a] text-white font-bold text-base shadow-lg font-body">
            <Zap size={18} /> Télécharger l'app
          </a>
        </div>
      </div>
    </>
  )
}