// src/app/api/admin/create-admin/route.ts
// Crée un compte administrateur avec mot de passe auto-généré
// Envoie les credentials par email (Resend → Brevo fallback)

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@supabase/supabase-js'

function genPassword(length = 14): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  // Essayer Resend d'abord
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    try {
      const { Resend } = await import('resend')
      const resend = new Resend(resendKey)
      await resend.emails.send({
        from: 'NYME <nyme.contact@gmail.com>',
        to, subject, html,
      })
      return true
    } catch {}
  }

  // Fallback Brevo
  const brevoKey = process.env.BREVO_API_KEY
  if (brevoKey) {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': brevoKey },
        body: JSON.stringify({
          sender: { email: process.env.BREVO_SENDER_EMAIL || 'nyme.contact@gmail.com', name: 'NYME' },
          to: [{ email: to }],
          subject,
          htmlContent: html,
        }),
      })
      return res.ok
    } catch {}
  }

  console.warn('[sendEmail] Aucun service email configuré')
  return false
}

export async function POST(req: Request) {
  try {
    // 1. Vérifier l'authentification admin
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const supabaseCheck = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { data: { user: caller } } = await supabaseCheck.auth.getUser(token)
    if (!caller) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { data: callerRow } = await supabaseAdmin
      .from('utilisateurs').select('role').eq('id', caller.id).single()
    if (callerRow?.role !== 'admin') {
      return NextResponse.json({ error: 'Accès refusé — rôle admin requis' }, { status: 403 })
    }

    // 2. Parser le body
    const { email, nom } = await req.json()
    if (!email || !nom) {
      return NextResponse.json({ error: 'email et nom sont requis' }, { status: 400 })
    }

    const mdpAuto = genPassword(14)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nyme.bf'

    // 3. Créer le compte Auth
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: mdpAuto,
      email_confirm: true,
      user_metadata: {
        role: 'admin',
        nom: nom.trim(),
      },
    })

    if (authErr) {
      return NextResponse.json({ error: `Erreur Auth: ${authErr.message}` }, { status: 400 })
    }

    const userId = authData.user.id

    // 4. Insérer dans utilisateurs avec rôle admin
    const { error: userErr } = await supabaseAdmin
      .from('utilisateurs')
      .upsert({
        id:          userId,
        nom:         nom.trim(),
        email:       email.trim().toLowerCase(),
        role:        'admin',
        est_verifie: true,
        est_actif:   true,
        created_at:  new Date().toISOString(),
        updated_at:  new Date().toISOString(),
      }, { onConflict: 'id' })

    if (userErr) {
      console.warn('[create-admin] upsert utilisateurs:', userErr.message)
    }

    // 5. Envoyer l'email
    const emailHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#F8FAFF;padding:32px;border-radius:16px;border:1px solid #E2E8F0">
        <div style="text-align:center;margin-bottom:24px">
          <div style="display:inline-block;background:linear-gradient(135deg,#E87722,#F59343);padding:10px 24px;border-radius:12px">
            <span style="color:white;font-weight:900;font-size:22px;letter-spacing:3px">NYME</span>
          </div>
        </div>
        <h2 style="color:#1E293B;margin-bottom:8px">Bienvenue dans l'équipe NYME Admin, ${nom.trim()} ! 🛡️</h2>
        <p style="color:#64748B;line-height:1.7;margin-bottom:20px">
          Votre compte administrateur NYME a été créé. Voici vos identifiants :
        </p>
        <div style="background:#0A2E8A;border-radius:12px;padding:20px;margin-bottom:24px">
          <div style="margin-bottom:12px">
            <div style="color:#93C5FD;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Email</div>
            <div style="color:#fff;font-size:15px;font-weight:600">${email.trim().toLowerCase()}</div>
          </div>
          <div>
            <div style="color:#93C5FD;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Mot de passe temporaire</div>
            <div style="color:#E87722;font-size:18px;font-weight:900;letter-spacing:2px;font-family:monospace">${mdpAuto}</div>
          </div>
        </div>
        <div style="background:#FEF3C7;border:1px solid #FCD34D;border-radius:12px;padding:14px;margin-bottom:20px">
          <p style="color:#92400E;font-size:13px;margin:0">
            ⚠️ Changez votre mot de passe lors de votre première connexion.
          </p>
        </div>
        <div style="text-align:center;margin-bottom:20px">
          <a href="${siteUrl}/admin-x9k2m/login" style="display:inline-block;background:linear-gradient(135deg,#E87722,#F59343);color:white;font-weight:700;padding:14px 32px;border-radius:12px;text-decoration:none">
            Accéder au dashboard admin →
          </a>
        </div>
        <p style="text-align:center;color:#94A3B8;font-size:11px">© ${new Date().getFullYear()} NYME · Ouagadougou, Burkina Faso</p>
      </div>
    `

    const emailSent = await sendEmail(
      email.trim().toLowerCase(),
      '🛡️ Vos accès NYME Administrateur',
      emailHtml
    )

    return NextResponse.json({
      success: true,
      message: `✅ Compte admin créé pour ${nom}. Email ${emailSent ? 'envoyé' : 'non envoyé (configurer RESEND_API_KEY ou BREVO_API_KEY)'}.`,
      user_id: userId,
      email_sent: emailSent,
    }, { status: 201 })

  } catch (err: any) {
    console.error('[admin/create-admin]', err)
    return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 })
  }
}
