import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Users, Clock, Star, Coffee } from 'lucide-react';
import { Recipe } from '@/hooks/useRecipes';

interface RecipeAnalyticsDashboardProps {
  recipes: Recipe[];
}

export function RecipeAnalyticsDashboard({ recipes }: RecipeAnalyticsDashboardProps) {
  const analytics = React.useMemo(() => {
    const total = recipes.length;
    const active = recipes.filter(r => r.is_active).length;
    const byStatus = recipes.reduce((acc, recipe) => {
      acc[recipe.status] = (acc[recipe.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const byType = recipes.reduce((acc, recipe) => {
      acc[recipe.type] = (acc[recipe.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const avgTime = recipes
      .filter(r => r.time)
      .reduce((sum, r) => sum + parseInt(r.time || '0'), 0) / 
      recipes.filter(r => r.time).length || 0;

    const popularMethods = recipes.reduce((acc, recipe) => {
      if (recipe.method) {
        acc[recipe.method] = (acc[recipe.method] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const topMethod = Object.entries(popularMethods)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A';

    return {
      total,
      active,
      byStatus,
      byType,
      avgTime: Math.round(avgTime),
      topMethod,
      popularMethods
    };
  }, [recipes]);

  const kpis = [
    {
      title: "Total Recipes",
      value: analytics.total,
      icon: Coffee,
      trend: "+12%",
      color: "text-blue-600"
    },
    {
      title: "Active Recipes",
      value: analytics.active,
      icon: TrendingUp,
      trend: "+8%",
      color: "text-green-600"
    },
    {
      title: "Avg. Prep Time",
      value: `${analytics.avgTime}m`,
      icon: Clock,
      trend: "-2m",
      color: "text-orange-600"
    },
    {
      title: "Top Method",
      value: analytics.topMethod,
      icon: Star,
      trend: "Popular",
      color: "text-purple-600"
    }
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {kpi.title}
                  </p>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <p className={`text-xs ${kpi.color}`}>
                    {kpi.trend} from last month
                  </p>
                </div>
                <kpi.icon className={`h-8 w-8 ${kpi.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Status & Type Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recipe Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(analytics.byStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={status === 'active' ? 'default' : 'secondary'}>
                      {status}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {Math.round((count / analytics.total) * 100)}%
                    </span>
                  </div>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recipe Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(analytics.byType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {type}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {Math.round((count / analytics.total) * 100)}%
                    </span>
                  </div>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Popular Methods */}
      <Card>
        <CardHeader>
          <CardTitle>Popular Brewing Methods</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(analytics.popularMethods)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 8)
              .map(([method, count]) => (
                <div key={method} className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="font-medium capitalize">{method}</p>
                  <p className="text-2xl font-bold text-primary">{count}</p>
                  <p className="text-xs text-muted-foreground">recipes</p>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}