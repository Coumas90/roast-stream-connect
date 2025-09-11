import React from 'react';
import { Recipe } from '@/hooks/useRecipes';
import { RecipeCard } from './RecipeCard';

interface VirtualizedRecipeGridProps {
  recipes: Recipe[];
  onEdit: (recipe: Recipe) => void;
  onView: (recipe: Recipe) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
  onDuplicate: (id: string) => void;
  onArchive: (id: string, archive: boolean) => void;
  onShare: (recipe: Recipe) => void;
  containerWidth?: number;
  containerHeight?: number;
}

const CARD_WIDTH = 320;
const CARD_HEIGHT = 280;
const PADDING = 16;

export function VirtualizedRecipeGrid({
  recipes,
  onEdit,
  onView,
  onToggleActive,
  onDuplicate,
  onArchive,
  onShare,
  containerWidth = 1200,
  containerHeight = 600
}: VirtualizedRecipeGridProps) {
  const columnsPerRow = Math.floor(containerWidth / (CARD_WIDTH + PADDING));
  const rowCount = Math.ceil(recipes.length / columnsPerRow);

  const Cell = React.memo(({ columnIndex, rowIndex, style }: any) => {
    const index = rowIndex * columnsPerRow + columnIndex;
    const recipe = recipes[index];

    if (!recipe) {
      return <div style={style} />;
    }

    return (
      <div 
        style={{
          ...style,
          padding: PADDING / 2,
          width: style.width - PADDING,
          height: style.height - PADDING,
          left: style.left + PADDING / 2,
          top: style.top + PADDING / 2
        }}
      >
        <RecipeCard
          recipe={{...recipe, coffee: recipe.coffee_amount || ""}}
          onEdit={() => onEdit(recipe)}
          onView={() => onView(recipe)}
          onToggleActive={(recipe, isActive: boolean) => onToggleActive(recipe.id, isActive)}
          onDuplicate={() => onDuplicate(recipe.id)}
          onArchive={(recipe) => onArchive(recipe.id, true)}
          onShare={() => onShare(recipe)}
        />
      </div>
    );
  });

  Cell.displayName = 'RecipeGridCell';

  // Always render as regular grid since virtualization has package issues
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {recipes.map((recipe) => (
        <RecipeCard
          key={recipe.id}
          recipe={{...recipe, coffee: recipe.coffee_amount || ""}}
          onEdit={() => onEdit(recipe)}
          onView={() => onView(recipe)}
          onToggleActive={(recipe, isActive: boolean) => onToggleActive(recipe.id, isActive)}
          onDuplicate={() => onDuplicate(recipe.id)}
          onArchive={(recipe) => onArchive(recipe.id, true)}
          onShare={() => onShare(recipe)}
        />
      ))}
    </div>
  );
}