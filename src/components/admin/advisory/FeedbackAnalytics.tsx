import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, TrendingUp, Users, MessageSquare } from "lucide-react";
import { useFeedbackAnalytics, useAllTrainingFeedback } from "@/hooks/useTrainingFeedback";

const RatingDisplay = ({ rating, label }: { rating: number; label: string }) => {
  return (
    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <div className="flex">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`h-4 w-4 ${
                star <= Math.round(rating)
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300"
              }`}
            />
          ))}
        </div>
        <span className="text-sm font-semibold">{rating.toFixed(1)}</span>
      </div>
    </div>
  );
};

export function FeedbackAnalytics() {
  const { data: analytics, isLoading: analyticsLoading } = useFeedbackAnalytics();
  const { data: allFeedback, isLoading: feedbackLoading } = useAllTrainingFeedback();

  if (analyticsLoading || feedbackLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="h-20 bg-muted/50"></CardHeader>
            <CardContent className="h-32 bg-muted/20"></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!analytics || !allFeedback) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No hay datos de feedback disponibles aún.</p>
        </CardContent>
      </Card>
    );
  }

  const satisfactionLevel = analytics.averages.overall >= 4.5 ? "Excelente" :
                          analytics.averages.overall >= 4.0 ? "Muy Bueno" :
                          analytics.averages.overall >= 3.5 ? "Bueno" :
                          analytics.averages.overall >= 3.0 ? "Regular" : "Necesita Mejoras";

  const satisfactionColor = analytics.averages.overall >= 4.5 ? "bg-green-500" :
                           analytics.averages.overall >= 4.0 ? "bg-blue-500" :
                           analytics.averages.overall >= 3.5 ? "bg-yellow-500" :
                           analytics.averages.overall >= 3.0 ? "bg-orange-500" : "bg-red-500";

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Feedback Total</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalFeedback}</div>
            <p className="text-xs text-muted-foreground">
              Encuestas completadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Satisfacción Promedio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">{analytics.averages.overall.toFixed(1)}</div>
              <Badge className={satisfactionColor}>
                {satisfactionLevel}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              De 5.0 posible
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mejor Categoría</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.max(
                analytics.averages.content,
                analytics.averages.instructor,
                analytics.averages.venue
              ).toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.averages.instructor >= analytics.averages.content && 
               analytics.averages.instructor >= analytics.averages.venue ? "Instructor" :
               analytics.averages.content >= analytics.averages.venue ? "Contenido" : "Instalaciones"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Ratings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Calificaciones Promedio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <RatingDisplay rating={analytics.averages.overall} label="General" />
            <RatingDisplay rating={analytics.averages.content} label="Contenido" />
            <RatingDisplay rating={analytics.averages.instructor} label="Instructor" />
            <RatingDisplay rating={analytics.averages.venue} label="Instalaciones" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Por Tipo de Capacitación</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(analytics.byTrainingType).map(([type, data]) => (
                <div key={type} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <span className="font-medium">{type}</span>
                    <p className="text-xs text-muted-foreground">{data.count} evaluaciones</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold">
                      {(data.totalRating / data.count).toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Feedback Comments */}
      <Card>
        <CardHeader>
          <CardTitle>Comentarios Recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {allFeedback
              .filter(f => f.what_learned || f.suggestions || f.additional_comments)
              .slice(0, 5)
              .map((feedback) => (
                <div key={feedback.id} className="border-l-4 border-l-primary pl-4 py-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-3 w-3 ${
                            star <= (feedback.overall_rating || 0)
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(feedback.submitted_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {feedback.what_learned && (
                    <p className="text-sm mb-1">
                      <span className="font-medium">Aprendizaje:</span> {feedback.what_learned}
                    </p>
                  )}
                  
                  {feedback.suggestions && (
                    <p className="text-sm mb-1">
                      <span className="font-medium">Sugerencias:</span> {feedback.suggestions}
                    </p>
                  )}
                  
                  {feedback.additional_comments && (
                    <p className="text-sm">
                      <span className="font-medium">Comentarios:</span> {feedback.additional_comments}
                    </p>
                  )}
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}