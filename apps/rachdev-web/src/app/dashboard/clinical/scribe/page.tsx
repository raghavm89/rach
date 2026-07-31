import { ClinicalPlaceholder } from '@/components/clinical/ClinicalPlaceholder';

export default function ScribePage() {
  return (
    <ClinicalPlaceholder
      title="Scribe"
      agent="Nora"
      sprint="Sprint 2"
      description="Doctor dictates (Hindi / Punjabi via IndicWhisper) → transcript → structured SOAP note + suggested CPT/ICD codes → clinician review and sign-off. Nothing is saved until the clinician approves."
    />
  );
}
