export default function Privacy() {
  return (
    <div className="legal">
      <h1>Privacy</h1>
      <p className="legal-sub">Privacy Policy — last updated: June 11, 2026</p>

      <p>
        At <strong>Better-practice</strong>, we care about your privacy. This policy explains what
        data we collect through the Practice website, why, and what your rights are.
      </p>

      <h2>1. Data controller</h2>
      <p>
        The data controller is <strong>Better-practice</strong>. For any question about your data,
        you can write to us at{' '}
        <a href="mailto:Better-practice-@outlook.fr">Better-practice-@outlook.fr</a>.
      </p>

      <h2>2. Data we collect</h2>
      <p>We only collect the data you choose to share with us:</p>
      <ul>
        <li><strong>Contact form</strong>: first name, last name, email address, phone (optional), and your project details (chassis, usage, budget, message).</li>
        <li><strong>Practice AI assistant</strong>: the content of the messages you send to the chatbot, for the time needed to generate a reply.</li>
      </ul>
      <p>We do not collect browsing data for advertising purposes and we do not use tracking cookies.</p>

      <h2>3. Why we use this data</h2>
      <ul>
        <li>To respond to your build slot request and get back to you.</li>
        <li>To provide you with information about the Practice project.</li>
        <li>To run the Practice AI assistant (answering your questions).</li>
      </ul>
      <p>The legal basis is your consent and our legitimate interest in handling your requests.</p>

      <h2>4. Providers and sharing</h2>
      <p>Your data is never sold. It may pass through technical providers strictly necessary to run the site:</p>
      <ul>
        <li><strong>Formspree</strong> — routing contact form messages to our mailbox.</li>
        <li><strong>Anthropic (Claude)</strong> — processing messages sent to the Practice AI assistant.</li>
        <li><strong>Vercel</strong> — website hosting.</li>
      </ul>

      <h2>5. Retention</h2>
      <p>
        Contact requests are kept for as long as needed to handle your request, then archived or
        deleted. Conversations with the chatbot are not durably stored on the site.
      </p>

      <h2>6. Your rights</h2>
      <p>
        Under the GDPR, you have the right to access, rectify, erase, restrict and object to the
        processing of your data. To exercise these rights, email us at{' '}
        <a href="mailto:Better-practice-@outlook.fr">Better-practice-@outlook.fr</a>.
      </p>

      <h2>7. Changes</h2>
      <p>This policy may be updated. The last-updated date appears at the top of this page.</p>

      <div className="legal-note">
        ℹ️ This document is a basic template provided for information only. For a commercial
        activity, we recommend having it reviewed by a legal professional to tailor it precisely to
        your situation.
      </div>
    </div>
  )
}
