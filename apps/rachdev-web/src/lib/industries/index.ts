import type { IndustryConfig } from "./types";
import { medicalConfig } from "./medical";
import { realEstateConfig } from "./real-estate";
import { legalConfig } from "./legal";
import { financialServicesConfig } from "./financial-services";
import { educationConfig } from "./education";
import { hospitalityConfig } from "./hospitality";
import { saasConfig } from "./saas";
import { recruitmentConfig } from "./recruitment";
import { professionalServicesConfig } from "./professional-services";
import { insuranceConfig } from "./insurance";
import { automotiveConfig } from "./automotive";
import { nonProfitConfig } from "./non-profit";
import { fitnessWellnessConfig } from "./fitness-wellness";
import { foodBeverageConfig } from "./food-beverage";
import { ecommerceConfig } from "./e-commerce";

/**
 * Registry of industry-demo configs.
 *
 * Add a vertical by importing its config and adding one line here — no component
 * edits required. `generateStaticParams`, the `/agents` index, sitemap, route
 * metadata and OG images all derive from this.
 */
export const industryRegistry: Record<string, IndustryConfig> = {
  medical: medicalConfig,
  "real-estate": realEstateConfig,
  legal: legalConfig,
  "financial-services": financialServicesConfig,
  education: educationConfig,
  hospitality: hospitalityConfig,
  saas: saasConfig,
  recruitment: recruitmentConfig,
  "professional-services": professionalServicesConfig,
  insurance: insuranceConfig,
  automotive: automotiveConfig,
  "non-profit": nonProfitConfig,
  "fitness-wellness": fitnessWellnessConfig,
  "food-beverage": foodBeverageConfig,
  "e-commerce": ecommerceConfig,
};

export const industrySlugs = Object.keys(industryRegistry);

export function getIndustry(slug: string): IndustryConfig | undefined {
  return industryRegistry[slug];
}

export type { IndustryConfig };
