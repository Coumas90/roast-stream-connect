import React, { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Download, Plus } from "lucide-react";
import { RecipeTabNavigation, type RecipeTab } from "@/components/recipes/RecipeTabNavigation";
import { RecipeFilters, type RecipeFilters as RecipeFiltersType } from "@/components/recipes/RecipeFilters";
import { RecipeCard, type Recipe } from "@/components/recipes/RecipeCard";
import { RecipeEmptyState } from "@/components/recipes/RecipeEmptyStates";
import { CreateRecipeModal } from "@/components/recipes/CreateRecipeModal";

// Mock data for development
const MOCK_RECIPES: Recipe[] = [
  {
    id: "1",
    name: "Espresso TUPÁ Signature",
    method: "Espresso",
    status: "active",
    type: "oficial",
    ratio: "1:2",
    coffee: "18g",
    time: "25-30s",
    temperature: "94°C",
    grind: "Fina",
    description: "Receta oficial para espresso con café TUPÁ Signature",
    isActive: true,
  },
  {
    id: "2",
    name: "Mi V60 Personal",
    method: "V60",
    status: "draft",
    type: "personal",
    ratio: "1:16",
    coffee: "22g",
    time: "3:30",
    temperature: "92°C",
    grind: "Media-fina",
    description: "Mi receta personalizada para V60 con notas florales",
    isActive: false,
  },
  {
    id: "3",
    name: "Cold Brew Equipo",
    method: "Cold Brew",
    status: "review",
    type: "team",
    ratio: "1:8",
    coffee: "100g",
    time: "12h",
    temperature: "Ambiente",
    grind: "Gruesa",
    description: "Receta compartida por el equipo para cold brew",
    isActive: false,
  },
];

export default function Recipes() {
  const [activeTab, setActiveTab] = useState<RecipeTab>("active");
  const [filters, setFilters] = useState<RecipeFiltersType>({});
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Filter recipes based on active tab and filters
  const filteredRecipes = useMemo(() => {
    let recipes = [...MOCK_RECIPES];

    // Filter by tab
    switch (activeTab) {
      case "active":
        recipes = recipes.filter(recipe => recipe.isActive);
        break;
      case "personal":
        recipes = recipes.filter(recipe => recipe.type === "personal");
        break;
      case "team":
        recipes = recipes.filter(recipe => recipe.type === "team");
        break;
      case "oficial":
        recipes = recipes.filter(recipe => recipe.type === "oficial");
        break;
      case "templates":
        // Admin only - would show template recipes
        recipes = [];
        break;
    }

    // Apply additional filters
    if (filters.method) {
      recipes = recipes.filter(recipe => 
        recipe.method.toLowerCase() === filters.method?.toLowerCase()
      );
    }

    if (filters.status) {
      recipes = recipes.filter(recipe => recipe.status === filters.status);
    }

    if (filters.search) {
      const search = filters.search.toLowerCase();
      recipes = recipes.filter(recipe =>
        recipe.name.toLowerCase().includes(search) ||
        recipe.description?.toLowerCase().includes(search)
      );
    }

    return recipes;
  }, [activeTab, filters]);

  // Calculate tab counts
  const tabCounts = useMemo(() => {
    return {
      active: MOCK_RECIPES.filter(r => r.isActive).length,
      personal: MOCK_RECIPES.filter(r => r.type === "personal").length,
      team: MOCK_RECIPES.filter(r => r.type === "team").length,
      oficial: MOCK_RECIPES.filter(r => r.type === "oficial").length,
      templates: 0,
    };
  }, []);

  const handleCreateRecipe = (data: any, isDraft: boolean) => {
    console.log("Creating recipe:", data, "as draft:", isDraft);
    // Here you would typically call an API to save the recipe
  };

  const handleRecipeAction = (action: string, recipe: Recipe) => {
    console.log(`${action} recipe:`, recipe);
    // Here you would handle recipe actions (edit, duplicate, share, etc.)
  };

  const clearFilters = () => {
    setFilters({});
  };

  return (
    <article className="flex flex-col h-full">
      <Helmet>
        <title>Recetas | TUPÁ Hub</title>
        <meta name="description" content="Gestiona tus recetas de café y parámetros de preparación" />
        <link rel="canonical" href="/app/recipes" />
      </Helmet>
      
      <h1 className="sr-only">Recetas</h1>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 border-b border-border">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Recetas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Parámetros de preparación para cada método
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Descargar Todas
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Receta
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <RecipeTabNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={tabCounts}
        isAdmin={false} // This would come from user context
      />

      {/* Filters */}
      <RecipeFilters
        filters={filters}
        onFiltersChange={setFilters}
        onClearFilters={clearFilters}
      />

      {/* Content */}
      <div className="flex-1 p-6">
        {filteredRecipes.length === 0 ? (
          <RecipeEmptyState
            tab={activeTab}
            onCreateNew={() => setIsCreateModalOpen(true)}
            onViewOficial={() => setActiveTab("oficial")}
            isAdmin={false}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onEdit={(recipe) => handleRecipeAction("edit", recipe)}
                onDuplicate={(recipe) => handleRecipeAction("duplicate", recipe)}
                onShare={(recipe) => handleRecipeAction("share", recipe)}
                onArchive={(recipe) => handleRecipeAction("archive", recipe)}
                onToggleActive={(recipe, isActive) => 
                  handleRecipeAction(`${isActive ? "activate" : "deactivate"}`, recipe)
                }
                onViewPDF={(recipe) => handleRecipeAction("viewPDF", recipe)}
                onView={(recipe) => handleRecipeAction("view", recipe)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Recipe Modal */}
      <CreateRecipeModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={handleCreateRecipe}
      />
    </article>
  );
}
