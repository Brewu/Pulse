import React from "react";

const PrivacyPolicy = () => {
  return (
    <div style={styles.container}>
      <h1>Privacy Policy</h1>
      <p style={styles.date}>Last updated: February 2026</p>

      <p>
        Your privacy matters to us. This Privacy Policy explains how
        <strong> Pulse</strong> collects, uses, and protects your information.
      </p>

      <h2>1. Information We Collect</h2>
      <p>
        We may collect information you provide directly, such as your name,
        email address, username, profile picture, and content you post.
      </p>

      <h2>2. How We Use Your Information</h2>
      <p>
        We use your information to:
        <ul>
          <li>Provide and improve Pulse</li>
          <li>Authenticate users</li>
          <li>Personalize user experience</li>
          <li>Maintain community safety</li>
        </ul>
      </p>

      <h2>3. Firebase & Third-Party Services</h2>
      <p>
        Pulse uses third-party services such as Firebase for authentication,
        database storage, and analytics. These services may collect information
        in accordance with their own privacy policies.
      </p>

      <h2>4. Data Sharing</h2>
      <p>
        We do not sell your personal data. We only share information when
        required to operate the service or comply with legal obligations.
      </p>

      <h2>5. Data Security</h2>
      <p>
        We take reasonable measures to protect your data, but no method of
        transmission over the internet is 100% secure.
      </p>

      <h2>6. Your Rights</h2>
      <p>
        You may update or delete your account information at any time through
        the app. You may also stop using Pulse if you disagree with this policy.
      </p>

      <h2>7. Children’s Privacy</h2>
      <p>
        Pulse is not intended for children under the age of 13. We do not
        knowingly collect personal data from children.
      </p>

      <h2>8. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Continued use of
        Pulse means you accept the updated policy.
      </p>

      <h2>9. Contact Us</h2>
      <p>
        If you have questions about this Privacy Policy, please contact us
        through the Pulse app.
      </p>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: "800px",
    margin: "0 auto",
    padding: "24px",
    lineHeight: 1.7,
  },
  date: {
    color: "#888",
    fontSize: "14px",
  },
};

export default PrivacyPolicy;
