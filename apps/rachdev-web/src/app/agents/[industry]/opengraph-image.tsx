import { ImageResponse } from "next/og";
import { getIndustry, industrySlugs } from "@/lib/industries";

export const alt = "Rach.Dev AI agents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return industrySlugs.map((industry) => ({ industry }));
}

export default function OgImage({ params }: { params: { industry: string } }) {
  const config = getIndustry(params.industry);
  const title = config?.seoTitle ?? "AI Agents for your business";
  const vertical = config?.vertical ?? "Rach.Dev";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "linear-gradient(135deg, #0A0B0E 0%, #0C1430 58%, #0F1C42 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg,#2563EB,#1542CC)",
              display: "flex",
            }}
          />
          <div style={{ display: "flex", fontSize: 30, fontWeight: 800, letterSpacing: -1, color: "#ffffff" }}>
            Rach.Dev
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 2,
              color: "#93c5fd",
            }}
          >
            {`${vertical} · Agentic Operations Layer`}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 64,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 980,
            }}
          >
            {title}
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 26, color: "#aab0d4", maxWidth: 1000 }}>
          A team of AI agents on your existing systems — clinician in the loop, full audit trail.
        </div>
      </div>
    ),
    size,
  );
}
