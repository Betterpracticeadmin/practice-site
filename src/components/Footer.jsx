import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="footer">
      <div>
        <div className="footer-brand">PRACTICE</div>
        <div className="footer-tag">Build it /// Drive it /// Master it</div>
      </div>
      <div className="footer-links">
        <a href="mailto:Better-practice-@outlook.fr">Better-practice-@outlook.fr</a>
        <Link to="/confidentialite">Privacy Policy</Link>
      </div>
      <div className="footer-bottom">
        <p>© 2026 Better-practice — All rights reserved.</p>
        <p>Better-practice /// 2026</p>
      </div>
    </footer>
  )
}
