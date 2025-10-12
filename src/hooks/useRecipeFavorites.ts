import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useRecipeFavorites(userId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: favorites = [], isLoading } = useQuery({
    queryKey: ["recipe-favorites", userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from("recipe_favorites")
        .select("recipe_id")
        .eq("user_id", userId);

      if (error) throw error;
      return data.map(f => f.recipe_id);
    },
    enabled: !!userId,
  });

  const addFavorite = useMutation({
    mutationFn: async (recipeId: string) => {
      if (!userId) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("recipe_favorites")
        .insert({ user_id: userId, recipe_id: recipeId });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipe-favorites", userId] });
      toast({
        title: "Agregado a favoritos",
        description: "La receta se agregó a tus favoritos",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo agregar a favoritos",
        variant: "destructive",
      });
    },
  });

  const removeFavorite = useMutation({
    mutationFn: async (recipeId: string) => {
      if (!userId) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("recipe_favorites")
        .delete()
        .eq("user_id", userId)
        .eq("recipe_id", recipeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipe-favorites", userId] });
      toast({
        title: "Eliminado de favoritos",
        description: "La receta se eliminó de tus favoritos",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar de favoritos",
        variant: "destructive",
      });
    },
  });

  const isFavorite = (recipeId: string) => favorites.includes(recipeId);

  const toggleFavorite = (recipeId: string) => {
    if (isFavorite(recipeId)) {
      removeFavorite.mutate(recipeId);
    } else {
      addFavorite.mutate(recipeId);
    }
  };

  return {
    favorites,
    isLoading,
    isFavorite,
    toggleFavorite,
    addFavorite: addFavorite.mutate,
    removeFavorite: removeFavorite.mutate,
  };
}
