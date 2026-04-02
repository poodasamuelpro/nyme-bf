// src/app/api/admin/create-partenaire/route.ts
// Endpoint réservé admin — crée un compte partenaire avec mdp auto + envoi email 
// Utilise SUPABASE_SERVICE_ROLE_KEY (bypass RLS)
// Envoi d'email : Resend (prioritaire) → Brevo (fallback) 

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Types pour Brevo
interface BrevoConfig {
  apiKey: string
  senderEmail: string
  senderName: string
}

// Configuration Brevo
const brevoConfig: BrevoConfig = {
  apiKey: process.env.BREVO_API_KEY || '',
  senderEmail: process.env.BREVO_SENDER_EMAIL || 'nyme.contact@gmail.com',
  senderName: process.env.BREVO_SENDER_NAME || 'NYME',
}

// Générer un mot de passe fort aléatoire
function genPassword(length = 16): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// Vérifier si Resend est configuré et fonctionnel
async function isResendAvailable(): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey || apiKey === '') return false
  
  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)
    // Test simple : essayer de récupérer la liste des emails (ou juste vérifier que l'API répond)
    const result = await resend.domains.list()
    return !('error' in result)
  } catch {
    return false
  }
}

// Envoi d'email via Resend
async function sendWithResend(to: string, subject: string, html: string, from?: string): Promise<boolean> {
  try {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY || '')
    
    await resend.emails.send({
      from: from || 'NYME <nyme.contact@gmail.com>',
      to,
      subject,
      html,
    })
    console.log(`[Resend] Email envoyé à ${to}`)
    return true
  } catch (error) {
    console.warn(`[Resend] Échec pour ${to}:`, error)
    return false
  }
}

// Envoi d'email via Brevo (API v3)
async function sendWithBrevo(to: string, subject: string, html: string): Promise<boolean> {
  if (!brevoConfig.apiKey) {
    console.warn('[Brevo] Clé API manquante')
    return false
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': brevoConfig.apiKey,
      },
      body: JSON.stringify({
        sender: {
          email: brevoConfig.senderEmail,
          name: brevoConfig.senderName,
        },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    })

    if (response.ok) {
      console.log(`[Brevo] Email envoyé à ${to}`)
      return true
    }

    const errorData = await response.json()
    console.warn(`[Brevo] Échec pour ${to}:`, errorData)
    return false
  } catch (error) {
    console.warn(`[Brevo] Erreur pour ${to}:`, error)
    return false
  }
}

// Envoi d'email avec fallback automatique
async function sendEmail(to: string, subject: string, html: string, from?: string): Promise<{ success: boolean; provider: string }> {
  // Priorité à Resend
  const resendAvailable = await isResendAvailable()
  
  if (resendAvailable) {
    const resendSuccess = await sendWithResend(to, subject, html, from)
    if (resendSuccess) {
      return { success: true, provider: 'resend' }
    }
  }
  
  // Fallback vers Brevo
  const brevoSuccess = await sendWithBrevo(to, subject, html)
  if (brevoSuccess) {
    return { success: true, provider: 'brevo' }
  }
  
  return { success: false, provider: 'none' }
}

export async function POST(req: Request) {
  try {
    // 1. Vérifier que l'appelant est admin (via cookie de session)
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: 'Non autorisé — token manquant' }, { status: 401 })
    }

    const { createClient } = await import('@supabase/supabase-js')
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
    const body = await req.json()
    const { entreprise, nom_contact, email, telephone, plan, adresse } = body

    if (!entreprise || !nom_contact || !email) {
      return NextResponse.json({ error: 'entreprise, nom_contact et email sont requis' }, { status: 400 })
    }

    // 3. Générer un mot de passe automatique
    const mdpAuto = genPassword(14)

    // 4. Créer le compte Supabase Auth (avec service_role → bypass email confirm)
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: mdpAuto,
      email_confirm: true,
      user_metadata: {
        role: 'partenaire',
        nom: nom_contact.trim(),
      },
    })

    if (authErr) {
      return NextResponse.json({ error: `Erreur Auth: ${authErr.message}` }, { status: 400 })
    }

    const userId = authData.user.id

    // 5. Insérer dans utilisateurs avec rôle partenaire FORCÉ
    const { error: userErr } = await supabaseAdmin
      .from('utilisateurs')
      .upsert({
        id: userId,
        nom: nom_contact.trim(),
        telephone: telephone?.trim() || null,
        email: email.trim().toLowerCase(),
        role: 'partenaire',
        est_verifie: true,
        est_actif: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })

    if (userErr) console.warn('[admin] upsert utilisateur:', userErr.message)

    // 6. Créer le profil partenaire
    const planConfig = {
      starter: { livraisons_max: 30, taux: 12.0 },
      business: { livraisons_max: 100, taux: 10.0 },
      enterprise: { livraisons_max: 9999, taux: 8.0 },
    }
    const cfg = planConfig[plan as keyof typeof planConfig] || planConfig.starter

    const { data: partData, error: partErr } = await supabaseAdmin
      .from('partenaires')
      .insert({
        user_id: userId,
        entreprise: entreprise.trim(),
        nom_contact: nom_contact.trim(),
        telephone: telephone?.trim() || null,
        email_pro: email.trim().toLowerCase(),
        adresse: adresse?.trim() || null,
        plan: plan || 'starter',
        statut: 'actif',
        livraisons_max: cfg.livraisons_max,
        livraisons_mois: 0,
        taux_commission: cfg.taux,
        date_debut: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (partErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: `Erreur profil partenaire: ${partErr.message}` }, { status: 400 })
    }

    // 7. Préparer l'email HTML
    const dashboardUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://nyme.app'}/partenaires/login`
    const year = new Date().getFullYear()

    const emailHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#F8FAFF;padding:32px;border-radius:16px;border:1px solid #E2E8F0">
        <div style="text-align:center;margin-bottom:24px">
          <div style="display:inline-block;background:linear-gradient(135deg,#E87722,#F59343);padding:10px 24px;border-radius:12px">
            <span style="color:white;font-weight:900;font-size:22px;letter-spacing:3px">NYME</span>
          </div>
        </div>
        <h2 style="color:#1E293B;margin-bottom:8px">Bienvenue sur l'Espace Partenaires, ${nom_contact.trim()} ! 🎉</h2>
        <p style="color:#64748B;line-height:1.7;margin-bottom:20px">
          Votre compte partenaire NYME a été créé pour <strong>${entreprise.trim()}</strong>.<br/>
          Voici vos informations de connexion :
        </p>
        <div style="background:#0A2E8A;border-radius:12px;padding:20px;margin-bottom:24px">
          <div style="margin-bottom:12px">
            <div style="color:#93C5FD;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Email</div>
            <div style="color:#fff;font-size:15px;font-weight:600">${email.trim().toLowerCase()}</div>
          </div>
          <div style="margin-bottom:12px">
            <div style="color:#93C5FD;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Mot de passe temporaire</div>
            <div style="color:#E87722;font-size:18px;font-weight:900;letter-spacing:2px;font-family:monospace">${mdpAuto}</div>
          </div>
          <div>
            <div style="color:#93C5FD;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Plan</div>
            <div style="color:#fff;font-size:14px;font-weight:600">${(plan || 'starter').charAt(0).toUpperCase() + (plan || 'starter').slice(1)} — ${cfg.livraisons_max} livraisons/mois</div>
          </div>
        </div>
        <div style="background:#FEF3C7;border:1px solid #FCD34D;border-radius:12px;padding:14px;margin-bottom:20px">
          <p style="color:#92400E;font-size:13px;margin:0">
            ⚠️ <strong>Changez votre mot de passe</strong> lors de votre première connexion pour sécuriser votre compte.
          </p>
        </div>
        <div style="text-align:center;margin-bottom:20px">
          <a href="${dashboardUrl}" style="display:inline-block;background:linear-gradient(135deg,#E87722,#F59343);color:white;font-weight:700;padding:14px 32px;border-radius:12px;text-decoration:none;font-size:15px">
            Accéder à mon dashboard →
          </a>
        </div>
        <div style="background:#F0F4FF;border-radius:12px;padding:14px;margin-bottom:16px">
          <p style="color:#64748B;font-size:12px;margin:0">
            🔗 Lien de connexion : <a href="${dashboardUrl}" style="color:#1A4FBF">${dashboardUrl}</a>
          </p>
        </div>
        <hr style="border:none;border-top:1px solid #E2E8F0;margin:20px 0"/>
        <p style="text-align:center;color:#94A3B8;font-size:11px">
          © ${year} NYME · Ouagadougou, Burkina Faso · nyme.contact@gmail.com
        </p>
      </div>
    `

    const adminEmailHtml = `
      <div style="font-family:sans-serif;padding:20px;background:#F8FAFF;border-radius:12px">
        <h3 style="color:#1A4FBF">Nouveau partenaire créé</h3>
        <p><b>Entreprise :</b> ${entreprise.trim()}</p>
        <p><b>Contact :</b> ${nom_contact.trim()}</p>
        <p><b>Email :</b> ${email.trim().toLowerCase()}</p>
        <p><b>Plan :</b> ${plan || 'starter'}</p>
        <p><b>Mot de passe envoyé :</b> <code style="background:#F0F4FF;padding:2px 6px;border-radius:4px">${mdpAuto}</code></p>
        <p style="color:#64748B;font-size:12px">Créé le ${new Date().toLocaleDateString('fr-FR')}</p>
      </div>
    `

    // 8. Envoyer les emails avec fallback automatique
    const emailResults = {
      partenaire: await sendEmail(
        email.trim().toLowerCase(),
        `🎉 Bienvenue sur NYME Partenaires — ${entreprise.trim()}`,
        emailHtml
      ),
      admin: await sendEmail(
        'nyme.contact@gmail.com',
        `[NYME Admin] Nouveau partenaire créé : ${entreprise.trim()}`,
        adminEmailHtml
      ),
    }

    // 9. Vérifier si au moins un email a été envoyé avec succès
    const anySuccess = emailResults.partenaire.success || emailResults.admin.success
    
    if (!anySuccess) {
      console.warn('[admin] Aucun email n\'a pu être envoyé (Resend + Brevo indisponibles)')
    }

    return NextResponse.json({
      success: true,
      message: `Partenaire créé. Email d'invitation envoyé à ${email} (via ${emailResults.partenaire.provider || 'aucun'})`,
      partenaire_id: partData.id,
      user_id: userId,
      email_status: emailResults,
    }, { status: 201 })

  } catch (err: any) {
    console.error('[admin/create-partenaire]', err)
    return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 })
  }
}