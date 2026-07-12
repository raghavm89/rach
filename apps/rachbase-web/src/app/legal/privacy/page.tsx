import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Rach Dev LLP privacy policy. How we collect, use, and protect your data.",
};

export default function PrivacyPolicyPage() {
  return (
    <>
      <div className="mb-6 inline-block rounded-full border border-line bg-band px-3 py-1 text-xs font-medium text-ink-3">
        Last updated: March 2026
      </div>

      <h1 className="font-display text-3xl font-bold text-ink">
        Privacy Policy
      </h1>

      <div className="mt-8 space-y-8">
        {/* 1. Introduction */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            1. Introduction
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              We at Rach Dev LLP (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)
              respect your privacy and are committed to protecting your personal
              data. This Privacy Policy explains how we collect, use, store, and
              share information when you use our platform, website, APIs, and
              related services (collectively, the &quot;Services&quot;).
            </p>
            <p>
              By accessing or using our Services, you acknowledge that you have
              read and understood this Privacy Policy. If you do not agree with
              our practices, please do not use our Services.
            </p>
          </div>
        </section>

        {/* 2. Information We Collect */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            2. Information We Collect
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>We collect the following categories of information:</p>
            <p className="font-semibold text-ink">
              Account Information
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Name, email address, and password when you create an account
              </li>
              <li>Organization name and billing address for paid plans</li>
              <li>
                Payment information processed securely through Stripe (we do not
                store full card numbers)
              </li>
            </ul>
            <p className="font-semibold text-ink">Usage Data</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                API call volume, feature usage patterns, and agent interaction
                logs
              </li>
              <li>Database queries and storage consumption metrics</li>
              <li>
                Error logs and performance data used to improve service
                reliability
              </li>
            </ul>
            <p className="font-semibold text-ink">Technical Data</p>
            <ul className="list-disc list-inside space-y-1">
              <li>IP address, browser type, and device information</li>
              <li>Operating system and screen resolution</li>
              <li>Referring URL and pages visited on our site</li>
              <li>Cookies and similar tracking identifiers</li>
            </ul>
          </div>
        </section>

        {/* 3. How We Use Your Information */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            3. How We Use Your Information
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>We use the information we collect to:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Provide, maintain, and improve the Rach Dev LLP platform and
                Services
              </li>
              <li>
                Process transactions and send related information including
                purchase confirmations and invoices
              </li>
              <li>
                Send technical notices, updates, security alerts, and
                administrative messages
              </li>
              <li>
                Respond to your comments, questions, and customer service
                requests
              </li>
              <li>
                Monitor and analyze usage trends to improve user experience and
                platform performance
              </li>
              <li>
                Detect, investigate, and prevent fraudulent transactions and
                other illegal activities
              </li>
              <li>
                Enforce our terms of service and comply with legal obligations
              </li>
            </ul>
          </div>
        </section>

        {/* 4. Data Storage & Security */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            4. Data Storage & Security
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              Your data is stored on infrastructure hosted in the United States
              and India. We employ industry-standard security measures to protect
              your information, including:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Encryption at rest (AES-256) and in transit (TLS 1.2+)</li>
              <li>
                Role-based access controls limiting employee access to personal
                data
              </li>
              <li>
                Regular security audits and vulnerability assessments
              </li>
              <li>Automated backups with point-in-time recovery</li>
              <li>
                SOC 2 Type II compliance currently in progress, with expected
                certification by Q3 2026
              </li>
            </ul>
            <p>
              While we implement commercially reasonable security measures, no
              method of electronic storage or transmission is completely secure.
              We cannot guarantee absolute security of your data.
            </p>
          </div>
        </section>

        {/* 5. Third-Party Services */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            5. Third-Party Services
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              We share data with the following categories of third-party service
              providers, solely for the purpose of operating our Services:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <span className="font-semibold text-ink">
                  Payment processing:
                </span>{" "}
                Stripe processes payment information on our behalf. Their
                handling of your payment data is governed by the{" "}
                <a
                  href="https://stripe.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline hover:text-accent"
                >
                  Stripe Privacy Policy
                </a>
                .
              </li>
              <li>
                <span className="font-semibold text-ink">
                  Analytics:
                </span>{" "}
                We use analytics providers to understand how our Services are
                used and to improve performance.
              </li>
              <li>
                <span className="font-semibold text-ink">
                  Infrastructure:
                </span>{" "}
                Cloud hosting providers that store and process data on our
                behalf, subject to strict data processing agreements.
              </li>
              <li>
                <span className="font-semibold text-ink">
                  Email delivery:
                </span>{" "}
                Transactional email providers for account notifications and
                communications.
              </li>
            </ul>
            <p>
              We do not sell your personal data to third parties. We do not share
              your data with third parties for their own marketing purposes.
            </p>
          </div>
        </section>

        {/* 6. Your Rights */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            6. Your Rights
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              Depending on your location, you may have the following rights
              regarding your personal data:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <span className="font-semibold text-ink">Access:</span>{" "}
                Request a copy of the personal data we hold about you
              </li>
              <li>
                <span className="font-semibold text-ink">
                  Correction:
                </span>{" "}
                Request correction of inaccurate or incomplete personal data
              </li>
              <li>
                <span className="font-semibold text-ink">
                  Deletion:
                </span>{" "}
                Request deletion of your personal data, subject to legal
                retention requirements
              </li>
              <li>
                <span className="font-semibold text-ink">
                  Data portability:
                </span>{" "}
                Request a machine-readable export of your data
              </li>
              <li>
                <span className="font-semibold text-ink">
                  Opt-out:
                </span>{" "}
                Unsubscribe from marketing communications at any time via the
                link in any email
              </li>
              <li>
                <span className="font-semibold text-ink">
                  Restriction:
                </span>{" "}
                Request restriction of processing in certain circumstances
              </li>
            </ul>
            <p>
              To exercise any of these rights, contact us at{" "}
              <a
                href="mailto:privacy@rachdev.com"
                className="text-accent underline hover:text-accent"
              >
                privacy@rachdev.com
              </a>
              . We will respond to your request within 30 days.
            </p>
          </div>
        </section>

        {/* 7. Cookies */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            7. Cookies
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>We use cookies and similar technologies for three purposes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <span className="font-semibold text-ink">
                  Essential cookies:
                </span>{" "}
                Required for authentication, session management, and core
                platform functionality
              </li>
              <li>
                <span className="font-semibold text-ink">
                  Analytics cookies:
                </span>{" "}
                Help us understand how visitors interact with our website and
                Services
              </li>
              <li>
                <span className="font-semibold text-ink">
                  Preference cookies:
                </span>{" "}
                Remember your settings and display preferences
              </li>
            </ul>
            <p>
              For detailed information about the cookies we use and how to
              manage them, please refer to our{" "}
              <a
                href="/legal/cookies"
                className="text-accent underline hover:text-accent"
              >
                Cookie Policy
              </a>
              .
            </p>
          </div>
        </section>

        {/* 8. Data Retention */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            8. Data Retention
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              We retain your personal data for as long as your account is active
              or as needed to provide you with our Services. Specific retention
              periods are as follows:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <span className="font-semibold text-ink">
                  Account data:
                </span>{" "}
                Retained while your account is active. Upon account closure, we
                delete personal data within 30 days, unless retention is
                required by law.
              </li>
              <li>
                <span className="font-semibold text-ink">
                  Usage logs:
                </span>{" "}
                Retained for 90 days for debugging and performance monitoring,
                then aggregated and anonymized.
              </li>
              <li>
                <span className="font-semibold text-ink">
                  Billing records:
                </span>{" "}
                Retained for 7 years to comply with tax and accounting
                regulations.
              </li>
              <li>
                <span className="font-semibold text-ink">
                  Backups:
                </span>{" "}
                Automatically purged on a 30-day rolling cycle after account
                deletion.
              </li>
            </ul>
          </div>
        </section>

        {/* 9. Children's Privacy */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            9. Children&apos;s Privacy
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              Our Services are not intended for users under the age of 16. We do
              not knowingly collect personal data from children under 16. If we
              become aware that we have inadvertently collected personal data
              from a child under 16, we will take steps to delete that
              information as promptly as possible. If you believe a child under
              16 has provided us with personal data, please contact us at{" "}
              <a
                href="mailto:privacy@rachdev.com"
                className="text-accent underline hover:text-accent"
              >
                privacy@rachdev.com
              </a>
              .
            </p>
          </div>
        </section>

        {/* 10. Changes to This Policy */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            10. Changes to This Policy
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              We may update this Privacy Policy from time to time to reflect
              changes in our practices, technology, legal requirements, or other
              factors. When we make material changes, we will notify you by
              email (sent to the address associated with your account) and
              update the &quot;Last updated&quot; date at the top of this page.
            </p>
            <p>
              We encourage you to review this Privacy Policy periodically to
              stay informed about how we protect your data.
            </p>
          </div>
        </section>

        {/* 11. Contact Us */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            11. Contact Us
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              If you have questions or concerns about this Privacy Policy or our
              data practices, contact us at:
            </p>
            <ul className="list-none space-y-1">
              <li>
                <span className="font-semibold text-ink">Email:</span>{" "}
                <a
                  href="mailto:privacy@rachdev.com"
                  className="text-accent underline hover:text-accent"
                >
                  privacy@rachdev.com
                </a>
              </li>
              <li>
                <span className="font-semibold text-ink">
                  Company:
                </span>{" "}
                Rach Dev LLP
              </li>
              <li>
                <span className="font-semibold text-ink">
                  Location:
                </span>{" "}
                Noida, India
              </li>
            </ul>
          </div>
        </section>
      </div>
    </>
  );
}
