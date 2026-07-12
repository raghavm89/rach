"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const COLORS = {
  primary: "#477EF7",
  secondary: "#8260F6",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  grid: "#E5E7EB",
  text: "#64748B",
};

const defaultTooltipStyle = {
  borderRadius: "8px",
  border: "1px solid #E5E7EB",
  fontSize: "13px",
  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
};

const defaultAxisProps = {
  tick: { fontSize: 12, fill: COLORS.text },
  tickLine: false,
  axisLine: { stroke: COLORS.grid },
};

interface ChartProps {
  data: Record<string, unknown>[];
  height?: number;
  className?: string;
}

interface LineChartWrapperProps extends ChartProps {
  xKey: string;
  lines: { dataKey: string; color?: string; label?: string }[];
}

interface BarChartWrapperProps extends ChartProps {
  xKey: string;
  bars: { dataKey: string; color?: string; label?: string }[];
  layout?: "horizontal" | "vertical";
}

interface AreaChartWrapperProps extends ChartProps {
  xKey: string;
  areas: { dataKey: string; color?: string; label?: string }[];
}

export function DashLineChart({ data, xKey, lines, height = 200, className }: LineChartWrapperProps) {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
          <XAxis dataKey={xKey} {...defaultAxisProps} />
          <YAxis {...defaultAxisProps} />
          <Tooltip contentStyle={defaultTooltipStyle} />
          {lines.map((line) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              stroke={line.color || COLORS.primary}
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
              name={line.label || line.dataKey}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DashBarChart({ data, xKey, bars, height = 200, layout = "horizontal", className }: BarChartWrapperProps) {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout={layout}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
          <XAxis dataKey={layout === "horizontal" ? xKey : undefined} type={layout === "horizontal" ? "category" : "number"} {...defaultAxisProps} />
          <YAxis dataKey={layout === "vertical" ? xKey : undefined} type={layout === "vertical" ? "category" : "number"} {...defaultAxisProps} width={layout === "vertical" ? 100 : 60} />
          <Tooltip contentStyle={defaultTooltipStyle} />
          {bars.map((bar) => (
            <Bar
              key={bar.dataKey}
              dataKey={bar.dataKey}
              fill={bar.color || COLORS.primary}
              radius={[4, 4, 0, 0]}
              name={bar.label || bar.dataKey}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DashAreaChart({ data, xKey, areas, height = 200, className }: AreaChartWrapperProps) {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
          <XAxis dataKey={xKey} {...defaultAxisProps} />
          <YAxis {...defaultAxisProps} />
          <Tooltip contentStyle={defaultTooltipStyle} />
          {areas.map((area) => (
            <Area
              key={area.dataKey}
              type="monotone"
              dataKey={area.dataKey}
              stroke={area.color || COLORS.primary}
              fill={area.color || COLORS.primary}
              fillOpacity={0.1}
              strokeWidth={2}
              name={area.label || area.dataKey}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export { COLORS as chartColors };
