import React, { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Download, Plus, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RecipeTabNavigation, type RecipeTab } from "@/components/recipes/RecipeTabNavigation";
import { RecipeFilters, type RecipeFilters as RecipeFiltersType } from "@/components/recipes/RecipeFilters";
import { RecipeCard, type Recipe } from "@/components/recipes/RecipeCard";
import { RecipeEmptyState } from "@/components/recipes/RecipeEmptyStates";
import { CreateRecipeModal } from "@/components/recipes/CreateRecipeModal";

// Mock data for admin view
const ADMIN_MOCK_RECIPES: Recipe[] = [
  {
    id: "1",
    name: "TUPÁ Signature Espresso",
    method: "Espresso",
    status: "oficial",
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
    name: "TUPÁ V60 Standard",
    method: "V60",
    status: "oficial",
    type: "oficial",
    ratio: "1:16",
    coffee: "22g",
    time: "3:30",
    temperature: "92°C",
    grind: "Media-fina",
    description: "Receta estándar V60 para todas las ubicaciones",
    isActive: false,
  },
  {
    id: "3",
    name: "Plantilla Cold Brew",
    method: "Cold Brew",
    status: "draft",
    type: "oficial",
    ratio: "1:8",
    coffee: "100g",
    time: "12h",
    temperature: "Ambiente",
    grind: "Gruesa",
    description: "Plantilla en desarrollo para cold brew",
    isActive: false,
  },
];

export default function AdminRecipes() {
  const [activeTab, setActiveTab] = useState<RecipeTab>("oficial");
  const [filters, setFilters] = useState<RecipeFiltersType>({});
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Filter recipes based on active tab and filters
  const filteredRecipes = useMemo(() => {
    let recipes = [...ADMIN_MOCK_RECIPES];

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
        recipes = recipes.filter(recipe => recipe.status === "draft" && recipe.type === "oficial");
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

  // Calculate tab counts for admin
  const tabCounts = useMemo(() => {
    return {
      active: ADMIN_MOCK_RECIPES.filter(r => r.isActive).length,
      personal: 0, // Admins typically don't have personal recipes in this view
      team: 0, // Team recipes would come from all locations
      oficial: ADMIN_MOCK_RECIPES.filter(r => r.type === "oficial" && r.status === "oficial").length,
      templates: ADMIN_MOCK_RECIPES.filter(r => r.status === "draft" && r.type === "oficial").length,
    };
  }, []);

  const handleCreateRecipe = (data: any, isDraft: boolean) => {
    console.log("Creating admin recipe:", data, "as draft:", isDraft);
    // Here you would typically call an API to save the recipe
  };

  const handleRecipeAction = (action: string, recipe: Recipe) => {
    console.log(`Admin ${action} recipe:`, recipe);
    // Here you would handle admin recipe actions
  };

  const clearFilters = () => {
    setFilters({});
  };

  const getCreateButtonText = () => {
    switch (activeTab) {
      case "templates":
        return "Nueva Plantilla";
      case "oficial":
        return "Nueva Receta Oficial";
      default:
        return "Nueva Receta";
    }
  };

  return (
    <article className="flex flex-col h-full">
      <Helmet>
        <title>Recetas Globales | TUPÁ Hub</title>
        <meta name="description" content="Gestión de recetas oficiales y plantillas TUPÁ" />
        <link rel="canonical" href="/admin/recipes" />
      </Helmet>
      
      <h1 className="sr-only">Recetas Globales</h1>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground">Recetas Globales</h1>
            <Badge variant="default" className="text-xs">Admin</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Gestión de recetas oficiales y plantillas a nivel TUPÁ
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Configuración
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exportar Todas
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {getCreateButtonText()}
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <RecipeTabNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={tabCounts}
        isAdmin={true}
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
            isAdmin={true}
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

      {/* Admin notification */}
      {activeTab === "templates" && (
        <div className="mx-6 mb-6 bg-primary/5 border border-primary/20 rounded-lg p-4">
          <h4 className="text-sm font-medium text-primary mb-1">
            Gestión de Plantillas
          </h4>
          <p className="text-xs text-muted-foreground">
            Las plantillas creadas aquí estarán disponibles como "Recetas Oficiales TUPÁ" 
            para todas las ubicaciones una vez que las publiques.
          </p>
        </div>
      )}

      {/* Create Recipe Modal */}
      <CreateRecipeModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={handleCreateRecipe}
      />
    </article>
  );
}
