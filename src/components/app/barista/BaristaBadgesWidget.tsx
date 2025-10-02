import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Award, Lock } from "lucide-react";
import { useBaristaBadges } from "@/hooks/useBaristaBadges";
import { useProfile } from "@/hooks/useProfile";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export function BaristaBadgesWidget() {
  const { profile } = useProfile();
  const { data: badges, isLoading } = useBaristaBadges(profile?.id);

  if (isLoading) {
    return <Skeleton className="h-96" />;
  }

  const earnedBadges = badges?.filter(b => b.earned) || [];
  const lockedBadges = badges?.filter(b => !b.earned) || [];

  return (
    <Card className="shadow-elegant border-0 bg-gradient-card">
      <CardHeader className="border-b border-border/50">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <Award className="h-5 w-5 text-yellow-500" />
            </div>
            Logros
          </div>
          <Badge variant="secondary" className="text-xs">
            {earnedBadges.length}/{badges?.length || 0}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-6">
            {/* Earned Badges */}
            {earnedBadges.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
                  Desbloqueados
                </h3>
                <div className="space-y-3">
                  {earnedBadges.map((badge) => (
                    <div
                      key={badge.id}
                      className="p-4 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors border border-primary/20"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-3xl">{badge.icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className={`font-semibold ${badge.color}`}>
                              {badge.name}
                            </h4>
                            <Badge variant="default" className="text-xs">
                              ✓
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            {badge.description}
                          </p>
                          {badge.earnedAt && (
                            <p className="text-xs text-muted-foreground">
                              Obtenido {formatDistanceToNow(new Date(badge.earnedAt), { 
                                addSuffix: true, 
                                locale: es 
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Locked Badges */}
            {lockedBadges.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
                  Bloqueados
                </h3>
                <div className="space-y-3">
                  {lockedBadges.map((badge) => (
                    <div
                      key={badge.id}
                      className="p-4 rounded-lg bg-muted/30 border border-border/50 opacity-70"
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative">
                          <span className="text-3xl grayscale">{badge.icon}</span>
                          <Lock className="h-4 w-4 text-muted-foreground absolute -bottom-1 -right-1" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-muted-foreground mb-1">
                            {badge.name}
                          </h4>
                          <p className="text-xs text-muted-foreground mb-2">
                            {badge.description}
                          </p>
                          {badge.progress !== undefined && badge.maxProgress && (
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Progreso</span>
                                <span>{badge.progress}/{badge.maxProgress}</span>
                              </div>
                              <Progress 
                                value={(badge.progress / badge.maxProgress) * 100} 
                                className="h-2"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
