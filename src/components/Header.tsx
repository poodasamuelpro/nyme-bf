'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Menu, X, Zap } from 'lucide-react'

const navLinks = [
  { href: '/',                    label: 'Accueil' },
  { href: '/#fonctionnalites',    label: 'Fonctionnalités' },
  { href: '/#comment-ca-marche',  label: 'Comment ça marche' },
  { href: '/partenaires',         label: 'Partenaires' },
  { href: '/service-client',      label: 'Support' },
  { href: '/contact',             label: 'Contact' },
]

export default function Header() {
  const [isScrolled,    setIsScrolled]    = useState(false)
  const [isMobileOpen,  setIsMobileOpen]  = useState(false)

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

  return (
    <>
      {/* ── Header fixe ── */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled || isMobileOpen
            ? 'bg-nyme-primary-dark/95 backdrop-blur-xl border-b border-nyme-orange/20 py-3'
            : 'bg-transparent py-4 sm:py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-12">

            {/* ── Logo ── */}
            <Link
              href="/"
              className="flex items-center gap-2 sm:gap-3 group shrink-0"
              onClick={() => setIsMobileOpen(false)}
            >
              <div className="relative">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-nyme-orange to-[#d4691a] flex items-center justify-center shadow-lg">
                  <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-white" strokeWidth={2.5} />
                </div>
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-nyme-blue-light border-2 border-nyme-primary-dark animate-pulse" />
              </div>
              <div>
                <span className="font-heading text-xl sm:text-2xl font-extrabold text-white tracking-wider">NYME</span>
                <div className="hidden sm:block text-[10px] text-nyme-orange/80 font-body tracking-widest uppercase -mt-1">
                  Livraison Intelligente
                </div>
              </div>
            </Link>

            {/* ── Nav desktop ── */}
            <nav className="hidden md:flex items-center gap-4 lg:gap-7">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-body font-medium text-white/75 hover:text-nyme-orange transition-colors duration-200 relative group whitespace-nowrap ${
                    link.label === 'Partenaires' ? 'text-nyme-orange/90' : ''
                  }`}
                >
                  {link.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-nyme-orange group-hover:w-full transition-all duration-300" />
                </Link>
              ))}
            </nav>

            {/* ── CTA desktop ── */}
            <a
              href="#telecharger"
              className="hidden md:inline-flex px-4 py-2.5 lg:px-5 rounded-xl bg-gradient-to-r from-nyme-orange to-[#d4691a] text-white text-sm font-semibold font-body hover:shadow-lg hover:shadow-nyme-orange/30 transition-all duration-300 hover:-translate-y-0.5 whitespace-nowrap"
            >
              Télécharger l'app
            </a>

            {/* ── Toggle mobile ── */}
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

      {/* ── Overlay mobile ── */}
      <div
        className={`fixed inset-0 z-40 md:hidden transition-all duration-300 ${
          isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsMobileOpen(false)}
        />
        <div
          className={`absolute top-0 left-0 right-0 bg-nyme-primary-dark border-b border-nyme-orange/20 pt-20 pb-8 px-4 transition-transform duration-300 ${
            isMobileOpen ? 'translate-y-0' : '-translate-y-full'
          }`}
        >
          <nav className="flex flex-col gap-1 mb-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-4 rounded-xl transition-all font-body text-base border border-transparent hover:border-nyme-orange/15 ${
                  link.label === 'Partenaires'
                    ? 'text-nyme-orange hover:bg-nyme-orange/10'
                    : 'text-white/80 hover:text-nyme-orange hover:bg-nyme-orange/5'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-nyme-orange/60 shrink-0" />
                {link.label}
              </Link>
            ))}
          </nav>

          <a
            href="#telecharger"
            onClick={() => setIsMobileOpen(false)}
            className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-gradient-to-r from-nyme-orange to-[#d4691a] text-white font-semibold text-base shadow-lg font-body"
          >
            <Zap size={18} /> Télécharger l'app
          </a>

          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-white/30 text-xs font-body">Application en développement</span>
          </div>
        </div>
      </div>
    </>
  )
}
