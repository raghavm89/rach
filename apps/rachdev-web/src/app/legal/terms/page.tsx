import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Rach Dev LLP terms of service. Rules and guidelines for using our platform.",
};

export default function TermsOfServicePage() {
  return (
    <>
      <div className="mb-6 inline-block rounded-full border border-line bg-band px-3 py-1 text-xs font-medium text-ink-3">
        Last updated: August 2026
      </div>

      <h1 className="font-display text-3xl font-bold text-ink">
        Terms of Service
      </h1>

      <div className="mt-8 space-y-8">
        {/* 1. Acceptance of Terms */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            1. Acceptance of Terms
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              By accessing or using the Rach Dev LLP platform, website, APIs,
              documentation, or any related services (collectively, the
              &quot;Services&quot;), you agree to be bound by these Terms of
              Service (&quot;Terms&quot;). If you are using the Services on
              behalf of an organization, you represent and warrant that you have
              the authority to bind that organization to these Terms.
            </p>
            <p>
              If you do not agree to these Terms, you must not access or use our
              Services. We reserve the right to update these Terms at any time.
              Continued use of the Services after changes are posted constitutes
              acceptance of the updated Terms.
            </p>
          </div>
        </section>

        {/* 2. Description of Service */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            2. Description of Service
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              Rach Dev LLP is a Backend-as-a-Service (BaaS) platform combined with
              an AI Agent Builder. Our Services include, but are not limited to:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Managed PostgreSQL databases with automated backups and scaling
              </li>
              <li>
                Authentication and authorization services
              </li>
              <li>
                RESTful API generation and management
              </li>
              <li>
                AI agent creation, deployment, and management through
                pre-built templates and custom configurations
              </li>
              <li>
                Dashboard and analytics for monitoring usage, performance, and
                costs
              </li>
            </ul>
            <p>
              We may modify, suspend, or discontinue any part of the Services at
              any time with reasonable notice. We will make commercially
              reasonable efforts to notify you of material changes that affect
              your use of the platform.
            </p>
          </div>
        </section>

        {/* 3. Account Registration */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            3. Account Registration
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              To use certain features of the Services, you must create an
              account. When registering, you agree to:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Provide accurate, current, and complete information during
                registration
              </li>
              <li>
                Maintain and promptly update your account information to keep it
                accurate
              </li>
              <li>
                Maintain the security and confidentiality of your account
                credentials, including API keys and access tokens
              </li>
              <li>
                Accept responsibility for all activity that occurs under your
                account
              </li>
              <li>
                Notify us immediately at{" "}
                <a
                  href="mailto:security@rachdev.com"
                  className="text-accent underline hover:text-accent"
                >
                  security@rachdev.com
                </a>{" "}
                if you suspect unauthorized access to your account
              </li>
            </ul>
            <p>
              We reserve the right to suspend or terminate accounts that contain
              inaccurate information or that violate these Terms.
            </p>
          </div>
        </section>

        {/* 4. Acceptable Use */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            4. Acceptable Use
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              You agree to use the Services only for lawful purposes and in
              accordance with these Terms. You must not:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Use the Services for any illegal activity or to facilitate
                violations of any applicable law or regulation
              </li>
              <li>
                Attempt to gain unauthorized access to any part of the Services,
                other accounts, or systems connected to our infrastructure
              </li>
              <li>
                Reverse engineer, decompile, disassemble, or otherwise attempt
                to derive the source code of the platform
              </li>
              <li>
                Use the Services to distribute malware, spam, or other harmful
                content
              </li>
              <li>
                Interfere with or disrupt the integrity or performance of the
                Services or the data contained therein
              </li>
              <li>
                Resell, sublicense, or redistribute the Services without our
                prior written consent
              </li>
              <li>
                Use AI agents built on our platform to generate content that is
                misleading, defamatory, or that violates the rights of others
              </li>
              <li>
                Exceed the rate limits or usage quotas associated with your plan
                without authorization
              </li>
            </ul>
            <p>
              Violation of this section may result in immediate suspension or
              termination of your account without notice.
            </p>
          </div>
        </section>

        {/* 5. Intellectual Property */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            5. Intellectual Property
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              <span className="font-semibold text-ink">
                Our property:
              </span>{" "}
              The Rach Dev LLP platform, including all software, designs, text,
              graphics, interfaces, and underlying technology, is owned by
              Rach Dev LLP and protected by intellectual property laws. These Terms
              do not grant you any ownership rights in the Services.
            </p>
            <p>
              <span className="font-semibold text-ink">
                Your property:
              </span>{" "}
              You retain all rights to the data, content, and applications you
              create, store, or process through our Services. We do not claim
              ownership of your data. You grant us a limited license to host,
              store, and process your data solely for the purpose of providing
              the Services to you.
            </p>
            <p>
              <span className="font-semibold text-ink">
                Feedback:
              </span>{" "}
              If you provide suggestions, feature requests, or other feedback
              about the Services, we may use that feedback without restriction
              or obligation to you.
            </p>
          </div>
        </section>

        {/* 6. Payment Terms */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            6. Payment Terms
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              Certain features of the Services require a paid subscription. By
              selecting a paid plan, you agree to the following:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Pricing is based on the plan you select, as displayed on our
                pricing page at the time of purchase
              </li>
              <li>
                Subscriptions automatically renew at the end of each billing
                cycle (monthly or annually) unless cancelled before the renewal
                date
              </li>
              <li>
                You may cancel your subscription at any time through your
                account dashboard. Cancellation takes effect at the end of the
                current billing period
              </li>
              <li>
                Refunds are not provided for partial billing periods, except
                where required by applicable law
              </li>
              <li>
                We reserve the right to change pricing with 30 days&apos; notice.
                Price changes apply at the start of the next billing cycle
              </li>
              <li>
                All payments are processed securely through Razorpay. You are
                responsible for providing valid payment information
              </li>
            </ul>
            <p>
              If payment fails, we will attempt to charge your payment method
              again. After 7 days of failed payments, your account may be
              downgraded to the free tier or suspended.
            </p>
          </div>
        </section>

        {/* 7. Service Level */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            7. Service Level
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              We work to keep the Services reliable and available. Any specific
              uptime commitments, service credits, and incident-response terms
              are defined in the enterprise agreement executed with your
              organization; we do not publish a fixed public service-level
              guarantee.
            </p>
            <p>
              We do not guarantee that the Services will be uninterrupted or
              error-free. Scheduled maintenance windows will be communicated at
              least 48 hours in advance whenever possible.
            </p>
          </div>
        </section>

        {/* 8. Data Ownership */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            8. Data Ownership
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              Your data belongs to you. We act as a data processor on your
              behalf. Specifically:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                You retain full ownership of all data you store, process, or
                transmit through our Services
              </li>
              <li>
                We do not access your data except as necessary to provide,
                maintain, and improve the Services, or as required by law
              </li>
              <li>
                We do not sell, rent, or share your data with third parties for
                their own commercial purposes
              </li>
              <li>
                We do not use your data to train machine learning models or AI
                systems beyond what is required to operate features you
                explicitly enable
              </li>
              <li>
                You may export your data at any time through the dashboard or by
                contacting support
              </li>
            </ul>
            <p>
              For detailed information about how we process data on your behalf,
              please refer to our{" "}
              <a
                href="/legal/dpa"
                className="text-accent underline hover:text-accent"
              >
                Data Processing Agreement
              </a>
              .
            </p>
          </div>
        </section>

        {/* 9. Limitation of Liability */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            9. Limitation of Liability
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              To the maximum extent permitted by applicable law, Rach Dev LLP and
              its officers, directors, employees, and agents shall not be liable
              for any indirect, incidental, special, consequential, or punitive
              damages, including but not limited to loss of profits, data, use,
              goodwill, or other intangible losses, resulting from:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Your access to or use of (or inability to use) the Services</li>
              <li>Any unauthorized access to or alteration of your data</li>
              <li>
                Any third-party conduct or content on the Services
              </li>
              <li>Any bugs, viruses, or other harmful code transmitted through the Services</li>
            </ul>
            <p>
              Our total aggregate liability for any claims arising out of or
              relating to these Terms or the Services shall not exceed the
              amount you have paid us in the twelve (12) months preceding the
              claim.
            </p>
            <p>
              The Services are provided &quot;as is&quot; and &quot;as
              available&quot; without warranties of any kind, either express or
              implied, including but not limited to implied warranties of
              merchantability, fitness for a particular purpose, and
              non-infringement.
            </p>
          </div>
        </section>

        {/* 10. Termination */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            10. Termination
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              Either party may terminate this agreement at any time:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <span className="font-semibold text-ink">You</span>{" "}
                may close your account at any time through the account settings
                page or by contacting support
              </li>
              <li>
                <span className="font-semibold text-ink">We</span>{" "}
                may suspend or terminate your account if you violate these Terms,
                fail to pay fees, or if we are required to do so by law
              </li>
            </ul>
            <p>Upon termination:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                You will have 30 days to export your data from the platform.
                After 30 days, we will delete your data in accordance with our{" "}
                <a
                  href="/legal/privacy"
                  className="text-accent underline hover:text-accent"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                Any outstanding fees owed for Services used prior to
                termination remain due and payable
              </li>
              <li>
                Provisions that by their nature should survive termination
                (including intellectual property, limitation of liability,
                and dispute resolution) will remain in effect
              </li>
            </ul>
          </div>
        </section>

        {/* 11. Governing Law */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            11. Governing Law
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              These Terms shall be governed by and construed in accordance with
              the laws of India, without regard to its conflict of law
              principles. Any legal proceedings arising out of or relating to
              these Terms shall be subject to the exclusive jurisdiction of the
              courts located in New Delhi, India.
            </p>
          </div>
        </section>

        {/* 12. Dispute Resolution */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            12. Dispute Resolution
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              In the event of any dispute arising out of or relating to these
              Terms or the Services, both parties agree to first attempt
              resolution through good faith negotiation. Either party may
              initiate the dispute resolution process by sending a written
              notice to the other party describing the nature of the dispute and
              the proposed resolution.
            </p>
            <p>
              If the dispute is not resolved within 30 days of the initial
              notice, either party may pursue formal legal proceedings as
              described in the Governing Law section above.
            </p>
          </div>
        </section>

        {/* 13. Contact */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            13. Contact
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              If you have questions about these Terms of Service, contact us at:
            </p>
            <ul className="list-none space-y-1">
              <li>
                <span className="font-semibold text-ink">Email:</span>{" "}
                <a
                  href="mailto:legal@rachdev.com"
                  className="text-accent underline hover:text-accent"
                >
                  legal@rachdev.com
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
