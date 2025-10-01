import React, { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Download, Plus, Settings, Search, BarChart, Calculator, History, FileText, Activity } from "lucide-react";
import { RecipeTabNavigation, type RecipeTab } from "@/components/recipes/RecipeTabNavigation";
import { CalibrationPanel } from "@/components/app/calibration/CalibrationPanel";
import { CalibrationHistory } from "@/components/app/calibration/CalibrationHistory";
import { CalibrationTemplates } from "@/components/app/calibration/CalibrationTemplates";
import { TelemetryTab } from "@/components/app/calibration/TelemetryTab";
import { useProfile } from "@/hooks/useProfile";
import { RecipeFilters, type RecipeFilters as RecipeFiltersType } from "@/components/recipes/RecipeFilters";
import { RecipeCard } from "@/components/recipes/RecipeCard";
import { RecipeHeroSection } from "@/components/recipes/RecipeHeroSection";
import { RecipeEmptyState } from "@/components/recipes/RecipeEmptyStates";
import { CreateRecipeModal } from "@/components/recipes/CreateRecipeModal";
import { RecipeDetailModal } from "@/components/recipes/RecipeDetailModal";
import { ShareRecipeModal } from "@/components/recipes/ShareRecipeModal";
import { RecipeAnalyticsDashboard } from "@/components/recipes/RecipeAnalyticsDashboard";
import { AdvancedRecipeSearch } from "@/components/recipes/AdvancedRecipeSearch";
import { RecipeRecommendations } from "@/components/recipes/RecipeRecommendations";
import { 
  useRecipes, 
  useCreateRecipe, 
  useUpdateRecipe, 
  useToggleRecipeActive, 
  useDuplicateRecipe, 
  useArchiveRecipe, 
  useShareRecipe,
  type Recipe
} from "@/hooks/useRecipes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Recipes() {
  const [activeTab, setActiveTab] = useState<RecipeTab>("active");
  const [filters, setFilters] = useState<RecipeFiltersType>({});
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [mainActiveTab, setMainActiveTab] = useState("recipes");

  const { profile } = useProfile();

  // Fetch recipes data
  const { data: allRecipes = [], isLoading } = useRecipes(filters);
  
  // Mutations
  const createRecipe = useCreateRecipe();
  const updateRecipe = useUpdateRecipe();
  const toggleActive = useToggleRecipeActive();
  const duplicateRecipe = useDuplicateRecipe();
  const archiveRecipe = useArchiveRecipe();
  const shareRecipe = useShareRecipe();

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
          return recipe.type === "official" || recipe.type === "template";
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
      official: allRecipes.filter(r => r.type === "official" || r.type === "template").length,
      templates: allRecipes.filter(r => r.type === "template").length,
    };
  }, [allRecipes]);

  // Find active recipe for hero section
  const activeRecipe = useMemo(() => {
    return allRecipes.find(recipe => recipe.status === 'published' && recipe.is_active);
  }, [allRecipes]);

  const handleCreateRecipe = (recipeData: any, isDraft: boolean) => {
    if (editingRecipe) {
      // Editing existing recipe
      updateRecipe.mutate({
        id: editingRecipe.id,
        updates: {
          ...recipeData,
          status: recipeData.sendForReview ? 'review' : 'published',
          type: 'personal',
        }
      });
      setEditingRecipe(null);
    } else {
      // Creating new recipe
      const mappedData = {
        name: recipeData.name,
        method: recipeData.method,
        description: recipeData.description,
        coffee_type: recipeData.coffee.type,
        coffee_variety_id: recipeData.coffee.tupaId,
        custom_coffee_name: recipeData.coffee.customName,
        custom_coffee_origin: recipeData.coffee.customOrigin,
        ratio: recipeData.ratio,
        coffee_amount: recipeData.coffeeAmount,
        water_amount: recipeData.waterAmount,
        time: recipeData.time,
        temperature: recipeData.temperature,
        grind: recipeData.grind,
        notes: recipeData.notes,
        steps: recipeData.steps?.map((step: any, index: number) => ({
          order: index + 1,
          title: step.title,
          description: step.description,
          time_minutes: step.time_minutes || (step.time ? parseInt(step.time) : null),
          water_ml: step.water_ml || (step.water ? parseInt(step.water) : null),
        })) || [],
      };

      createRecipe.mutate({
        ...mappedData,
        status: recipeData.sendForReview ? 'review' : 'published',
        type: 'personal',
      });
    }
  };

  const handleEditRecipe = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setIsCreateModalOpen(true);
  };

  const handleRecipeAction = (action: string, recipe: Recipe) => {
    switch (action) {
      case "edit":
        handleEditRecipe(recipe);
        break;
      case "duplicate":
        duplicateRecipe.mutate(recipe.id);
        break;
      case "share":
        setSelectedRecipe(recipe);
        setIsShareModalOpen(true);
        break;
      case "archive":
        archiveRecipe.mutate({ id: recipe.id, archive: true });
        break;
      case "activate":
        toggleActive.mutate({ id: recipe.id, isActive: true });
        break;
      case "deactivate":
        toggleActive.mutate({ id: recipe.id, isActive: false });
        break;
      case "view-pdf":
        // TODO: Implement PDF generation
        console.log("Generate PDF for recipe:", recipe.id);
        break;
      case "view-details":
        setSelectedRecipe(recipe);
        setIsDetailModalOpen(true);
        break;
    }
  };

  return (
    <>
      <Helmet>
        <title>Recipes | TUPÁ Hub</title>
        <meta name="description" content="Create, manage and share coffee brewing recipes with your team" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Recipes</h1>
              <p className="text-muted-foreground">
                Create and manage your coffee brewing recipes
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsCalibrationOpen(true)}
              >
                <Calculator className="w-4 h-4 mr-2" />
                Calibración
              </Button>
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
                New Recipe
              </Button>
            </div>
          </div>

          {/* Main Content Tabs */}
          <Tabs value={mainActiveTab} onValueChange={setMainActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="recipes">Recipes</TabsTrigger>
              <TabsTrigger value="analytics">
                <BarChart className="w-4 h-4 mr-2" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="search">
                <Search className="w-4 h-4 mr-2" />
                Advanced Search
              </TabsTrigger>
              <TabsTrigger value="discover">Discover</TabsTrigger>
              <TabsTrigger value="historial">
                <History className="w-4 h-4 mr-2" />
                Historial
              </TabsTrigger>
              <TabsTrigger value="plantillas">
                <FileText className="w-4 h-4 mr-2" />
                Plantillas
              </TabsTrigger>
              <TabsTrigger value="telemetria">
                <Activity className="w-4 h-4 mr-2" />
                Telemetría
              </TabsTrigger>
            </TabsList>

            <TabsContent value="recipes" className="space-y-6">
              {/* Hero Section with Active Recipe */}
              {activeRecipe && (
                <RecipeHeroSection
                  recipe={activeRecipe}
                  onAction={(action) => handleRecipeAction(action, activeRecipe)}
                />
              )}

              {/* Tab Navigation */}
              <RecipeTabNavigation
                activeTab={activeTab}
                onTabChange={setActiveTab}
                counts={tabCounts}
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
                        recipe={recipe}
                        onEdit={handleEditRecipe}
                        onDuplicate={(recipe) => duplicateRecipe.mutate(recipe.id)}
                        onShare={(recipe) => {
                          setSelectedRecipe(recipe as any);
                          setIsShareModalOpen(true);
                        }}
                        onArchive={(recipe) => archiveRecipe.mutate({ id: recipe.id, archive: true })}
                        onToggleActive={(recipe, isActive) => toggleActive.mutate({ id: recipe.id, isActive })}
                        onViewPDF={(recipe) => console.log("View PDF:", recipe.id)}
                        onView={(recipe) => {
                          setSelectedRecipe(recipe as any);
                          setIsDetailModalOpen(true);
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <RecipeEmptyState 
                    tab={activeTab}
                    onCreateNew={() => setIsCreateModalOpen(true)}
                    onViewOficial={() => setActiveTab("official")}
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent value="analytics">
              <RecipeAnalyticsDashboard recipes={allRecipes} />
            </TabsContent>

            <TabsContent value="search">
              <AdvancedRecipeSearch 
                recipes={allRecipes}
                onRecipeSelect={(recipe) => {
                  setSelectedRecipe(recipe);
                  setIsDetailModalOpen(true);
                }}
              />
            </TabsContent>

            <TabsContent value="discover">
              <RecipeRecommendations
                userRecipes={allRecipes.filter(r => r.type === 'personal')}
                allRecipes={allRecipes}
                onRecipeSelect={(recipe) => {
                  setSelectedRecipe(recipe);
                  setIsDetailModalOpen(true);
                }}
              />
            </TabsContent>

            <TabsContent value="historial">
              <CalibrationHistory locationId={profile?.id} />
            </TabsContent>

            <TabsContent value="plantillas">
              <CalibrationTemplates 
                locationId={profile?.id}
                tenantId={profile?.default_tenant_id || undefined}
              />
            </TabsContent>

            <TabsContent value="telemetria">
              <TelemetryTab />
            </TabsContent>
          </Tabs>
        </div>

        {/* Modals */}
        <CreateRecipeModal
          open={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingRecipe(null);
          }}
          onSave={handleCreateRecipe}
          initialData={editingRecipe ? {
            name: editingRecipe.name,
            method: editingRecipe.method || "",
            description: editingRecipe.description || "",
            ratio: editingRecipe.ratio || "",
            coffeeAmount: editingRecipe.coffee || "",
            waterAmount: editingRecipe.water_amount || "",
            time: editingRecipe.time || "",
            temperature: editingRecipe.temperature || "",
            grind: editingRecipe.grind || "",
            notes: editingRecipe.notes || "",
            steps: editingRecipe.steps?.map((step, index) => ({
              id: step.id || `step-${index}`,
              order: step.order,
              title: step.title,
              description: step.description,
              time: step.time,
              water: step.water
            })) || [],
            coffee: {
              type: editingRecipe.coffee_type || 'tupa',
              tupaId: editingRecipe.coffee_variety_id,
              customName: editingRecipe.custom_coffee_name,
              origin: editingRecipe.custom_coffee_origin
            },
            sendForReview: false
          } : undefined}
          mode={editingRecipe ? "edit" : "create"}
        />

        <RecipeDetailModal
          open={isDetailModalOpen}
          onOpenChange={setIsDetailModalOpen}
          recipe={selectedRecipe}
          onEdit={handleEditRecipe}
          onShare={(recipe) => {
            setSelectedRecipe(recipe as any);
            setIsShareModalOpen(true);
          }}
        />

        <ShareRecipeModal
          open={isShareModalOpen}
          onOpenChange={setIsShareModalOpen}
          recipe={selectedRecipe}
          onShare={(data) => {
            if (selectedRecipe) {
              shareRecipe.mutate({
                recipeId: selectedRecipe.id,
                shareType: data.shareType,
                emails: data.emails,
                message: data.message
              });
            }
            setIsShareModalOpen(false);
          }}
        />

        <CalibrationPanel
          open={isCalibrationOpen}
          onOpenChange={setIsCalibrationOpen}
          locationId={profile?.id}
        />
      </div>
    </>
  );
}