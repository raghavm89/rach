import { ClinicalPlaceholder } from '@/components/clinical/ClinicalPlaceholder';

export default function ReceptionPage() {
  return (
    <ClinicalPlaceholder
      title="Reception"
      agent="Ava"
      sprint="Sprint 2"
      description="Voice intake companion — structured registration, reason for visit, history and eligibility → opens an encounter and hands context to the Scribe flow. POC runs standalone; production is built over Dhanvantri."
    />
  );
}
