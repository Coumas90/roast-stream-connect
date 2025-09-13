import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Search, Filter, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCoffeeVarieties } from "@/hooks/useCoffeeVarieties";

export interface RecipeFilters {
  method?: string;
  status?: string;
  coffee?: string;
  search?: string;
}

interface RecipeFiltersProps {
  filters: RecipeFilters;
  onFiltersChange: (filters: RecipeFilters) => void;
  onClearFilters: () => void;
}

const METHODS = [
  { value: "espresso", label: "Espresso" },
  { value: "v60", label: "V60" },
  { value: "chemex", label: "Chemex" },
  { value: "aeropress", label: "Aeropress" },
  { value: "frenchpress", label: "French Press" },
  { value: "coldbrew", label: "Cold Brew" },
];

const STATUSES = [
  { value: "draft", label: "Borrador" },
  { value: "review", label: "En revisión" },
  { value: "active", label: "Activa" },
  { value: "archived", label: "Archivada" },
];

export function RecipeFilters({ filters, onFiltersChange, onClearFilters }: RecipeFiltersProps) {
  const { data: coffeeVarieties = [] } = useCoffeeVarieties();
  const hasActiveFilters = Object.values(filters).some(value => value && value.length > 0);
  const activeFilterCount = Object.values(filters).filter(value => value && value.length > 0).length;

  const updateFilter = (key: keyof RecipeFilters, value: string | undefined) => {
    onFiltersChange({
      ...filters,
      [key]: value || undefined,
    });
  };

  return (
    <div className="flex flex-col gap-3 p-6 bg-muted/30 border-b border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Filtros</span>
          {hasActiveFilters && (
            <Badge variant="secondary" className="text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-7 text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Limpiar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar recetas..."
            value={filters.search || ""}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={filters.method || "all"} onValueChange={(value) => updateFilter("method", value === "all" ? undefined : value)}>
          <SelectTrigger>
            <SelectValue placeholder="Método" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los métodos</SelectItem>
            {METHODS.map((method) => (
              <SelectItem key={method.value} value={method.value}>
                {method.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.status || "all"} onValueChange={(value) => updateFilter("status", value === "all" ? undefined : value)}>
          <SelectTrigger>
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {STATUSES.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.coffee || "all"} onValueChange={(value) => updateFilter("coffee", value === "all" ? undefined : value)}>
          <SelectTrigger>
            <SelectValue placeholder="Café" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los cafés</SelectItem>
            {coffeeVarieties.map((coffee) => (
              <SelectItem key={coffee.id} value={coffee.id}>
                {coffee.name} {coffee.origin && `- ${coffee.origin}`}
              </SelectItem>
            ))}
            <SelectItem value="other">Café personalizado</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}