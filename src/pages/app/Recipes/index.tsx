import React, { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Download, Plus } from "lucide-react";
import { RecipeTabNavigation, type RecipeTab } from "@/components/recipes/RecipeTabNavigation";
import { RecipeFilters, type RecipeFilters as RecipeFiltersType } from "@/components/recipes/RecipeFilters";
import { RecipeCard } from "@/components/recipes/RecipeCard";
import { RecipeEmptyState } from "@/components/recipes/RecipeEmptyStates";
import { CreateRecipeModal } from "@/components/recipes/CreateRecipeModal";
import { RecipeHeroSection } from "@/components/recipes/RecipeHeroSection";
import { useRecipes, useCreateRecipe, useToggleRecipeActive, useDuplicateRecipe, useUpdateRecipe, useArchiveRecipe, useShareRecipe } from "@/hooks/useRecipes";
import { RecipeDetailModal } from "@/components/recipes/RecipeDetailModal";
import { ShareRecipeModal } from "@/components/recipes/ShareRecipeModal";
import { RecipePDFGenerator } from "@/utils/pdfGenerator";
import { type Recipe } from "@/components/recipes/RecipeCard";

export default function Recipes() {
  const [activeTab, setActiveTab] = useState<RecipeTab>("active");
  const [filters, setFilters] = useState<RecipeFiltersType>({});
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRecipeForDetail, setSelectedRecipeForDetail] = useState<Recipe | null>(null);
  const [selectedRecipeForShare, setSelectedRecipeForShare] = useState<Recipe | null>(null);
  const [selectedRecipeForEdit, setSelectedRecipeForEdit] = useState<Recipe | null>(null);

  // Fetch recipes based on current tab
  const recipesQuery = useRecipes({
    status: activeTab === "active" ? undefined : filters.status,
    type: activeTab === "active" ? undefined : activeTab === "templates" ? "template" : activeTab,
    method: filters.method,
    search: filters.search,
  });

  const createRecipeMutation = useCreateRecipe();
  const updateRecipeMutation = useUpdateRecipe();
  const toggleActiveMutation = useToggleRecipeActive();
  const duplicateMutation = useDuplicateRecipe();
  const archiveMutation = useArchiveRecipe();
  const shareMutation = useShareRecipe();

  const recipes = recipesQuery.data || [];

  // Filter recipes based on active tab and filters
  const filteredRecipes = useMemo(() => {
    let filteredRecipes = [...recipes];

    // Filter by tab
    switch (activeTab) {
      case "active":
        filteredRecipes = filteredRecipes.filter(recipe => recipe.is_active);
        break;
      case "personal":
        filteredRecipes = filteredRecipes.filter(recipe => recipe.type === "personal");
        break;
      case "team":
        filteredRecipes = filteredRecipes.filter(recipe => recipe.type === "team");
        break;
      case "oficial":
        filteredRecipes = filteredRecipes.filter(recipe => recipe.type === "oficial");
        break;
      case "templates":
        filteredRecipes = filteredRecipes.filter(recipe => recipe.type === "template");
        break;
    }

    return filteredRecipes;
  }, [recipes, activeTab]);

  // Calculate tab counts
  const tabCounts = useMemo(() => {
    return {
      active: recipes.filter(r => r.is_active).length,
      personal: recipes.filter(r => r.type === "personal").length,
      team: recipes.filter(r => r.type === "team").length,
      oficial: recipes.filter(r => r.type === "oficial").length,
      templates: recipes.filter(r => r.type === "template").length,
    };
  }, [recipes]);

  const handleCreateRecipe = (formData: any, isDraft: boolean) => {
    const recipeData = {
      name: formData.name,
      method: formData.method,
      description: formData.description,
      status: isDraft ? 'draft' as const : (formData.sendForReview ? 'review' as const : 'active' as const),
      type: 'personal' as const,
      ratio: formData.ratio,
      coffee_amount: formData.coffeeAmount,
      water_amount: formData.waterAmount,
      time: formData.time,
      temperature: formData.temperature,
      grind: formData.grind,
      coffee_type: formData.coffee.type,
      coffee_variety_id: formData.coffee.type === 'tupa' ? formData.coffee.tupaId : undefined,
      custom_coffee_name: formData.coffee.type === 'other' ? formData.coffee.customName : undefined,
      custom_coffee_origin: formData.coffee.type === 'other' ? formData.coffee.origin : undefined,
      notes: formData.notes,
      steps: formData.steps || [],
    };

    if (selectedRecipeForEdit) {
      updateRecipeMutation.mutate({ id: selectedRecipeForEdit.id, data: recipeData });
      setSelectedRecipeForEdit(null);
    } else {
      createRecipeMutation.mutate(recipeData);
    }
  };

  const handleEditRecipe = (formData: any, isDraft: boolean) => {
    if (!selectedRecipeForEdit) return;
    
    const recipeData = {
      name: formData.name,
      method: formData.method,
      description: formData.description,
      status: isDraft ? 'draft' as const : (formData.sendForReview ? 'review' as const : 'active' as const),
      ratio: formData.ratio,
      coffee_amount: formData.coffeeAmount,
      water_amount: formData.waterAmount,
      time: formData.time,
      temperature: formData.temperature,
      grind: formData.grind,
      coffee_type: formData.coffee.type,
      coffee_variety_id: formData.coffee.type === 'tupa' ? formData.coffee.tupaId : undefined,
      custom_coffee_name: formData.coffee.type === 'other' ? formData.coffee.customName : undefined,
      custom_coffee_origin: formData.coffee.type === 'other' ? formData.coffee.origin : undefined,
      notes: formData.notes,
      steps: formData.steps || [],
    };

    updateRecipeMutation.mutate({ id: selectedRecipeForEdit.id, data: recipeData });
  };

  const handleRecipeAction = (action: string, recipe: any) => {
    switch (action) {
      case "edit":
        setSelectedRecipeForEdit(recipe);
        setIsCreateModalOpen(true);
        break;
      case "duplicate":
        duplicateMutation.mutate(recipe.id);
        break;
      case "share":
        setSelectedRecipeForShare(recipe);
        break;
      case "archive":
        archiveMutation.mutate({ 
          id: recipe.id, 
          archive: recipe.status !== "archived" 
        });
        break;
      case "activate":
      case "deactivate":
        toggleActiveMutation.mutate({
          id: recipe.id,
          isActive: action === "activate"
        });
        break;
      case "viewPDF":
        RecipePDFGenerator.generateRecipePDF(recipe);
        break;
      case "view":
        setSelectedRecipeForDetail(recipe);
        break;
    }
  };

  const clearFilters = () => {
    setFilters({});
  };

  // Get active recipe for hero section
  const activeRecipe = recipes.find(recipe => recipe.is_active) as Recipe | undefined;

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
        {recipesQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Cargando recetas...</p>
            </div>
          </div>
        ) : filteredRecipes.length === 0 ? (
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
                recipe={{
                  ...recipe,
                  status: recipe.status as any,
                  type: recipe.type as any,
                } as Recipe}
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

      {/* Modals */}
      <CreateRecipeModal
        open={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setSelectedRecipeForEdit(null);
        }}
        onSave={selectedRecipeForEdit ? handleEditRecipe : handleCreateRecipe}
        initialData={selectedRecipeForEdit ? {
          name: selectedRecipeForEdit.name,
          method: selectedRecipeForEdit.method || "",
          description: selectedRecipeForEdit.description || "",
          ratio: selectedRecipeForEdit.ratio || "",
          coffeeAmount: selectedRecipeForEdit.coffee || "",
          waterAmount: selectedRecipeForEdit.water_amount || "",
          time: selectedRecipeForEdit.time || "",
          temperature: selectedRecipeForEdit.temperature || "",
          grind: selectedRecipeForEdit.grind || "",
          coffee: {
            type: selectedRecipeForEdit.coffee_type as "tupa" | "other" || "tupa",
            tupaId: selectedRecipeForEdit.coffee_variety_id,
            customName: selectedRecipeForEdit.custom_coffee_name,
            origin: selectedRecipeForEdit.custom_coffee_origin,
          },
          steps: selectedRecipeForEdit.steps?.map(step => ({
            id: step.id,
            order: step.order,
            title: step.title,
            description: step.description,
            time: step.time,
            water: step.water,
          })) || [],
          notes: selectedRecipeForEdit.notes || "",
          sendForReview: selectedRecipeForEdit.status === "review",
        } : undefined}
        mode={selectedRecipeForEdit ? "edit" : "create"}
      />

      <RecipeDetailModal
        recipe={selectedRecipeForDetail}
        open={!!selectedRecipeForDetail}
        onClose={() => setSelectedRecipeForDetail(null)}
        onEdit={(recipe) => {
          setSelectedRecipeForDetail(null);
          handleRecipeAction("edit", recipe);
        }}
        onDuplicate={(recipe) => {
          setSelectedRecipeForDetail(null);
          handleRecipeAction("duplicate", recipe);
        }}
        onShare={(recipe) => {
          setSelectedRecipeForDetail(null);
          handleRecipeAction("share", recipe);
        }}
        onViewPDF={(recipe) => {
          setSelectedRecipeForDetail(null);
          handleRecipeAction("viewPDF", recipe);
        }}
      />

      <ShareRecipeModal
        recipe={selectedRecipeForShare}
        open={!!selectedRecipeForShare}
        onClose={() => setSelectedRecipeForShare(null)}
      />
    </div>
  );
}
