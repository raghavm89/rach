"use client";
import { AlertTriangle, X } from "lucide-react";

interface ImpersonationBannerProps {
  tenantName: string;
  onExit: () => void;
}

export function ImpersonationBanner({ tenantName, onExit }: ImpersonationBannerProps) {
  return (
    <div className="bg-status-warning text-white px-4 py-2 flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />
        <span className="font-medium">IMPERSONATING {tenantName}</span>
        <span className="text-white/80">&mdash; All actions will be logged</span>
      </div>
      <button type="button" onClick={onExit} className="flex items-center gap-1 px-2 py-1 rounded bg-white/20 hover:bg-white/30 transition-colors">
        <X className="w-3.5 h-3.5" /> Exit
      </button>
    </div>
  );
}
