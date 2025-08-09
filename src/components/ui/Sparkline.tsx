import * as React from "react";
import { ResponsiveContainer, LineChart, Line } from "recharts";

export type SparklineProps = {
  data: number[];
  height?: number;
  stroke?: string; // Use design tokens via CSS variables, e.g., "hsl(var(--primary))"
};

export function Sparkline({ data, height = 40, stroke = "hsl(var(--primary))" }: SparklineProps) {
  const points = React.useMemo(() => data.map((v, idx) => ({ idx, v })), [data]);
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 6, bottom: 0, left: 0, right: 0 }}>
          <Line type="monotone" dataKey="v" stroke={stroke} strokeWidth={2} dot={false} isAnimationActive />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default Sparkline;
