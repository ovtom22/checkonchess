export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 720, margin: '60px auto', padding: '0 24px' }}>
      <h1 style={{ fontWeight: 800, fontSize: '2rem', marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: 40 }}>Last updated: April 2026</p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: 12 }}>1. Information We Collect</h2>
        <p style={{ color: '#ccc', lineHeight: 1.8 }}>
          We collect information you provide when registering, such as your username, email address, and password.
          If you sign in with Google or GitHub, we receive basic profile information from those services (name, email, avatar).
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: 12 }}>2. How We Use Your Information</h2>
        <p style={{ color: '#ccc', lineHeight: 1.8 }}>
          We use your information to provide and improve the CheckOnChess service, including managing your account,
          recording game history, and sending account-related emails (verification, password reset).
          We do not sell your personal data to third parties.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: 12 }}>3. Data Storage</h2>
        <p style={{ color: '#ccc', lineHeight: 1.8 }}>
          Your data is stored securely on servers hosted by Railway. Passwords are hashed and never stored in plain text.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: 12 }}>4. Third-Party Services</h2>
        <p style={{ color: '#ccc', lineHeight: 1.8 }}>
          We use Google and GitHub OAuth for authentication. By using these sign-in options, you agree to their respective
          privacy policies. We use Resend for transactional emails.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: 12 }}>5. Cookies</h2>
        <p style={{ color: '#ccc', lineHeight: 1.8 }}>
          We use minimal cookies and local storage to keep you logged in. We do not use tracking or advertising cookies.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: 12 }}>6. Your Rights</h2>
        <p style={{ color: '#ccc', lineHeight: 1.8 }}>
          You may request deletion of your account and associated data at any time by contacting us.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: 12 }}>7. Contact</h2>
        <p style={{ color: '#ccc', lineHeight: 1.8 }}>
          For privacy-related questions, contact us at: <a href="mailto:contact@checkonchess.com" style={{ color: 'white' }}>contact@checkonchess.com</a>
        </p>
      </section>
    </div>
  )
}
