import { ClinicalPlaceholder } from '@/components/clinical/ClinicalPlaceholder';

export default function AuditPage() {
  return (
    <ClinicalPlaceholder
      title="Audit Log"
      agent="Guardrail"
      sprint="Sprint 3"
      description="Immutable, timestamped record of every agent action, PHI-field access, model call, prescription→inventory hand-off and clinician approval — exportable. Serves DPDP, HIPAA and MoD/AFMS record-keeping."
    />
  );
}
