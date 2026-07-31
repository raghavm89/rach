import { ClinicalPlaceholder } from '@/components/clinical/ClinicalPlaceholder';

export default function InventoryPage() {
  return (
    <ClinicalPlaceholder
      title="Inventory"
      agent="Kiran"
      sprint="Sprint 3"
      description="Approved prescriptions decrement drug stock; on crossing a reorder threshold the drug store manager is alerted with a suggested reorder quantity. Reorders are staged for approval — never auto-purchased."
    />
  );
}
