import { cn } from "../../lib/utils";
import { Card } from "./Card";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Check } from "lucide-react";

interface FeatureItem {
  label: string;
  value: string | boolean;
}

interface FeatureCategory {
  category: string;
  items: FeatureItem[];
}

interface PricingCardProps {
  name: string;
  price: number;
  period: string;
  description: string;
  features: FeatureCategory[];
  highlighted?: boolean;
  ctaLabel?: string;
  ctaHref?: string;
}

export function PricingCard({
  name,
  price,
  period,
  description,
  features,
  highlighted = false,
  ctaLabel = "Get Started",
  ctaHref = "/contact",
}: PricingCardProps) {
  return (
    <div className={cn("relative", highlighted && "lg:scale-105")}>
      {highlighted && (
        <div className="flex justify-center">
          <Badge className="-mb-3 relative z-10">Most Popular</Badge>
        </div>
      )}
      <Card
        hoverLift={false}
        gradientBorder={highlighted}
        className={cn(
          "flex flex-col",
          highlighted && "ring-2 ring-accent/20 shadow-well"
        )}
      >
        {/* Plan name & description */}
        <div className="mb-6">
          <h3 className="font-display text-xl font-bold text-ink">
            {name}
          </h3>
          <p className="mt-1 text-sm text-ink-2">{description}</p>
        </div>

        {/* Price */}
        <div className="mb-8 flex items-baseline gap-1">
          <span className="font-mono text-5xl font-bold text-ink">
            ${price}
          </span>
          <span className="text-ink-3">/{period}</span>
        </div>

        {/* Features grouped by category */}
        <div className="mb-8 flex-1 space-y-6">
          {features.map((group) => (
            <div key={group.category}>
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-3">
                {group.category}
              </p>
              <ul className="space-y-2.5">
                {group.items.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-ink-2">{item.label}</span>
                    <span className="ml-4 shrink-0">
                      {typeof item.value === "boolean" ? (
                        item.value ? (
                          <Check className="h-4 w-4 text-ok" />
                        ) : (
                          <span className="text-ink-3">&mdash;</span>
                        )
                      ) : (
                        <span className="font-medium text-ink">
                          {item.value}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* CTA */}
        <Button
          href={ctaHref}
          variant={highlighted ? "primary" : "secondary"}
          className="w-full"
        >
          {ctaLabel}
        </Button>
      </Card>
    </div>
  );
}
