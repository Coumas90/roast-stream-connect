import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lightbulb, TrendingUp, Users, Clock, Star } from 'lucide-react';
import { Recipe } from '@/hooks/useRecipes';

interface RecipeRecommendationsProps {
  userRecipes: Recipe[];
  allRecipes: Recipe[];
  onRecipeSelect: (recipe: Recipe) => void;
}

interface Recommendation {
  recipe: Recipe;
  reason: string;
  score: number;
  icon: React.ComponentType<any>;
  category: 'trending' | 'similar' | 'beginner' | 'advanced' | 'quick';
}

export function RecipeRecommendations({ 
  userRecipes, 
  allRecipes, 
  onRecipeSelect 
}: RecipeRecommendationsProps) {
  const recommendations = React.useMemo(() => {
    const userMethods = userRecipes.map(r => r.method).filter(Boolean);
    const userCoffeeTypes = userRecipes.map(r => r.coffee_type).filter(Boolean);
    const userAvgTime = userRecipes
      .filter(r => r.time)
      .reduce((sum, r) => sum + parseInt(r.time || '0'), 0) / userRecipes.filter(r => r.time).length || 15;

    const recs: Recommendation[] = [];

    // Get recipes user hasn't created
    const availableRecipes = allRecipes.filter(
      recipe => !userRecipes.some(ur => ur.id === recipe.id) && recipe.status === 'published' && recipe.is_active
    );

    // Trending recipes (most recent or popular)
    const trending = availableRecipes
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 2)
      .map(recipe => ({
        recipe,
        reason: "Recently updated and gaining popularity",
        score: 0.9,
        icon: TrendingUp,
        category: 'trending' as const
      }));

    // Similar methods
    const similarMethods = availableRecipes
      .filter(recipe => recipe.method && userMethods.includes(recipe.method))
      .slice(0, 2)
      .map(recipe => ({
        recipe,
        reason: `Similar to your ${recipe.method} recipes`,
        score: 0.8,
        icon: Users,
        category: 'similar' as const
      }));

    // Quick recipes for busy users
    const quickRecipes = availableRecipes
      .filter(recipe => recipe.time && parseInt(recipe.time) <= userAvgTime * 0.7)
      .slice(0, 2)
      .map(recipe => ({
        recipe,
        reason: `Quick ${recipe.time}min recipe for busy days`,
        score: 0.7,
        icon: Clock,
        category: 'quick' as const
      }));

    // Beginner-friendly recipes
    const beginnerRecipes = availableRecipes
      .filter(recipe => 
        recipe.type === 'template' || 
        (recipe.method && ['french-press', 'cold-brew'].includes(recipe.method))
      )
      .slice(0, 2)
      .map(recipe => ({
        recipe,
        reason: "Perfect for learning new techniques",
        score: 0.6,
        icon: Lightbulb,
        category: 'beginner' as const
      }));

    // Advanced techniques
    const advancedRecipes = availableRecipes
      .filter(recipe => 
        recipe.method && ['espresso', 'v60', 'chemex'].includes(recipe.method) &&
        !userMethods.includes(recipe.method)
      )
      .slice(0, 2)
      .map(recipe => ({
        recipe,
        reason: "Challenge yourself with advanced techniques",
        score: 0.8,
        icon: Star,
        category: 'advanced' as const
      }));

    recs.push(...trending, ...similarMethods, ...quickRecipes, ...beginnerRecipes, ...advancedRecipes);

    // Remove duplicates and sort by score
    const uniqueRecs = recs.filter((rec, index, arr) => 
      arr.findIndex(r => r.recipe.id === rec.recipe.id) === index
    );

    return uniqueRecs.sort((a, b) => b.score - a.score).slice(0, 6);
  }, [userRecipes, allRecipes]);

  if (recommendations.length === 0) {
    return null;
  }

  const categoryColors = {
    trending: 'bg-blue-500/10 text-blue-700 border-blue-200',
    similar: 'bg-green-500/10 text-green-700 border-green-200',
    quick: 'bg-orange-500/10 text-orange-700 border-orange-200',
    beginner: 'bg-purple-500/10 text-purple-700 border-purple-200',
    advanced: 'bg-red-500/10 text-red-700 border-red-200'
  };

  const categoryLabels = {
    trending: 'Trending',
    similar: 'Similar Style',
    quick: 'Quick Recipe',
    beginner: 'Beginner Friendly',
    advanced: 'Advanced'
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          Recipe Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recommendations.map((rec, index) => (
            <Card 
              key={rec.recipe.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onRecipeSelect(rec.recipe)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <Badge 
                    variant="outline" 
                    className={categoryColors[rec.category]}
                  >
                    <rec.icon className="h-3 w-3 mr-1" />
                    {categoryLabels[rec.category]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(rec.score * 100)}% match
                  </span>
                </div>
                
                <h4 className="font-medium mb-1 line-clamp-1">
                  {rec.recipe.name}
                </h4>
                
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {rec.reason}
                </p>
                
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {rec.recipe.method && (
                    <Badge variant="secondary" className="text-xs">
                      {rec.recipe.method}
                    </Badge>
                  )}
                  {rec.recipe.time && (
                    <span>{rec.recipe.time}m</span>
                  )}
                </div>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-3"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRecipeSelect(rec.recipe);
                  }}
                >
                  View Recipe
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}