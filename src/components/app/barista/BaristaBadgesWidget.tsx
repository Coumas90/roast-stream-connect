import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBaristaBadges } from "@/hooks/useBaristaBadges";
import { useProfile } from "@/hooks/useProfile";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export function BaristaBadgesWidget() {
  const { profile } = useProfile();
  const { data: badges, isLoading } = useBaristaBadges(profile?.id);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            Tus Logros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const earnedBadges = badges?.filter(b => b.earned) || [];
  const lockedBadges = badges?.filter(b => !b.earned) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl">🏆</span>
          Tus Logros
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {earnedBadges.length} de {badges?.length || 0} logros desbloqueados
        </p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-3">
            {/* Badges ganados */}
            {earnedBadges.map(badge => (
              <div 
                key={badge.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 animate-fade-in"
              >
                <div className="text-3xl flex-shrink-0">{badge.icon}</div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    {badge.name}
                    <span className="text-xs text-green-600">✓</span>
                  </h4>
                  <p className="text-xs text-muted-foreground">{badge.description}</p>
                  {badge.earnedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Conseguido {formatDistanceToNow(new Date(badge.earnedAt), { addSuffix: true, locale: es })}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* Badges bloqueados */}
            {lockedBadges.map(badge => (
              <div 
                key={badge.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 opacity-60"
              >
                <div className="text-3xl flex-shrink-0 grayscale">{badge.icon}</div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    {badge.name}
                    <span className="text-xs">🔒</span>
                  </h4>
                  <p className="text-xs text-muted-foreground">{badge.description}</p>
                  
                  {/* Barra de progreso si aplica */}
                  {badge.maxProgress && badge.progress !== undefined && (
                    <div className="mt-2 space-y-1">
                      <Progress value={(badge.progress / badge.maxProgress) * 100} className="h-1.5" />
                      <p className="text-xs text-muted-foreground">
                        {badge.progress} / {badge.maxProgress}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
