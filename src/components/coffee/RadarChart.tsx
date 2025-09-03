import React from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";

interface RadarChartProps {
  data: {
    sweetness?: number;
    aroma?: number;
    flavor?: number;
    aftertaste?: number;
    acidity?: number;
    body?: number;
    balance?: number;
    overall?: number;
  };
  className?: string;
}

export function CoffeeRadarChart({ data, className = "" }: RadarChartProps) {
  const chartData = [
    { subject: "Dulzor", A: data.sweetness || 0, fullMark: 10 },
    { subject: "Aroma", A: data.aroma || 0, fullMark: 10 },
    { subject: "Sabor", A: data.flavor || 0, fullMark: 10 },
    { subject: "Retrogusto", A: data.aftertaste || 0, fullMark: 10 },
    { subject: "Acidez", A: data.acidity || 0, fullMark: 10 },
    { subject: "Cuerpo", A: data.body || 0, fullMark: 10 },
    { subject: "Balance", A: data.balance || 0, fullMark: 10 },
    { subject: "General", A: data.overall || 0, fullMark: 10 },
  ];

  return (
    <div className={`w-full h-80 ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={chartData}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
          />
          <PolarRadiusAxis 
            domain={[0, 10]} 
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickCount={6}
          />
          <Radar
            name="Puntuación"
            dataKey="A"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.3}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}