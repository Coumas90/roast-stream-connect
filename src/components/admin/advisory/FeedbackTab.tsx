import React from "react";
import { FeedbackAnalytics } from "./FeedbackAnalytics";

export function FeedbackTab() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Análisis de Feedback</h2>
        <p className="text-sm text-muted-foreground">
          Métricas y comentarios de las capacitaciones completadas
        </p>
      </div>
      
      <FeedbackAnalytics />
    </div>
  );
}