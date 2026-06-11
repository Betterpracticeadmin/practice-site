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

  // Formspree form ID (e.g. "xyzabcd"), set in .env -> VITE_FORMSPREE_ID.
  // Without it, the form stays a local demo that just shows the confirmation.
  const FORMSPREE_ID = import.meta.env.VITE_FORMSPREE_ID

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const toggleUsage = (v) =>
    setForm((f) => ({ ...f, usage: f.usage.includes(v) ? f.usage.filter((x) => x !== v) : [...f.usage, v] }))

  const budgetLabel = form.budget >= 150000 ? 'premium budget' : form.budget <= 70000 ? 'essential build' : 'complete kit'

  async function submit() {
    const e = {}
    if (!form.fname.trim()) e.fname = true
    if (!form.lname.trim()) e.lname = true
    if (!form.email.trim() || !form.email.includes('@') || !form.email.includes('.')) e.email = true
    if (!form.chassis) e.chassis = true
    setErrors(e)
    if (Object.keys(e).length) return

    const ref = 'PRC-' + Math.random().toString(36).toUpperCase().slice(2, 8)

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
          _subject: `Practice — build slot request: ${form.fname} ${form.lname}`,
          reference: ref,
          firstName: form.fname,
          lastName: form.lname,
          email: form.email,
          phone: form.phone || '—',
          chassis: form.chassis,
          chassisStatus: form.chassisStatus || '—',
          usage: form.usage.join(', ') || '—',
          budget: `€${form.budget.toLocaleString('en-US')}`,
          timeline: form.timeline || '—',
          message: form.message || '—',
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.errors?.[0]?.message || 'request rejected')
      }
      setSent({ email: form.email, ref })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setSubmitError('Send failed (' + err.message + '). Please try again, or email us directly at Better-practice-@outlook.fr.')
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
            <h1 className="left-h1">Request<br /><em>received.</em></h1>
            <p className="left-sub">Thank you. Better-practice will reply within 48 hours.</p>
          </div>
          <div className="left-footer">PRACTICE /// 2026 — Build it. Drive it. Master it.</div>
        </div>
        <div className="right-panel">
          <div className="success-screen show">
            <div className="success-icon">✓</div>
            <h2>Request recorded.</h2>
            <p>We've received your build slot request.<br />Reply within 48 hours to <strong>{sent.email}</strong>.</p>
            <div className="success-ref">Reference: {sent.ref}</div>
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
          <h1 className="left-h1">Reserve<br />your <em>slot.</em></h1>
          <p className="left-sub">Slots are allocated by cohort. Tell us where you stand — chassis, usage, timeline. We get back within 48 hours.</p>

          <div className="slot-counter">
            <div className="slot-bar-wrap"><div className="slot-bar" /></div>
            <span className="slot-label">Cohort 1 — <strong>8 / 11 slots</strong></span>
          </div>

          <div className="info-cards">
            <InfoCard label="Response" val="Within 48 hours" />
            <InfoCard label="Contact" val="Better-practice-@outlook.fr" />
            <InfoCard label="Studio" val="Better-practice" />
          </div>
        </div>
        <div className="left-footer">PRACTICE /// 2026 — Build it. Drive it. Master it.</div>
      </div>

      {/* RIGHT */}
      <div className="right-panel">
        <span className="form-section-label">01 — Your details</span>
        <div className="form-row">
          <Field label="First name" id="fname" value={form.fname} onChange={(v) => set('fname', v)} error={errors.fname} placeholder="Alex" />
          <Field label="Last name" id="lname" value={form.lname} onChange={(v) => set('lname', v)} error={errors.lname} placeholder="Morgan" />
        </div>
        <div className="form-row">
          <Field label="Email" id="email" value={form.email} onChange={(v) => set('email', v)} error={errors.email} placeholder="you@email.com" errorText="Invalid email" />
          <Field label="Phone" opt id="phone" value={form.phone} onChange={(v) => set('phone', v)} placeholder="+44 7000 000000" />
        </div>

        <div className="form-divider" />

        <span className="form-section-label">02 — Donor chassis</span>
        <div className="form-group">
          <label className="field-label">Porsche 911 base</label>
          <div className="option-grid cols-3">
            <Opt value="997" label="997" sub="2004 – 2012" current={form.chassis} onPick={() => set('chassis', '997')} />
            <Opt value="991" label="991" sub="2011 – 2019" current={form.chassis} onPick={() => set('chassis', '991')} />
            <Opt value="undecided" label="Undecided" sub="Need help" current={form.chassis} onPick={() => set('chassis', 'undecided')} />
          </div>
          {errors.chassis && <div className="field-error show">Select a base</div>}
        </div>
        <Field label="Chassis status" opt id="cs" value={form.chassisStatus} onChange={(v) => set('chassisStatus', v)} placeholder="E.g. I already have a 2009 997 Carrera with 62,000 km" />

        <div className="form-divider" />

        <span className="form-section-label">03 — Intended use</span>
        <div className="form-group">
          <div className="option-grid cols-2">
            {[['trackday', 'Track day'], ['circuit', 'Circuit racing'], ['hillclimb', 'Hillclimb / rally'], ['show', 'Road & show']].map(([v, l]) => (
              <CheckOpt key={v} label={l} checked={form.usage.includes(v)} onClick={() => toggleUsage(v)} />
            ))}
          </div>
        </div>

        <div className="form-divider" />

        <span className="form-section-label">04 — Estimated total budget</span>
        <div className="form-group">
          <div className="budget-display">€{form.budget.toLocaleString('en-US')} <span>{budgetLabel}</span></div>
          <input type="range" min={60000} max={150000} step={5000} value={form.budget} onChange={(e) => set('budget', parseInt(e.target.value))} />
          <div className="budget-labels"><span>€60k</span><span>€100k</span><span>€150k+</span></div>
        </div>

        <div className="form-divider" />

        <span className="form-section-label">05 — Planned timeline</span>
        <div className="form-group">
          <div className="timeline-grid">
            <Opt value="6m" label={<>Under<br />6 months</>} current={form.timeline} onPick={() => set('timeline', '6m')} />
            <Opt value="12m" label={<>6 to<br />12 months</>} current={form.timeline} onPick={() => set('timeline', '12m')} />
            <Opt value="24m" label={<>1 to<br />2 years</>} current={form.timeline} onPick={() => set('timeline', '24m')} />
            <Opt value="open" label={<>Not yet<br />defined</>} current={form.timeline} onPick={() => set('timeline', 'open')} />
          </div>
        </div>

        <div className="form-divider" />

        <span className="form-section-label">06 — Your project</span>
        <div className="form-group">
          <label className="field-label">Tell us about your build <span className="opt">(optional)</span></label>
          <textarea value={form.message} onChange={(e) => set('message', e.target.value)} placeholder="Context, mechanical experience, specific questions about the kit or Practice AI..." />
        </div>

        <div className="form-divider" />

        <div className="submit-row">
          <p className="submit-note">By submitting this form, you agree to be contacted about your request. Your details are not shared.</p>
          <button className="submit-btn" onClick={submit} disabled={submitting}>
            {submitting ? 'Sending…' : 'Send request →'}
          </button>
        </div>
        {submitError && <div className="field-error show" style={{ marginTop: '1rem' }}>{submitError}</div>}
      </div>
    </div>
  )
}

function Field({ label, id, value, onChange, error, placeholder, opt, errorText }) {
  return (
    <div className="form-group">
      <label className="field-label" htmlFor={id}>{label}{opt && <span className="opt"> (optional)</span>}</label>
      <input id={id} className={error ? 'error' : ''} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {error && <div className="field-error show">{errorText || 'Required'}</div>}
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
