import { useState } from 'react'

export default function Contact() {
  const [form, setForm] = useState({
    fname: '', lname: '', email: '', phone: '',
    chassis: '', chassisStatus: '',
    usage: [], budget: 80000, timeline: '', message: '',
  })
  const [errors, setErrors] = useState({})
  const [sent, setSent] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // ID du formulaire Formspree (ex: "xyzabcd"). Renseigné dans .env -> VITE_FORMSPREE_ID.
  // Sans lui, le formulaire reste une démo locale qui affiche juste la confirmation.
  const FORMSPREE_ID = import.meta.env.VITE_FORMSPREE_ID

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const toggleUsage = (v) =>
    setForm((f) => ({ ...f, usage: f.usage.includes(v) ? f.usage.filter((x) => x !== v) : [...f.usage, v] }))

  const budgetLabel = form.budget >= 150000 ? 'budget premium' : form.budget <= 70000 ? 'build essentiel' : 'kit complet'

  async function submit() {
    const e = {}
    if (!form.fname.trim()) e.fname = true
    if (!form.lname.trim()) e.lname = true
    if (!form.email.trim() || !form.email.includes('@') || !form.email.includes('.')) e.email = true
    if (!form.chassis) e.chassis = true
    setErrors(e)
    if (Object.keys(e).length) return

    const ref = 'PRC-' + Math.random().toString(36).toUpperCase().slice(2, 8)

    // Sans Formspree configuré : démo locale (affiche juste la confirmation).
    if (!FORMSPREE_ID) {
      setSent({ email: form.email, ref })
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          _subject: `Practice — demande de build slot : ${form.fname} ${form.lname}`,
          reference: ref,
          prenom: form.fname,
          nom: form.lname,
          email: form.email,
          telephone: form.phone || '—',
          chassis: form.chassis,
          statut_chassis: form.chassisStatus || '—',
          usage: form.usage.join(', ') || '—',
          budget: `€ ${form.budget.toLocaleString('fr-FR')}`,
          calendrier: form.timeline || '—',
          message: form.message || '—',
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.errors?.[0]?.message || 'envoi refusé')
      }
      setSent({ email: form.email, ref })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setSubmitError(
        "Échec de l'envoi (" + err.message + '). Réessaie, ou écris directement à Better-practice-@outlook.fr.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <div className="contact-page">
        <div className="left-panel">
          <div className="left-grid" />
          <div className="left-content">
            <p className="left-eyebrow">/// Build slot</p>
            <h1 className="left-h1">Demande<br /><em>reçue.</em></h1>
            <p className="left-sub">Merci. Alessandro vous répond sous 48 heures.</p>
          </div>
          <div className="left-footer">PRACTICE /// 2026 — Build it. Drive it. Master it.</div>
        </div>
        <div className="right-panel">
          <div className="success-screen show">
            <div className="success-icon">✓</div>
            <h2>Demande enregistrée.</h2>
            <p>Nous avons bien reçu votre demande de build slot.<br />Réponse sous 48 heures à <strong>{sent.email}</strong>.</p>
            <div className="success-ref">Référence : {sent.ref}</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="contact-page">
      {/* LEFT */}
      <div className="left-panel">
        <div className="left-grid" />
        <div className="left-content">
          <p className="left-eyebrow">/// Build slot</p>
          <h1 className="left-h1">Réservez<br />votre <em>slot.</em></h1>
          <p className="left-sub">Les slots sont alloués par cohorte. Dites-nous où vous en êtes — châssis, usage, calendrier. Nous revenons sous 48 heures.</p>

          <div className="slot-counter">
            <div className="slot-bar-wrap"><div className="slot-bar" /></div>
            <span className="slot-label">Cohorte 1 — <strong>8 / 11 slots</strong></span>
          </div>

          <div className="info-cards">
            <InfoCard label="Réponse" val="Sous 48 heures" />
            <InfoCard label="Contact" val="Better-practice-@outlook.fr" />
            <InfoCard label="Studio" val="Alessandro Pascal — Betterstate" />
          </div>
        </div>
        <div className="left-footer">PRACTICE /// 2026 — Build it. Drive it. Master it.</div>
      </div>

      {/* RIGHT */}
      <div className="right-panel">
        <span className="form-section-label">01 — Vos coordonnées</span>
        <div className="form-row">
          <Field label="Prénom" id="fname" value={form.fname} onChange={(v) => set('fname', v)} error={errors.fname} placeholder="Alessandro" />
          <Field label="Nom" id="lname" value={form.lname} onChange={(v) => set('lname', v)} error={errors.lname} placeholder="Pascal" />
        </div>
        <div className="form-row">
          <Field label="Email" id="email" value={form.email} onChange={(v) => set('email', v)} error={errors.email} placeholder="vous@email.com" />
          <Field label="Téléphone" opt id="phone" value={form.phone} onChange={(v) => set('phone', v)} placeholder="+33 6 00 00 00 00" />
        </div>

        <div className="form-divider" />

        <span className="form-section-label">02 — Châssis donor</span>
        <div className="form-group">
          <label className="field-label">Base Porsche 911</label>
          <div className="option-grid cols-3">
            <Opt name="chassis" value="997" label="997" sub="2004 – 2012" current={form.chassis} onPick={() => set('chassis', '997')} />
            <Opt name="chassis" value="991" label="991" sub="2011 – 2019" current={form.chassis} onPick={() => set('chassis', '991')} />
            <Opt name="chassis" value="undecided" label="À décider" sub="Aide souhaitée" current={form.chassis} onPick={() => set('chassis', 'undecided')} />
          </div>
          {errors.chassis && <div className="field-error show">Sélectionnez une base</div>}
        </div>
        <Field label="Statut du châssis" opt id="cs" value={form.chassisStatus} onChange={(v) => set('chassisStatus', v)} placeholder="Ex : j'ai déjà un 997 Carrera 2009 à 62 000 km" />

        <div className="form-divider" />

        <span className="form-section-label">03 — Usage prévu</span>
        <div className="form-group">
          <div className="option-grid cols-2">
            {[['trackday', 'Track day'], ['circuit', 'Circuit racing'], ['hillclimb', 'Hillclimb / rally'], ['show', 'Road & show']].map(([v, l]) => (
              <CheckOpt key={v} label={l} checked={form.usage.includes(v)} onClick={() => toggleUsage(v)} />
            ))}
          </div>
        </div>

        <div className="form-divider" />

        <span className="form-section-label">04 — Budget total estimé</span>
        <div className="form-group">
          <div className="budget-display">€ {form.budget.toLocaleString('fr-FR')} <span>{budgetLabel}</span></div>
          <input type="range" min={60000} max={150000} step={5000} value={form.budget} onChange={(e) => set('budget', parseInt(e.target.value))} />
          <div className="budget-labels"><span>€ 60k</span><span>€ 100k</span><span>€ 150k+</span></div>
        </div>

        <div className="form-divider" />

        <span className="form-section-label">05 — Calendrier envisagé</span>
        <div className="form-group">
          <div className="timeline-grid">
            <Opt name="timeline" value="6m" label={<>Moins de<br />6 mois</>} current={form.timeline} onPick={() => set('timeline', '6m')} />
            <Opt name="timeline" value="12m" label={<>6 à<br />12 mois</>} current={form.timeline} onPick={() => set('timeline', '12m')} />
            <Opt name="timeline" value="24m" label={<>1 à<br />2 ans</>} current={form.timeline} onPick={() => set('timeline', '24m')} />
            <Opt name="timeline" value="open" label={<>Pas encore<br />défini</>} current={form.timeline} onPick={() => set('timeline', 'open')} />
          </div>
        </div>

        <div className="form-divider" />

        <span className="form-section-label">06 — Votre projet</span>
        <div className="form-group">
          <label className="field-label">Parlez-nous de votre build <span className="opt">(optionnel)</span></label>
          <textarea value={form.message} onChange={(e) => set('message', e.target.value)} placeholder="Contexte, expérience mécanique, questions spécifiques sur le kit ou la Practice AI..." />
        </div>

        <div className="form-divider" />

        <div className="submit-row">
          <p className="submit-note">En soumettant ce formulaire, vous acceptez d'être recontacté au sujet de votre demande. Vos coordonnées ne sont pas partagées.</p>
          <button className="submit-btn" onClick={submit} disabled={submitting}>
            {submitting ? 'Envoi…' : 'Envoyer la demande →'}
          </button>
        </div>
        {submitError && <div className="field-error show" style={{ marginTop: '1rem' }}>{submitError}</div>}
      </div>
    </div>
  )
}

function Field({ label, id, value, onChange, error, placeholder, opt }) {
  return (
    <div className="form-group">
      <label className="field-label" htmlFor={id}>{label}{opt && <span className="opt"> (optionnel)</span>}</label>
      <input id={id} className={error ? 'error' : ''} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {error && <div className="field-error show">Requis</div>}
    </div>
  )
}
function Opt({ value, label, sub, current, onPick }) {
  return (
    <label className="option-btn">
      <input type="radio" checked={current === value} onChange={onPick} />
      <span className="option-label">{label}{sub && <span className="sub">{sub}</span>}</span>
    </label>
  )
}
function CheckOpt({ label, checked, onClick }) {
  return (
    <label className="option-btn">
      <input type="checkbox" checked={checked} onChange={onClick} />
      <span className="option-label">{label}</span>
    </label>
  )
}
function InfoCard({ label, val }) {
  return (
    <div className="info-card">
      <div className="info-icon" />
      <div><div className="info-card-label">{label}</div><div className="info-card-val">{val}</div></div>
    </div>
  )
}
