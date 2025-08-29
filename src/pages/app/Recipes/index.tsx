import React, { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Download, Plus } from "lucide-react";
import { RecipeTabNavigation, type RecipeTab } from "@/components/recipes/RecipeTabNavigation";
import { RecipeFilters, type RecipeFilters as RecipeFiltersType } from "@/components/recipes/RecipeFilters";
import { RecipeCard, type Recipe } from "@/components/recipes/RecipeCard";
import { RecipeEmptyState } from "@/components/recipes/RecipeEmptyStates";
import { CreateRecipeModal } from "@/components/recipes/CreateRecipeModal";
import { RecipeHeroSection } from "@/components/recipes/RecipeHeroSection";

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

  // Get active recipe for hero section
  const activeRecipe = MOCK_RECIPES.find(recipe => recipe.isActive);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Mis Recetas | TUPÁ Hub</title>
        <meta name="description" content="Gestiona y descubre recetas de café únicas. Crea, comparte y perfecciona tus métodos de preparación favoritos." />
        <link rel="canonical" href="/app/recipes" />
      </Helmet>

      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Mis Recetas</h1>
              <p className="text-muted-foreground mt-1">
                Descubre, crea y comparte recetas únicas de café
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="hover:bg-primary/10 hover:text-primary hover:border-primary/20">
                <Download className="h-4 w-4 mr-2" />
                Descargar Todas
              </Button>
              <Button onClick={() => setIsCreateModalOpen(true)} className="shadow-elegant">
                <Plus className="h-4 w-4 mr-2" />
                Nueva Receta
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section - Active Recipe */}
      {activeRecipe && (
        <RecipeHeroSection
          recipe={activeRecipe}
          onEdit={(recipe) => handleRecipeAction("edit", recipe)}
          onDuplicate={(recipe) => handleRecipeAction("duplicate", recipe)}
          onShare={(recipe) => handleRecipeAction("share", recipe)}
          onViewPDF={(recipe) => handleRecipeAction("viewPDF", recipe)}
        />
      )}

      {/* Tab Navigation */}
      <RecipeTabNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={tabCounts}
      />

      {/* Main Content */}
      <div className="container mx-auto px-6 py-6 space-y-6">
        {/* Filters */}
        <RecipeFilters
          filters={filters}
          onFiltersChange={setFilters}
          onClearFilters={clearFilters}
        />

        {/* Content */}
        {filteredRecipes.length === 0 ? (
          <RecipeEmptyState
            tab={activeTab}
            onCreateNew={() => setIsCreateModalOpen(true)}
            onViewOficial={() => setActiveTab("oficial")}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
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
    </div>
  );
}
