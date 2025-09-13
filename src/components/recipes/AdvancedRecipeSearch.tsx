import React from 'react';
import { Search, Filter, X, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Recipe } from '@/hooks/useRecipes';

export interface SearchFilters {
  search: string;
  status: string[];
  type: string[];
  method: string[];
  timeRange: [number, number];
  coffeeType: string[];
  sortBy: 'name' | 'created_at' | 'updated_at' | 'time';
  sortOrder: 'asc' | 'desc';
}

interface AdvancedRecipeSearchProps {
  recipes: Recipe[];
  onRecipeSelect: (recipe: Recipe) => void;
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'review', label: 'In Review' },
  { value: 'archived', label: 'Archived' }
];

const TYPE_OPTIONS = [
  { value: 'personal', label: 'Personal' },
  { value: 'team', label: 'Team' },
  { value: 'official', label: 'Official' },
  { value: 'template', label: 'Template' }
];

const METHOD_OPTIONS = [
  { value: 'espresso', label: 'Espresso' },
  { value: 'v60', label: 'V60' },
  { value: 'chemex', label: 'Chemex' },
  { value: 'aeropress', label: 'Aeropress' },
  { value: 'french-press', label: 'French Press' },
  { value: 'cold-brew', label: 'Cold Brew' }
];

const COFFEE_TYPE_OPTIONS = [
  { value: 'tupa', label: 'TUPÁ Coffee' },
  { value: 'other', label: 'Other Coffee' }
];

export function AdvancedRecipeSearch({ 
  recipes, 
  onRecipeSelect 
}: AdvancedRecipeSearchProps) {
  const [filters, setFilters] = React.useState<SearchFilters>({
    search: '',
    status: [],
    type: [],
    method: [],
    timeRange: [0, 30], // minutes
    coffeeType: [],
    sortBy: 'updated_at',
    sortOrder: 'desc'
  });

  const [isFiltersOpen, setIsFiltersOpen] = React.useState(false);

  // Filter and sort recipes based on current filters
  const filteredRecipes = React.useMemo(() => {
    let filtered = recipes.filter(recipe => {
      // Text search
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch = 
          recipe.name?.toLowerCase().includes(searchLower) ||
          recipe.description?.toLowerCase().includes(searchLower) ||
          recipe.notes?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (filters.status.length > 0 && !filters.status.includes(recipe.status)) {
        return false;
      }

      // Type filter
      if (filters.type.length > 0 && !filters.type.includes(recipe.type)) {
        return false;
      }

      // Method filter
      if (filters.method.length > 0 && recipe.method && !filters.method.includes(recipe.method)) {
        return false;
      }

      // Coffee type filter
      if (filters.coffeeType.length > 0 && recipe.coffee_type && !filters.coffeeType.includes(recipe.coffee_type)) {
        return false;
      }

      // Time range filter
      if (recipe.time) {
        const timeInMinutes = parseInt(recipe.time) || 0;
        if (timeInMinutes < filters.timeRange[0] || timeInMinutes > filters.timeRange[1]) {
          return false;
        }
      }

      return true;
    });

    // Sort results
    filtered.sort((a, b) => {
      const sortField = filters.sortBy;
      let aValue = a[sortField] || '';
      let bValue = b[sortField] || '';

      if (sortField === 'time') {
        aValue = String(parseInt(a.time || '0'));
        bValue = String(parseInt(b.time || '0'));
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [recipes, filters]);

  const updateFilter = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const toggleArrayFilter = (key: 'status' | 'type' | 'method' | 'coffeeType', value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter(v => v !== value)
        : [...prev[key], value]
    }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      status: [],
      type: [],
      method: [],
      timeRange: [0, 30],
      coffeeType: [],
      sortBy: 'updated_at',
      sortOrder: 'desc'
    });
  };

  const activeFiltersCount = 
    filters.status.length + 
    filters.type.length + 
    filters.method.length + 
    filters.coffeeType.length + 
    (filters.search ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search recipes by name, description, or notes..."
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
          className="pl-10 pr-4"
        />
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm">
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Advanced Filters
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-2 h-5">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-4">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Status Filter */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Status</label>
                    <div className="flex flex-wrap gap-1">
                      {STATUS_OPTIONS.map(option => (
                        <Button
                          key={option.value}
                          variant={filters.status.includes(option.value) ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleArrayFilter('status', option.value)}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Type Filter */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Type</label>
                    <div className="flex flex-wrap gap-1">
                      {TYPE_OPTIONS.map(option => (
                        <Button
                          key={option.value}
                          variant={filters.type.includes(option.value) ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleArrayFilter('type', option.value)}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Method Filter */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Method</label>
                    <div className="flex flex-wrap gap-1">
                      {METHOD_OPTIONS.map(option => (
                        <Button
                          key={option.value}
                          variant={filters.method.includes(option.value) ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleArrayFilter('method', option.value)}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Coffee Type Filter */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Coffee Type</label>
                    <div className="flex flex-wrap gap-1">
                      {COFFEE_TYPE_OPTIONS.map(option => (
                        <Button
                          key={option.value}
                          variant={filters.coffeeType.includes(option.value) ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleArrayFilter('coffeeType', option.value)}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Time Range */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Brewing Time: {filters.timeRange[0]}-{filters.timeRange[1]} minutes
                  </label>
                  <Slider
                    value={filters.timeRange}
                    onValueChange={(value) => updateFilter('timeRange', value as [number, number])}
                    max={30}
                    min={0}
                    step={1}
                    className="w-full"
                  />
                </div>

                {/* Sort Controls */}
                <div className="flex gap-3">
                  <Select value={filters.sortBy} onValueChange={(value) => updateFilter('sortBy', value)}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="created_at">Created</SelectItem>
                      <SelectItem value="updated_at">Updated</SelectItem>
                      <SelectItem value="time">Brew Time</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={filters.sortOrder} onValueChange={(value) => updateFilter('sortOrder', value)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Ascending</SelectItem>
                      <SelectItem value="desc">Descending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Clear Filters */}
                {activeFiltersCount > 0 && (
                  <Button variant="outline" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-2" />
                    Clear Filters
                  </Button>
                )}
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* Active Filter Tags */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap gap-2">
            {filters.status.map(status => (
              <Badge key={status} variant="secondary" className="cursor-pointer">
                Status: {STATUS_OPTIONS.find(o => o.value === status)?.label}
                <X 
                  className="h-3 w-3 ml-1" 
                  onClick={() => toggleArrayFilter('status', status)}
                />
              </Badge>
            ))}
            {filters.type.map(type => (
              <Badge key={type} variant="secondary" className="cursor-pointer">
                Type: {TYPE_OPTIONS.find(o => o.value === type)?.label}
                <X 
                  className="h-3 w-3 ml-1" 
                  onClick={() => toggleArrayFilter('type', type)}
                />
              </Badge>
            ))}
            {filters.method.map(method => (
              <Badge key={method} variant="secondary" className="cursor-pointer">
                Method: {METHOD_OPTIONS.find(o => o.value === method)?.label}
                <X 
                  className="h-3 w-3 ml-1" 
                  onClick={() => toggleArrayFilter('method', method)}
                />
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            Search Results ({filteredRecipes.length})
          </h3>
        </div>

        {filteredRecipes.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No recipes found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search criteria or clearing some filters.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRecipes.map(recipe => (
              <Card 
                key={recipe.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => onRecipeSelect(recipe)}
              >
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <h4 className="font-semibold line-clamp-1">{recipe.name}</h4>
                    <div className="flex gap-2">
                      <Badge variant="outline">{recipe.method}</Badge>
                      <Badge variant="secondary">{recipe.type}</Badge>
                    </div>
                    {recipe.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {recipe.description}
                      </p>
                    )}
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{recipe.time ? `${recipe.time}m` : 'No time set'}</span>
                      <span>{recipe.coffee || 'No coffee amount'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}