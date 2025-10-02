import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lightbulb, AlertTriangle, Trophy } from "lucide-react";
import { useBaristaInsights } from "@/hooks/useBaristaInsights";
import { useProfile } from "@/hooks/useProfile";
import { Skeleton } from "@/components/ui/skeleton";

export function BaristaInsightsWidget() {
  const { profile } = useProfile();
  const { data: insights, isLoading } = useBaristaInsights(profile?.id);

  if (isLoading) {
    return <Skeleton className="h-96" />;
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'tip':
        return <Lightbulb className="h-5 w-5" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5" />;
      case 'achievement':
        return <Trophy className="h-5 w-5" />;
      default:
        return <Lightbulb className="h-5 w-5" />;
    }
  };

  const getVariant = (type: string): "default" | "destructive" => {
    return type === 'warning' ? 'destructive' : 'default';
  };

  return (
    <Card className="shadow-elegant border-0 bg-gradient-card">
      <CardHeader className="border-b border-border/50">
        <CardTitle className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <Lightbulb className="h-5 w-5 text-purple-500" />
          </div>
          Insights y Sugerencias
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {insights && insights.length > 0 ? (
          <div className="space-y-4">
            {insights.slice(0, 3).map((insight, index) => (
              <Alert 
                key={index} 
                variant={getVariant(insight.type)}
                className="animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{insight.icon}</span>
                  <div className="flex-1">
                    <AlertTitle className="flex items-center gap-2">
                      {getIcon(insight.type)}
                      {insight.title}
                    </AlertTitle>
                    <AlertDescription className="mt-2">
                      {insight.message}
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Lightbulb className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Continúa calibrando para recibir insights personalizados
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
