export default function Privacy() {
  return (
    <div className="legal">
      <h1>Confidentialité</h1>
      <p className="legal-sub">Politique de confidentialité — dernière mise à jour : 11 juin 2026</p>

      <p>
        Chez <strong>Better-practice</strong>, nous attachons une grande importance au respect
        de votre vie privée. Cette politique explique quelles données nous collectons via le site
        Practice, pourquoi, et quels sont vos droits.
      </p>

      <h2>1. Responsable du traitement</h2>
      <p>
        Le responsable du traitement des données est <strong>Better-practice</strong>.
        Pour toute question relative à vos données, vous pouvez nous écrire à{' '}
        <a href="mailto:Better-practice-@outlook.fr">Better-practice-@outlook.fr</a>.
      </p>

      <h2>2. Données que nous collectons</h2>
      <p>Nous ne collectons que les données que vous nous transmettez volontairement :</p>
      <ul>
        <li><strong>Formulaire de contact</strong> : prénom, nom, adresse email, téléphone (facultatif), ainsi que les informations relatives à votre projet (châssis, usage, budget, message).</li>
        <li><strong>Assistant Practice AI</strong> : le contenu des messages que vous envoyez au chatbot, le temps de générer une réponse.</li>
      </ul>
      <p>
        Nous ne collectons aucune donnée de navigation à des fins publicitaires et n'utilisons
        pas de cookies de pistage.
      </p>

      <h2>3. Pourquoi nous utilisons ces données</h2>
      <ul>
        <li>Répondre à votre demande de build slot et vous recontacter.</li>
        <li>Vous fournir des informations sur le projet Practice.</li>
        <li>Faire fonctionner l'assistant Practice AI (répondre à vos questions).</li>
      </ul>
      <p>La base légale est votre consentement et notre intérêt légitime à traiter vos demandes.</p>

      <h2>4. Prestataires et partage</h2>
      <p>Vos données ne sont jamais vendues. Elles peuvent transiter par des prestataires techniques strictement nécessaires au fonctionnement du site :</p>
      <ul>
        <li><strong>Formspree</strong> — acheminement des messages du formulaire de contact vers notre boîte mail.</li>
        <li><strong>Anthropic (Claude)</strong> — traitement des messages envoyés à l'assistant Practice AI.</li>
        <li><strong>Vercel</strong> — hébergement du site.</li>
      </ul>

      <h2>5. Durée de conservation</h2>
      <p>
        Les demandes de contact sont conservées le temps nécessaire au traitement de votre
        demande, puis archivées ou supprimées. Les échanges avec le chatbot ne sont pas conservés
        de manière durable sur le site.
      </p>

      <h2>6. Vos droits</h2>
      <p>
        Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement,
        de limitation et d'opposition au traitement de vos données. Pour exercer ces droits,
        écrivez-nous à <a href="mailto:Better-practice-@outlook.fr">Better-practice-@outlook.fr</a>.
      </p>

      <h2>7. Modifications</h2>
      <p>
        Cette politique peut être mise à jour. La date de dernière mise à jour figure en haut de
        cette page.
      </p>

      <div className="legal-note">
        ℹ️ Ce document est un modèle de base fourni à titre informatif. Pour une activité
        commerciale, il est recommandé de le faire valider par un professionnel du droit afin de
        l'adapter précisément à votre situation.
      </div>
    </div>
  )
}
