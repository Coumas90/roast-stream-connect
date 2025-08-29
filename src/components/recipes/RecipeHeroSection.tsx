import { RecipeHeroCard } from "./RecipeHeroCard";
import { type Recipe } from "./RecipeCard";

interface RecipeHeroSectionProps {
  recipe?: Recipe;
  onEdit?: (recipe: Recipe) => void;
  onDuplicate?: (recipe: Recipe) => void;
  onShare?: (recipe: Recipe) => void;
  onViewPDF?: (recipe: Recipe) => void;
}

export function RecipeHeroSection({ 
  recipe, 
  onEdit, 
  onDuplicate, 
  onShare, 
  onViewPDF 
}: RecipeHeroSectionProps) {
  if (!recipe) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-muted-foreground mb-2">
            No hay receta activa
          </h2>
          <p className="text-muted-foreground">
            Activa una receta para verla destacada aquí
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-background to-primary/5">
      <div className="container mx-auto px-6 py-8">
        <RecipeHeroCard
          recipe={recipe}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onShare={onShare}
          onViewPDF={onViewPDF}
        />
      </div>
    </div>
  );
}