import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "How Rach Dev LLP uses cookies and similar tracking technologies.",
};

export default function CookiePolicyPage() {
  return (
    <>
      <div className="mb-6 inline-block rounded-full border border-line bg-band px-3 py-1 text-xs font-medium text-ink-3">
        Last updated: March 2026
      </div>

      <h1 className="font-display text-3xl font-bold text-ink">
        Cookie Policy
      </h1>

      <div className="mt-8 space-y-8">
        {/* 1. What Are Cookies */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            1. What Are Cookies
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              Cookies are small text files that are placed on your device
              (computer, tablet, or mobile phone) when you visit a website. They
              are widely used to make websites work more efficiently, provide a
              better browsing experience, and supply information to site owners.
            </p>
            <p>
              Cookies can be &quot;persistent&quot; (remaining on your device
              until they expire or you delete them) or &quot;session&quot;
              (deleted when you close your browser). They can be set by the
              website you are visiting (&quot;first-party cookies&quot;) or by
              third-party services operating on that website (&quot;third-party
              cookies&quot;).
            </p>
            <p>
              This Cookie Policy explains which cookies we use on the Rach Dev LLP
              website and platform, why we use them, and how you can manage your
              preferences.
            </p>
          </div>
        </section>

        {/* 2. Cookies We Use */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            2. Cookies We Use
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p className="font-semibold text-ink">
              Essential Cookies
            </p>
            <p>
              These cookies are strictly necessary for the operation of our
              website and platform. Without them, core features like
              authentication and session management would not function. You
              cannot opt out of essential cookies.
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <span className="font-semibold text-ink">
                  Session cookie:
                </span>{" "}
                Maintains your authenticated session while you use the platform.
                Expires when you close your browser or after 24 hours of
                inactivity.
              </li>
              <li>
                <span className="font-semibold text-ink">
                  Authentication token:
                </span>{" "}
                Securely identifies your account and permissions. Expires after
                7 days or on logout.
              </li>
              <li>
                <span className="font-semibold text-ink">
                  CSRF token:
                </span>{" "}
                Protects against cross-site request forgery attacks. Regenerated
                per session.
              </li>
            </ul>

            <p className="mt-6 font-semibold text-ink">
              Analytics Cookies
            </p>
            <p>
              These cookies help us understand how visitors interact with our
              website by collecting and reporting information anonymously. This
              data allows us to improve the user experience and identify areas
              of the platform that need attention.
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <span className="font-semibold text-ink">
                  Page views and navigation paths:
                </span>{" "}
                Tracks which pages you visit and how you move through the site
              </li>
              <li>
                <span className="font-semibold text-ink">
                  Feature usage:
                </span>{" "}
                Records which dashboard features and tools are most frequently
                used
              </li>
              <li>
                <span className="font-semibold text-ink">
                  Performance metrics:
                </span>{" "}
                Measures page load times and responsiveness to help us optimize
                performance
              </li>
            </ul>

            <p className="mt-6 font-semibold text-ink">
              Preference Cookies
            </p>
            <p>
              These cookies remember choices you make to provide a more
              personalized experience. They are not essential but improve
              usability.
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <span className="font-semibold text-ink">
                  Theme preference:
                </span>{" "}
                Remembers your selected display theme (light or dark mode)
              </li>
              <li>
                <span className="font-semibold text-ink">
                  Dashboard layout:
                </span>{" "}
                Saves your preferred dashboard configuration and sidebar state
              </li>
              <li>
                <span className="font-semibold text-ink">
                  Language and region:
                </span>{" "}
                Stores your language preference and timezone setting
              </li>
            </ul>
          </div>
        </section>

        {/* 3. Third-Party Cookies */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            3. Third-Party Cookies
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              Some cookies on our site are set by third-party services that we
              use to operate and improve the platform. These include:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <span className="font-semibold text-ink">
                  Google Analytics:
                </span>{" "}
                Used to collect anonymous usage statistics and understand traffic
                patterns. Google Analytics cookies typically expire after 2
                years. You can opt out using the{" "}
                <a
                  href="https://tools.google.com/dlpage/gaoptout"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline hover:text-accent"
                >
                  Google Analytics Opt-out Browser Add-on
                </a>
                .
              </li>
              <li>
                <span className="font-semibold text-ink">
                  Stripe:
                </span>{" "}
                Used for secure payment processing. Stripe sets cookies to
                detect and prevent fraud. These cookies are essential for
                payment functionality. See the{" "}
                <a
                  href="https://stripe.com/cookies-policy/legal"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline hover:text-accent"
                >
                  Stripe Cookie Policy
                </a>{" "}
                for details.
              </li>
            </ul>
            <p>
              We do not use any advertising or tracking cookies. We do not
              participate in cross-site ad networks.
            </p>
          </div>
        </section>

        {/* 4. Managing Cookies */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            4. Managing Cookies
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              You can control and manage cookies in several ways. Please note
              that removing or blocking certain cookies may impact your
              experience and limit the functionality available to you.
            </p>
            <p className="font-semibold text-ink">Browser Settings</p>
            <p>
              Most browsers allow you to view, manage, and delete cookies
              through their settings. The process varies by browser:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <span className="font-semibold text-ink">
                  Chrome:
                </span>{" "}
                Settings &rarr; Privacy and security &rarr; Cookies and other
                site data
              </li>
              <li>
                <span className="font-semibold text-ink">
                  Firefox:
                </span>{" "}
                Settings &rarr; Privacy & Security &rarr; Cookies and Site Data
              </li>
              <li>
                <span className="font-semibold text-ink">
                  Safari:
                </span>{" "}
                Preferences &rarr; Privacy &rarr; Manage Website Data
              </li>
              <li>
                <span className="font-semibold text-ink">Edge:</span>{" "}
                Settings &rarr; Cookies and site permissions &rarr; Cookies and
                site data
              </li>
            </ul>

            <p className="font-semibold text-ink">Opt-Out Links</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Google Analytics:{" "}
                <a
                  href="https://tools.google.com/dlpage/gaoptout"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline hover:text-accent"
                >
                  https://tools.google.com/dlpage/gaoptout
                </a>
              </li>
            </ul>
            <p>
              If you disable essential cookies, you may not be able to log in or
              use the Rach Dev LLP platform. Analytics and preference cookies can be
              disabled without affecting core functionality.
            </p>
          </div>
        </section>

        {/* 5. Changes to This Policy */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            5. Changes to This Policy
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              We may update this Cookie Policy from time to time to reflect
              changes in the cookies we use or for other operational, legal, or
              regulatory reasons. When we make changes, we will update the
              &quot;Last updated&quot; date at the top of this page.
            </p>
            <p>
              We encourage you to review this Cookie Policy periodically to stay
              informed about how we use cookies and related technologies.
            </p>
          </div>
        </section>

        {/* 6. Contact */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            6. Contact
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              If you have questions about our use of cookies, contact us at:
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
