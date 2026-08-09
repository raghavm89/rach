import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Processing Agreement",
  description:
    "Rach Dev LLP data processing agreement. How we process data on your behalf.",
};

export default function DPAPage() {
  return (
    <>
      <div className="mb-6 inline-block rounded-full border border-line bg-band px-3 py-1 text-xs font-medium text-ink-3">
        Last updated: August 2026
      </div>

      <h1 className="font-display text-3xl font-bold text-ink">
        Data Processing Agreement
      </h1>

      <div className="mt-8 space-y-8">
        {/* 1. Definitions */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            1. Definitions
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              For the purposes of this Data Processing Agreement
              (&quot;DPA&quot;), the following terms have the meanings set out
              below:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <span className="font-semibold text-ink">
                  Controller:
                </span>{" "}
                The entity (you, the customer) that determines the purposes and
                means of processing personal data. In the context of this DPA,
                the Controller is the Rach Dev LLP account holder.
              </li>
              <li>
                <span className="font-semibold text-ink">
                  Processor:
                </span>{" "}
                Rach Dev LLP, which processes personal data on behalf of the
                Controller in connection with providing the Services.
              </li>
              <li>
                <span className="font-semibold text-ink">
                  Sub-processor:
                </span>{" "}
                A third-party entity engaged by the Processor to assist in
                processing personal data on behalf of the Controller.
              </li>
              <li>
                <span className="font-semibold text-ink">
                  Personal Data:
                </span>{" "}
                Any information relating to an identified or identifiable
                natural person that is processed by the Processor on behalf of
                the Controller through the Services.
              </li>
              <li>
                <span className="font-semibold text-ink">
                  Processing:
                </span>{" "}
                Any operation performed on personal data, including collection,
                recording, storage, retrieval, use, disclosure, erasure, or
                destruction.
              </li>
              <li>
                <span className="font-semibold text-ink">
                  Data Breach:
                </span>{" "}
                A breach of security leading to the accidental or unlawful
                destruction, loss, alteration, unauthorized disclosure of, or
                access to personal data.
              </li>
            </ul>
          </div>
        </section>

        {/* 2. Scope and Purpose */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            2. Scope and Purpose
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              This DPA applies to all processing of personal data that Rach Dev LLP
              performs on behalf of the Controller in connection with the
              Rach Dev LLP platform and Services. We process personal data solely
              for the following purposes:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Providing, operating, and maintaining the Rach Dev LLP platform
                Services as described in our{" "}
                <a
                  href="/legal/terms"
                  className="text-accent underline hover:text-accent"
                >
                  Terms of Service
                </a>
              </li>
              <li>
                Storing and managing data in the Controller&apos;s managed
                databases
              </li>
              <li>
                Processing API requests and executing AI agent interactions on
                behalf of the Controller
              </li>
              <li>
                Generating operational logs, usage metrics, and performance
                reports for the Controller
              </li>
              <li>
                Providing technical support and troubleshooting when requested
                by the Controller
              </li>
            </ul>
            <p>
              <span className="font-semibold text-ink">
                Processing architecture.
              </span>{" "}
              Rach Dev LLP is the Processor for all Personal Data handled through
              the Services. The rachdev.com application is the control plane
              through which the Controller builds, configures, publishes, and
              manages agents and workspaces. Personal Data is hosted and
              processed within Rach Dev LLP&apos;s RachBase infrastructure (and,
              where separately agreed, within the Controller&apos;s own or
              on-premises environment). The infrastructure and service providers
              listed in the Sub-processors section support this processing on
              Rach Dev LLP&apos;s behalf.
            </p>
            <p>
              We will not process personal data for any purpose other than those
              specified in this DPA or as otherwise instructed in writing by the
              Controller.
            </p>
          </div>
        </section>

        {/* 3. Data Processing Details */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            3. Data Processing Details
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p className="font-semibold text-ink">
              Types of Personal Data
            </p>
            <p>
              The types of personal data processed depend on the
              Controller&apos;s use of the Services and may include:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Names, email addresses, and contact information stored in
                managed databases
              </li>
              <li>
                Authentication credentials and session data
              </li>
              <li>
                Content submitted to AI agents (text inputs, conversation
                history)
              </li>
              <li>
                Technical identifiers such as IP addresses and device
                information
              </li>
              <li>
                Any other personal data the Controller chooses to store or
                process through the Services
              </li>
            </ul>

            <p className="font-semibold text-ink">
              Categories of Data Subjects
            </p>
            <p>
              Data subjects may include the Controller&apos;s customers,
              employees, contractors, end users, or any other individuals whose
              data the Controller stores or processes through the Services.
            </p>

            <p className="font-semibold text-ink">
              Duration of Processing
            </p>
            <p>
              Processing continues for the duration of the Controller&apos;s use
              of the Services. Upon termination or expiration of the service
              agreement, we will delete or return all personal data within 30
              days, unless retention is required by applicable law.
            </p>
          </div>
        </section>

        {/* 4. Processor Obligations */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            4. Processor Obligations
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>As the Processor, Rach Dev LLP commits to the following:</p>

            <p className="font-semibold text-ink">
              Security Measures
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Encryption of personal data at rest (AES-256) and in transit
                (TLS 1.2+)
              </li>
              <li>
                Role-based access controls ensuring only authorized personnel
                can access personal data
              </li>
              <li>
                Regular vulnerability assessments, penetration testing, and
                security audits
              </li>
              <li>
                Intrusion detection and prevention systems on all production
                infrastructure
              </li>
              <li>
                Automated backups with geographic redundancy and
                point-in-time recovery
              </li>
            </ul>

            <p className="font-semibold text-ink">Confidentiality</p>
            <p>
              All Rach Dev LLP personnel with access to personal data are bound by
              confidentiality obligations. Access is granted on a need-to-know
              basis and is regularly reviewed.
            </p>

            <p className="font-semibold text-ink">
              Data Breach Notification
            </p>
            <p>
              In the event of a confirmed data breach affecting the
              Controller&apos;s personal data, Rach Dev LLP will:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Notify the Controller without undue delay and in any event
                within 72 hours of becoming aware of the breach
              </li>
              <li>
                Provide details including the nature of the breach, categories
                and approximate number of data subjects affected, likely
                consequences, and measures taken or proposed to address the
                breach
              </li>
              <li>
                Cooperate with the Controller in investigating and mitigating
                the breach
              </li>
              <li>
                Document all breaches, including facts, effects, and remedial
                actions taken
              </li>
            </ul>
          </div>
        </section>

        {/* 5. Sub-processors */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            5. Sub-processors
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              Rach Dev LLP engages the following categories of sub-processors to
              deliver the Services. Each sub-processor is bound by data
              processing agreements that impose obligations no less protective
              than those in this DPA:
            </p>
            <div className="my-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className="py-3 pr-6 text-left font-semibold text-ink">
                      Sub-processor
                    </th>
                    <th className="py-3 pr-6 text-left font-semibold text-ink">
                      Purpose
                    </th>
                    <th className="py-3 text-left font-semibold text-ink">
                      Location
                    </th>
                  </tr>
                </thead>
                <tbody className="text-ink-2">
                  <tr className="border-b border-line">
                    <td className="py-3 pr-6">AWS / GCP</td>
                    <td className="py-3 pr-6">
                      Cloud infrastructure, compute, and storage
                    </td>
                    <td className="py-3">US, India, EU</td>
                  </tr>
                  <tr className="border-b border-line">
                    <td className="py-3 pr-6">ARKA Microstacks</td>
                    <td className="py-3 pr-6">
                      Cloud infrastructure management and operations (RachBase)
                    </td>
                    <td className="py-3">India</td>
                  </tr>
                  <tr className="border-b border-line">
                    <td className="py-3 pr-6">Razorpay</td>
                    <td className="py-3 pr-6">Payment processing</td>
                    <td className="py-3">India</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-6">Brevo</td>
                    <td className="py-3 pr-6">
                      Transactional email delivery
                    </td>
                    <td className="py-3">EU</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              We will notify the Controller at least 30 days before engaging a
              new sub-processor or making material changes to an existing
              sub-processor. The Controller may object to a new sub-processor by
              notifying us within 14 days of receiving the notice. If the
              objection cannot be resolved, the Controller may terminate the
              affected Services without penalty.
            </p>
          </div>
        </section>

        {/* 6. Data Transfers */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            6. Data Transfers
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              Personal data may be transferred to and processed in countries
              outside the Controller&apos;s jurisdiction. When transferring
              personal data internationally, we ensure that appropriate
              safeguards are in place, including:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Standard Contractual Clauses (SCCs) approved by relevant
                regulatory authorities for transfers to countries without an
                adequacy decision
              </li>
              <li>
                Transfer impact assessments conducted for each destination
                country to evaluate the level of data protection
              </li>
              <li>
                Technical measures such as encryption and pseudonymization to
                supplement legal safeguards
              </li>
              <li>
                Binding data processing agreements with all sub-processors
                regardless of location
              </li>
            </ul>
            <p>
              The Controller may request information about the specific
              safeguards in place for any data transfer by contacting{" "}
              <a
                href="mailto:dpa@rachdev.com"
                className="text-accent underline hover:text-accent"
              >
                dpa@rachdev.com
              </a>
              .
            </p>
          </div>
        </section>

        {/* 7. Data Subject Rights */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            7. Data Subject Rights
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              Rach Dev LLP will assist the Controller in fulfilling its obligations
              to respond to data subject rights requests. This includes
              requests for:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Access to personal data</li>
              <li>Rectification of inaccurate data</li>
              <li>Erasure of personal data (&quot;right to be forgotten&quot;)</li>
              <li>Restriction of processing</li>
              <li>Data portability</li>
              <li>Objection to processing</li>
            </ul>
            <p>
              If Rach Dev LLP receives a data subject request directly, we will
              promptly redirect the individual to the Controller and notify the
              Controller of the request. We will not respond to data subject
              requests directly unless instructed to do so by the Controller.
            </p>
            <p>
              We provide self-service tools in the dashboard for data export and
              deletion. For requests that require our assistance, we will
              respond within 10 business days.
            </p>
          </div>
        </section>

        {/* 8. Audits */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            8. Audits
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              Rach Dev LLP will make available to the Controller information
              necessary to demonstrate compliance with data processing
              obligations and allow for audits and inspections. Specifically:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                We conduct annual independent security audits of our
                infrastructure and processes
              </li>
              <li>
                Audit reports are available to enterprise customers upon request
                under NDA
              </li>
              <li>
                The Controller may conduct or commission a third-party audit of
                our data processing activities with 30 days&apos; written notice,
                subject to reasonable scope, timing, and confidentiality
                requirements
              </li>
            </ul>
            <p>
              The costs of audits initiated by the Controller are borne by the
              Controller, unless the audit reveals a material breach of this DPA
              by Rach Dev LLP.
            </p>
          </div>
        </section>

        {/* 9. Term and Termination */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            9. Term and Termination
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              This DPA takes effect when the Controller begins using the
              Rach Dev LLP Services and remains in force for the duration of the
              service relationship. It co-terminates with the main service
              agreement (the{" "}
              <a
                href="/legal/terms"
                className="text-accent underline hover:text-accent"
              >
                Terms of Service
              </a>
              ).
            </p>
            <p>Upon termination:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                We will cease all processing of personal data on behalf of the
                Controller, except as required to complete the termination
                process
              </li>
              <li>
                The Controller will have 30 days to export their data through
                the dashboard or by requesting a data export from support
              </li>
              <li>
                After the 30-day export window, we will securely delete all
                personal data from our systems, including backups, within an
                additional 30 days
              </li>
              <li>
                We will provide written confirmation of deletion upon request
              </li>
            </ul>
            <p>
              Obligations that by their nature should survive termination
              (including confidentiality, liability, and breach notification)
              will continue to apply.
            </p>
          </div>
        </section>

        {/* 10. Contact */}
        <section>
          <h2 className="font-display text-xl font-bold text-ink">
            10. Contact
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-ink-2">
            <p>
              For questions about this Data Processing Agreement or to exercise
              any rights under it, contact us at:
            </p>
            <ul className="list-none space-y-1">
              <li>
                <span className="font-semibold text-ink">Email:</span>{" "}
                <a
                  href="mailto:dpa@rachdev.com"
                  className="text-accent underline hover:text-accent"
                >
                  dpa@rachdev.com
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
