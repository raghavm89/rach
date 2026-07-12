import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Service Level Agreement",
  description:
    "Rach Dev LLP SLA. Our commitment to uptime, performance, and reliability.",
};

export default function SLAPage() {
  return (
    <>
      <div className="mb-6 inline-block rounded-full border border-line bg-band px-3 py-1 text-xs font-medium text-ink-3">
        Last updated: March 2026
      </div>

      <h1 className="font-display text-3xl font-bold text-ink">
        Service Level Agreement
      </h1>

      <div className="mt-8 space-y-8">
        {/* 1. Service Commitment */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            1. Service Commitment
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              Rach Dev LLP commits to maintaining 99.9% monthly uptime for all
              production infrastructure, including managed databases, API
              endpoints, authentication services, and the AI agent runtime
              environment. This commitment applies to all paid plans.
            </p>
            <p>
              This SLA does not apply to free-tier accounts, beta features, or
              services explicitly marked as &quot;experimental&quot; in the
              documentation.
            </p>
          </div>
        </section>

        {/* 2. Definitions */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            2. Definitions
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <ul className="list-disc list-inside space-y-2">
              <li>
                <span className="font-semibold text-ink">
                  Uptime:
                </span>{" "}
                The percentage of time during a calendar month that the
                production Services are operational and accessible as measured by
                our external monitoring systems.
              </li>
              <li>
                <span className="font-semibold text-ink">
                  Downtime:
                </span>{" "}
                Any period during which the production Services are unavailable
                or materially degraded, as confirmed by our monitoring. A
                service is considered unavailable when more than 5% of requests
                return errors (HTTP 5xx) over a 5-minute rolling window.
              </li>
              <li>
                <span className="font-semibold text-ink">
                  Scheduled Maintenance:
                </span>{" "}
                Planned maintenance windows communicated at least 48 hours in
                advance via email and the status page. Scheduled maintenance
                does not count toward downtime calculations.
              </li>
              <li>
                <span className="font-semibold text-ink">
                  Emergency Maintenance:
                </span>{" "}
                Unplanned maintenance required to address critical security
                vulnerabilities or issues that pose an imminent threat to data
                integrity. We will provide as much advance notice as
                circumstances allow.
              </li>
            </ul>
          </div>
        </section>

        {/* 3. Uptime Calculation */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            3. Uptime Calculation
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>Monthly uptime is calculated using the following formula:</p>
            <div className="my-4 rounded-lg border border-line bg-band px-4 py-3 font-mono text-sm text-ink">
              Uptime % = ((Total Minutes - Downtime Minutes) / Total Minutes)
              &times; 100
            </div>
            <p>Where:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <span className="font-semibold text-ink">
                  Total Minutes:
                </span>{" "}
                The total number of minutes in the calendar month
              </li>
              <li>
                <span className="font-semibold text-ink">
                  Downtime Minutes:
                </span>{" "}
                The total minutes of confirmed downtime during the month,
                excluding scheduled maintenance and excluded events
              </li>
            </ul>
            <p>
              For example, in a 30-day month (43,200 total minutes), 99.9%
              uptime allows for a maximum of 43.2 minutes of unplanned downtime.
            </p>
          </div>
        </section>

        {/* 4. Service Credits */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            4. Service Credits
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              If we fail to meet the uptime commitment in a given calendar
              month, you are eligible for service credits applied to your next
              billing cycle. Credits are calculated as a percentage of your
              monthly subscription fee for the affected service:
            </p>
            <div className="my-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className="py-3 pr-6 text-left font-semibold text-ink">
                      Monthly Uptime
                    </th>
                    <th className="py-3 text-left font-semibold text-ink">
                      Service Credit
                    </th>
                  </tr>
                </thead>
                <tbody className="text-ink-2">
                  <tr className="border-b border-line">
                    <td className="py-3 pr-6">99.0% &ndash; 99.9%</td>
                    <td className="py-3">10% of monthly fee</td>
                  </tr>
                  <tr className="border-b border-line">
                    <td className="py-3 pr-6">95.0% &ndash; 99.0%</td>
                    <td className="py-3">25% of monthly fee</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-6">Below 95.0%</td>
                    <td className="py-3">50% of monthly fee</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              To request a service credit, submit a request to{" "}
              <a
                href="mailto:support@rachdev.com"
                className="text-accent underline hover:text-accent"
              >
                support@rachdev.com
              </a>{" "}
              within 30 days of the end of the month in which the downtime
              occurred. Include your account ID and the dates and times of the
              affected periods.
            </p>
            <p>
              Service credits are your sole and exclusive remedy for any failure
              to meet the uptime commitment. Credits may not exceed 50% of your
              monthly fee and cannot be exchanged for cash.
            </p>
          </div>
        </section>

        {/* 5. Exclusions */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            5. Exclusions
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              The following events are excluded from downtime calculations and
              do not qualify for service credits:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Scheduled maintenance communicated at least 48 hours in advance
              </li>
              <li>
                Force majeure events including natural disasters, wars,
                pandemics, government actions, or widespread internet
                infrastructure failures beyond our reasonable control
              </li>
              <li>
                Issues caused by your applications, code, configurations, or
                equipment
              </li>
              <li>
                Abuse or excessive usage that exceeds your plan&apos;s published
                limits
              </li>
              <li>
                Outages of third-party services not under our direct control
                (e.g., upstream DNS providers, cloud region failures)
              </li>
              <li>
                Features and services explicitly labeled as beta, preview, or
                experimental
              </li>
            </ul>
          </div>
        </section>

        {/* 6. Monitoring */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            6. Monitoring
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              We operate 24/7 automated monitoring across all production
              infrastructure. Our monitoring systems check service availability
              from multiple geographic locations every 30 seconds.
            </p>
            <p>
              Real-time service status and historical uptime data are available
              on our public status page. You can subscribe to status
              notifications via email, SMS, or webhook to receive immediate
              alerts about incidents and maintenance windows.
            </p>
          </div>
        </section>

        {/* 7. Incident Response */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            7. Incident Response
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              When an incident is detected, our engineering team follows a
              structured response process with target response times based on
              severity:
            </p>
            <div className="my-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className="py-3 pr-6 text-left font-semibold text-ink">
                      Severity
                    </th>
                    <th className="py-3 pr-6 text-left font-semibold text-ink">
                      Description
                    </th>
                    <th className="py-3 text-left font-semibold text-ink">
                      Response Time
                    </th>
                  </tr>
                </thead>
                <tbody className="text-ink-2">
                  <tr className="border-b border-line">
                    <td className="py-3 pr-6 font-semibold text-ink">
                      Critical
                    </td>
                    <td className="py-3 pr-6">
                      Complete service outage affecting all customers
                    </td>
                    <td className="py-3">15 minutes</td>
                  </tr>
                  <tr className="border-b border-line">
                    <td className="py-3 pr-6 font-semibold text-ink">
                      High
                    </td>
                    <td className="py-3 pr-6">
                      Major feature degradation or outage affecting a subset of
                      customers
                    </td>
                    <td className="py-3">1 hour</td>
                  </tr>
                  <tr className="border-b border-line">
                    <td className="py-3 pr-6 font-semibold text-ink">
                      Medium
                    </td>
                    <td className="py-3 pr-6">
                      Minor feature degradation with available workarounds
                    </td>
                    <td className="py-3">4 hours</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-6 font-semibold text-ink">
                      Low
                    </td>
                    <td className="py-3 pr-6">
                      Cosmetic issues, non-critical bugs, or minor
                      inconsistencies
                    </td>
                    <td className="py-3">24 hours</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              For Critical and High severity incidents, we publish updates on
              the status page at least every 30 minutes until the incident is
              resolved. A post-incident report is published within 72 hours of
              resolution for all Critical incidents.
            </p>
          </div>
        </section>

        {/* 8. Reporting */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            8. Reporting
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              Monthly uptime reports are available in your account dashboard
              under the &quot;Service Health&quot; section. Reports include:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Overall monthly uptime percentage for each service</li>
              <li>A log of all incidents with timestamps and resolution details</li>
              <li>Scheduled maintenance windows and their durations</li>
              <li>API response time percentiles (p50, p95, p99)</li>
            </ul>
            <p>
              Enterprise customers on custom plans may request additional
              reporting formats and SLA reviews. Contact your account manager or{" "}
              <a
                href="mailto:support@rachdev.com"
                className="text-accent underline hover:text-accent"
              >
                support@rachdev.com
              </a>{" "}
              for details.
            </p>
          </div>
        </section>

        {/* 9. Contact */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            9. Contact
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              For questions about this SLA, uptime commitments, or to submit a
              service credit request, contact us at:
            </p>
            <ul className="list-none space-y-1">
              <li>
                <span className="font-semibold text-ink">Email:</span>{" "}
                <a
                  href="mailto:support@rachdev.com"
                  className="text-accent underline hover:text-accent"
                >
                  support@rachdev.com
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
