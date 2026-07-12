import { cn } from "@rach/ui/lib/utils";
import {
  Key,
  Bot,
  UserPlus,
  Table,
  HardDrive,
  Users,
  Settings,
  AlertTriangle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { ActivityEvent } from "@/data/mock/activity";

const iconMap: Record<ActivityEvent["type"], React.ElementType> = {
  api_key_created: Key,
  agent_deployed: Bot,
  user_signup: UserPlus,
  table_created: Table,
  backup_completed: HardDrive,
  team_invite: Users,
  settings_changed: Settings,
  agent_error: AlertTriangle,
};

const colorMap: Record<ActivityEvent["type"], string> = {
  api_key_created: "text-status-info bg-status-info-bg",
  agent_deployed: "text-status-success bg-status-success-bg",
  user_signup: "text-primary-blue bg-primary-blue/10",
  table_created: "text-primary-purple bg-primary-purple/10",
  backup_completed: "text-status-success bg-status-success-bg",
  team_invite: "text-status-info bg-status-info-bg",
  settings_changed: "text-status-warning bg-status-warning-bg",
  agent_error: "text-status-danger bg-status-danger-bg",
};

interface ActivityFeedProps {
  events: ActivityEvent[];
  className?: string;
}

export function ActivityFeed({ events, className }: ActivityFeedProps) {
  return (
    <div className={cn("space-y-0", className)}>
      {events.map((event, i) => {
        const Icon = iconMap[event.type] || Settings;
        const color = colorMap[event.type] || "text-dash-muted bg-surface-hover";

        return (
          <div
            key={event.id}
            className={cn(
              "flex items-start gap-3 py-3 px-1",
              i < events.length - 1 && "border-b border-neutral-border"
            )}
          >
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", color)}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-dash-body">{event.description}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-dash-muted">{event.actor}</span>
                <span className="text-xs text-dash-disabled">
                  {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
