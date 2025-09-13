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
import { useRecipes, useCreateRecipe, useToggleRecipeActive } from "@/hooks/useRecipes";

export default function AdminRecipes() {
  const [activeTab, setActiveTab] = useState<RecipeTab>("all");
  const [filters, setFilters] = useState<RecipeFiltersType>({});
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Fetch recipes data - admin sees all recipes
  const { data: allRecipes = [], isLoading } = useRecipes(filters);

  // Filter recipes based on active tab and filters
  const filteredRecipes = useMemo(() => {
    return allRecipes.filter(recipe => {
      // Tab filtering
      switch (activeTab) {
        case "active":
          return recipe.status === 'published' && recipe.is_active;
        case "personal":
          return recipe.type === "personal";
        case "team":
          return recipe.type === "team";
        case "official":
          return recipe.type === "official";
        case "templates":
          return recipe.type === "template";
        default:
          return true;
      }
    });
  }, [allRecipes, activeTab]);

  // Calculate counts for tabs
  const tabCounts = useMemo(() => {
    return {
      all: allRecipes.length,
      active: allRecipes.filter(r => r.status === 'published' && r.is_active).length,
      personal: allRecipes.filter(r => r.type === "personal").length,
      team: allRecipes.filter(r => r.type === "team").length,
      official: allRecipes.filter(r => r.type === "official").length,
      templates: allRecipes.filter(r => r.type === "template").length,
    };
  }, [allRecipes]);

  const { mutate: createRecipe } = useCreateRecipe();
  const { mutate: toggleActive } = useToggleRecipeActive();

  const handleRecipeAction = (action: string, recipe: Recipe) => {
    switch (action) {
      case "activate":
        toggleActive({ id: recipe.id, isActive: true });
        break;
      case "deactivate":
        toggleActive({ id: recipe.id, isActive: false });
        break;
      default:
        console.log("Recipe action:", action, recipe);
    }
  };

  return (
    <>
      <Helmet>
        <title>Admin - Global Recipes | TUPÁ Hub</title>
        <meta name="description" content="Manage global TUPÁ recipes and templates for all locations" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-foreground">Global Recipes</h1>
                <Badge variant="secondary" className="text-xs">
                  Admin
                </Badge>
              </div>
              <p className="text-muted-foreground">
                Manage official TUPÁ recipes and templates
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button 
                size="sm"
                onClick={() => setIsCreateModalOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Recipe
              </Button>
            </div>
          </div>

          {/* Tab Navigation */}
          <RecipeTabNavigation
            activeTab={activeTab}
            onTabChange={setActiveTab}
            counts={tabCounts}
            isAdmin={true}
          />

          {/* Filters */}
          <div className="mb-6">
            <RecipeFilters
              filters={filters}
              onFiltersChange={setFilters}
              onClearFilters={() => setFilters({})}
            />
          </div>

          {/* Recipes Grid */}
          <div className="space-y-6">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-64 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : filteredRecipes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredRecipes.map((recipe) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={{
                      ...recipe,
                      coffee: recipe.coffee || recipe.coffee_amount || ''
                    }}
                    onToggleActive={(recipe, isActive) => toggleActive({ id: recipe.id, isActive })}
                    onAction={(action) => handleRecipeAction(action, recipe)}
                    showAdminActions={true}
                  />
                ))}
              </div>
            ) : (
              <RecipeEmptyState 
                tab={activeTab}
                isAdmin={true}
              />
            )}

            {/* Admin Notice for Templates */}
            {activeTab === "templates" && (
              <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-800 text-sm">
                  <strong>Admin Note:</strong> Templates are recipe blueprints that can be used by locations to create their own customized recipes. 
                  Manage template availability and permissions through the settings panel.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Create Recipe Modal */}
        <CreateRecipeModal
          open={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSave={(formData, isDraft) => {
            // Determine recipe type based on active tab
            let recipeType = "official";
            if (activeTab === "templates") {
              recipeType = "template";
            }

            // Convert form data to CreateRecipeData format
            const recipeData = {
              name: formData.name,
              method: formData.method,
              description: formData.description,
              status: isDraft ? "draft" as const : (formData.sendForReview ? "review" as const : "published" as const),
              type: recipeType as "official" | "template",
              ratio: formData.ratio,
              coffee_amount: formData.coffeeAmount,
              water_amount: formData.waterAmount,
              time: formData.time,
              temperature: formData.temperature,
              grind: formData.grind,
              coffee_type: formData.coffee.type,
              coffee_variety_id: formData.coffee.type === "tupa" ? formData.coffee.tupaId : undefined,
              custom_coffee_name: formData.coffee.type === "other" ? formData.coffee.customName : undefined,
              custom_coffee_origin: formData.coffee.type === "other" ? formData.coffee.origin : undefined,
              notes: formData.notes,
              steps: formData.steps,
              isAdminGlobal: true, // Flag to indicate this is a global admin recipe
            };

            createRecipe(recipeData);
            setIsCreateModalOpen(false);
          }}
        />
      </div>
    </>
  );
}