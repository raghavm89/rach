export interface FAQ {
  question: string;
  answer: string;
}

export const pricingFAQs: FAQ[] = [
  {
    question: "How does billing work? Is there a minimum commitment?",
    answer:
      "All services are billed monthly based on what you have provisioned. There is no minimum commitment — you pay only for the VMs, databases, load balancers, and IPs that are active in a given month. Usage-based items like VM snapshots and on-demand Postgres backups are charged by the GB consumed.",
  },
  {
    question: "What is included in a Virtual Machine?",
    answer:
      "Each VM comes with 2 vCPUs, 8 GB RAM, and 50 GB of SSD disk at $100/month. If you need more storage, you can attach additional block storage at $0.15/GB/month. All VMs run on dedicated hardware with full resource isolation — no noisy neighbours.",
  },
  {
    question: "What is included in a Service?",
    answer:
      "Each service comes with 0.5 vCPU, 0.5 GB RAM, and 0.5 GB of SSD disk at $15/month. A service runs your app from a GitHub repository or a managed Postgres database. Need more power? Add another unit (0.5 vCPU / 0.5 GB / 0.5 GB) to a running service with zero downtime — you only pay for the units you add.",
  },
  {
    question: "What does the Managed PostgreSQL service include?",
    answer:
      "The $200/month DB instance includes WAL archival, automated daily backups with 7-day retention, and on-demand point-in-time recovery. Daily backups run at pre-agreed times. If you need an additional on-demand backup (e.g. before a planned maintenance window), you can request one at least 24 hours in advance — these are billed at $0.10/GB with a 30-day retention.",
  },
  {
    question: "What is VM snapshot retention and how do I get more?",
    answer:
      "Daily VM snapshots are billed at $0.10/GB and retained for 7 days by default. If you need a longer retention period, raise a request with the Cloud Infra/Ops team and we will configure a custom retention policy for your environment.",
  },
  {
    question: "What does '24/7 VM Resource Observability' include?",
    answer:
      "For $25/VM/month you get real-time dashboards covering CPU usage, RAM consumption, disk I/O, and network throughput for each of your virtual machines. Metrics are collected continuously and historical data is retained for 7 days. Automated alerts fire when any metric exceeds 80% utilisation.",
  },
  {
    question: "What is Application Workload Monitoring?",
    answer:
      "At $25/endpoint/month, we monitor your application endpoints around the clock — tracking uptime, response latency, error rates, and throughput. You receive alerts when an endpoint goes down or degrades beyond configured thresholds.",
  },
  {
    question: "What services are included at no extra charge?",
    answer:
      "Every customer receives regular Cloud security patching, CIS security audits, Anti-DDoS protection, and on-demand VM cloning at no additional cost. These are part of the base infrastructure and not optional add-ons.",
  },
  {
    question: "Can I get a custom plan with more VMs or a different configuration?",
    answer:
      "Yes. If your workload requires a large number of VMs, custom VM sizes, dedicated SLAs, or a bespoke configuration, contact our sales team. We will put together a tailored plan and pricing for your specific requirements.",
  },
];
