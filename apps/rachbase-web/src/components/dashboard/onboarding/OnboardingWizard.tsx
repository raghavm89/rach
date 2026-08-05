"use client";

import { useState } from "react";
import { X, Rocket, Server, Globe, CheckCircle2, Database, Bot, Users } from "lucide-react";
import Link from "next/link";

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

const TOTAL_STEPS = 5;

type ProjectType = "fresh" | "migrate" | null;
type Region = "us-east" | "in-mumbai" | null;

export function OnboardingWizard({ isOpen, onClose }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [projectType, setProjectType] = useState<ProjectType>(null);
  const [region, setRegion] = useState<Region>(null);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");

  if (!isOpen) return null;

  const canGoNext = (): boolean => {
    switch (step) {
      case 1:
        return true;
      case 2:
        return projectType !== null;
      case 3:
        return region !== null;
      case 4:
        return projectName.trim().length > 0;
      case 5:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS && canGoNext()) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-surface-card rounded-xl shadow-2xl border border-neutral-border overflow-hidden">
        {/* Top bar: progress + skip/close */}
        <div className="px-6 pt-5 pb-0">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-dash-muted font-medium">Step {step} of {TOTAL_STEPS}</span>
            <div className="flex items-center gap-2">
              {step < TOTAL_STEPS && (
                <button
                  type="button"
                  onClick={onClose}
                  className="text-xs text-dash-muted hover:text-dash-body transition-colors"
                >
                  Skip
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1 hover:bg-surface-hover rounded transition-colors"
                aria-label="Close onboarding"
              >
                <X className="w-4 h-4 text-dash-muted" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex gap-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i < step ? "bg-primary-blue" : "bg-neutral-border"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 min-h-[320px] flex flex-col">
          {/* Step 1: Welcome */}
          {step === 1 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary-blue/10 flex items-center justify-center mb-5">
                <Rocket className="w-7 h-7 text-primary-blue" />
              </div>
              <h2 className="text-xl font-semibold text-dash-heading">Welcome to RachBase</h2>
              <p className="text-sm text-dash-muted mt-2 max-w-sm">
                Let&apos;s get you set up in under 90 seconds. We&apos;ll walk you through creating your first project and getting everything connected.
              </p>
            </div>
          )}

          {/* Step 2: Create or Migrate */}
          {step === 2 && (
            <div className="flex-1 flex flex-col">
              <h2 className="text-lg font-semibold text-dash-heading">How are you getting started?</h2>
              <p className="text-sm text-dash-muted mt-1">Choose your starting point</p>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                <button
                  type="button"
                  onClick={() => setProjectType("fresh")}
                  className={`flex flex-col items-center justify-center gap-3 p-5 rounded-lg border-2 transition-colors text-center ${
                    projectType === "fresh"
                      ? "border-primary-blue bg-primary-blue/5"
                      : "border-neutral-border hover:border-primary-blue/30 hover:bg-surface-hover"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    projectType === "fresh" ? "bg-primary-blue/10" : "bg-surface-hover"
                  }`}>
                    <Rocket className={`w-5 h-5 ${projectType === "fresh" ? "text-primary-blue" : "text-dash-muted"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-dash-heading">Starting fresh</p>
                    <p className="text-xs text-dash-muted mt-0.5">Create a brand new project</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setProjectType("migrate")}
                  className={`flex flex-col items-center justify-center gap-3 p-5 rounded-lg border-2 transition-colors text-center ${
                    projectType === "migrate"
                      ? "border-primary-blue bg-primary-blue/5"
                      : "border-neutral-border hover:border-primary-blue/30 hover:bg-surface-hover"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    projectType === "migrate" ? "bg-primary-blue/10" : "bg-surface-hover"
                  }`}>
                    <Server className={`w-5 h-5 ${projectType === "migrate" ? "text-primary-blue" : "text-dash-muted"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-dash-heading">Migrating</p>
                    <p className="text-xs text-dash-muted mt-0.5">From Supabase, Neon, or AWS</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Pick Region */}
          {step === 3 && (
            <div className="flex-1 flex flex-col">
              <h2 className="text-lg font-semibold text-dash-heading">Pick a region</h2>
              <p className="text-sm text-dash-muted mt-1">Choose the region closest to your users</p>
              <div className="mt-6 space-y-3 flex-1">
                <button
                  type="button"
                  onClick={() => setRegion("us-east")}
                  className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-colors text-left ${
                    region === "us-east"
                      ? "border-primary-blue bg-primary-blue/5"
                      : "border-neutral-border hover:border-primary-blue/30 hover:bg-surface-hover"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    region === "us-east" ? "bg-primary-blue/10" : "bg-surface-hover"
                  }`}>
                    <Globe className={`w-5 h-5 ${region === "us-east" ? "text-primary-blue" : "text-dash-muted"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-dash-heading">US East (Virginia)</p>
                    <p className="text-xs text-dash-muted">us-east-1 &middot; Low latency for North America & Europe</p>
                  </div>
                  {region === "us-east" && (
                    <CheckCircle2 className="w-5 h-5 text-primary-blue ml-auto shrink-0" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setRegion("in-mumbai")}
                  className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-colors text-left ${
                    region === "in-mumbai"
                      ? "border-primary-blue bg-primary-blue/5"
                      : "border-neutral-border hover:border-primary-blue/30 hover:bg-surface-hover"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    region === "in-mumbai" ? "bg-primary-blue/10" : "bg-surface-hover"
                  }`}>
                    <Globe className={`w-5 h-5 ${region === "in-mumbai" ? "text-primary-blue" : "text-dash-muted"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-dash-heading">India (Mumbai)</p>
                    <p className="text-xs text-dash-muted">ap-south-1 &middot; Low latency for South & Southeast Asia</p>
                  </div>
                  {region === "in-mumbai" && (
                    <CheckCircle2 className="w-5 h-5 text-primary-blue ml-auto shrink-0" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Project Details */}
          {step === 4 && (
            <div className="flex-1 flex flex-col">
              <h2 className="text-lg font-semibold text-dash-heading">Project details</h2>
              <p className="text-sm text-dash-muted mt-1">Give your project a name and description</p>
              <div className="mt-6 space-y-4 flex-1">
                <div>
                  <label htmlFor="onb-project-name" className="block text-sm font-medium text-dash-body mb-1.5">
                    Project name
                  </label>
                  <input
                    id="onb-project-name"
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="my-awesome-project"
                    className="w-full px-3 py-2 text-sm border border-neutral-border rounded-md bg-surface-card text-dash-body placeholder:text-dash-disabled focus:outline-none focus:ring-2 focus:ring-primary-blue/20 focus:border-primary-blue"
                  />
                </div>
                <div>
                  <label htmlFor="onb-project-desc" className="block text-sm font-medium text-dash-body mb-1.5">
                    Description <span className="text-dash-muted font-normal">(optional)</span>
                  </label>
                  <textarea
                    id="onb-project-desc"
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    placeholder="A brief description of your project"
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-neutral-border rounded-md bg-surface-card text-dash-body placeholder:text-dash-disabled focus:outline-none focus:ring-2 focus:ring-primary-blue/20 focus:border-primary-blue resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Ready */}
          {step === 5 && (
            <div className="flex-1 flex flex-col">
              <div className="text-center mb-6">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-status-success-bg flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-7 h-7 text-status-success" />
                </div>
                <h2 className="text-xl font-semibold text-dash-heading">Your project is ready!</h2>
                <p className="text-sm text-dash-muted mt-2">
                  <span className="font-medium text-dash-body">{projectName || "Your project"}</span> has been created. Here are some next steps to get going.
                </p>
              </div>
              <div className="space-y-2 flex-1">
                <Link
                  href="/app/myapp-prod/database"
                  onClick={onClose}
                  className="flex items-center gap-3 p-3.5 rounded-lg border border-neutral-border hover:border-primary-blue/30 hover:bg-primary-blue/5 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary-blue/10 flex items-center justify-center shrink-0">
                    <Database className="w-4.5 h-4.5 text-primary-blue" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-dash-heading">Connect your database</p>
                    <p className="text-xs text-dash-muted">Get your connection string and start querying</p>
                  </div>
                </Link>
                <Link
                  href="/app/myapp-prod/agents"
                  onClick={onClose}
                  className="flex items-center gap-3 p-3.5 rounded-lg border border-neutral-border hover:border-primary-blue/30 hover:bg-primary-blue/5 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary-purple/10 flex items-center justify-center shrink-0">
                    <Bot className="w-4.5 h-4.5 text-primary-purple" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-dash-heading">Create an agent</p>
                    <p className="text-xs text-dash-muted">Choose from 60+ templates to get started</p>
                  </div>
                </Link>
                <Link
                  href="/app/myapp-prod/team"
                  onClick={onClose}
                  className="flex items-center gap-3 p-3.5 rounded-lg border border-neutral-border hover:border-primary-blue/30 hover:bg-primary-blue/5 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                    <Users className="w-4.5 h-4.5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-dash-heading">Invite your team</p>
                    <p className="text-xs text-dash-muted">Collaborate with your teammates</p>
                  </div>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="px-6 pb-5 flex items-center justify-between">
          <div>
            {step > 1 && step < 5 && (
              <button
                type="button"
                onClick={handleBack}
                className="px-4 py-2 text-sm font-medium text-dash-body hover:text-dash-heading transition-colors"
              >
                Back
              </button>
            )}
          </div>
          <div>
            {step < 5 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!canGoNext()}
                className="px-5 py-2 text-sm font-medium text-white bg-primary-blue rounded-md hover:bg-primary-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {step === 1 ? "Get Started" : "Next"}
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 text-sm font-medium text-white bg-primary-blue rounded-md hover:bg-primary-blue/90 transition-colors"
              >
                Go to Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
