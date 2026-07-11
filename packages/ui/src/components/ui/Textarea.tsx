import { forwardRef } from "react";
import { cn } from "../../lib/utils";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const textareaId = id || label.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className={cn("w-full", className)}>
        <label
          htmlFor={textareaId}
          className="mb-1.5 block text-sm font-medium text-text-primary"
        >
          {label}
        </label>
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            "min-h-[120px] w-full resize-y rounded-lg border border-neutral-border bg-white px-4 py-3 text-sm text-text-primary placeholder:text-text-muted transition-colors duration-200 outline-none focus:border-primary-blue focus:ring-2 focus:ring-primary-blue/20",
            error && "border-red-400 focus:border-red-400 focus:ring-red-400/20"
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-red-500">{error}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
