"use client";

import { useState } from "react";
import { ChevronsUpDown, Check, Plus } from "lucide-react";
import { cn } from "@rach/ui/lib/utils";
import { mockProjects } from "@/data/mock/projects";

interface ProjectSwitcherProps {
  projectSlug: string;
}

export function ProjectSwitcher({ projectSlug }: ProjectSwitcherProps) {
  const [open, setOpen] = useState(false);
  const currentProject = mockProjects.find((p) => p.slug === projectSlug) || mockProjects[0];

  return (
    <div className="relative w-full">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-surface-sidebar-hover transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-primary-blue/20 flex items-center justify-center text-primary-blue font-bold text-xs shrink-0">
          {currentProject.name.charAt(0)}
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-medium text-white truncate">{currentProject.name}</p>
          <p className="text-xs text-dash-muted truncate">{currentProject.plan} Plan</p>
        </div>
        <ChevronsUpDown className="w-4 h-4 text-dash-muted shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 w-full bg-surface-sidebar border border-white/10 rounded-lg shadow-xl z-50 py-1">
            {mockProjects.map((project) => (
              <a
                key={project.id}
                href={`/app/${project.slug}/overview`}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-sidebar-hover transition-colors",
                  project.slug === projectSlug ? "text-white" : "text-dash-sidebar"
                )}
                onClick={() => setOpen(false)}
              >
                <div className="w-6 h-6 rounded bg-primary-blue/20 flex items-center justify-center text-primary-blue text-xs font-bold shrink-0">
                  {project.name.charAt(0)}
                </div>
                <span className="flex-1 truncate">{project.name}</span>
                {project.slug === projectSlug && (
                  <Check className="w-4 h-4 text-primary-blue shrink-0" />
                )}
              </a>
            ))}
            <div className="border-t border-white/10 mt-1 pt-1">
              <button className="flex items-center gap-2 px-3 py-2 text-sm text-dash-muted hover:text-white hover:bg-surface-sidebar-hover w-full transition-colors">
                <Plus className="w-4 h-4" />
                <span>New Project</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
