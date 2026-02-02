import React from "react";

const Terms = () => {
  return (
    <div style={styles.container}>
      <h1>Terms of Service</h1>
      <p style={styles.date}>Last updated: February 2026</p>

      <p>
        Welcome to <strong>Pulse</strong>. By accessing or using our application,
        you agree to be bound by these Terms of Service. If you do not agree to
        these terms, please do not use Pulse.
      </p>

      <h2>1. Eligibility</h2>
      <p>
        You must be at least 13 years old to use Pulse. By using the app, you
        confirm that you meet this requirement.
      </p>

      <h2>2. User Accounts</h2>
      <p>
        You are responsible for maintaining the security of your account and for
        all activities that occur under your account. Pulse is not responsible
        for any loss resulting from unauthorized access.
      </p>

      <h2>3. User Content</h2>
      <p>
        You retain ownership of the content you post on Pulse. By posting content,
        you grant Pulse a non-exclusive, royalty-free license to display,
        distribute, and promote your content within the platform.
      </p>
      <p>
        You agree not to post content that is unlawful, harmful, abusive,
        misleading, or infringes on the rights of others.
      </p>

      <h2>4. Prohibited Activities</h2>
      <p>
        You agree not to misuse Pulse, including attempting to gain unauthorized
        access, disrupting the service, or using the platform for illegal
        activities.
      </p>

      <h2>5. Termination</h2>
      <p>
        Pulse reserves the right to suspend or terminate accounts that violate
        these Terms or harm the community.
      </p>

      <h2>6. Disclaimer</h2>
      <p>
        Pulse is provided on an “as is” basis. We make no guarantees regarding
        availability, reliability, or accuracy of the service.
      </p>

      <h2>7. Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. Continued use of Pulse after
        changes means you accept the updated Terms.
      </p>

      <h2>8. Contact</h2>
      <p>
        If you have questions about these Terms, please contact us through the
        Pulse app.
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

export default Terms;
