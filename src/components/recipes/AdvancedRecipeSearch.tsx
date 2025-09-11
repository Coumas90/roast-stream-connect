import React from 'react';
import { Search, Filter, X, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onClear: () => void;
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'review', label: 'In Review' },
  { value: 'archived', label: 'Archived' }
];

const TYPE_OPTIONS = [
  { value: 'personal', label: 'Personal' },
  { value: 'team', label: 'Team' },
  { value: 'oficial', label: 'Official' },
  { value: 'template', label: 'Template' }
];

const METHOD_OPTIONS = [
  { value: 'espresso', label: 'Espresso' },
  { value: 'v60', label: 'V60' },
  { value: 'chemex', label: 'Chemex' },
  { value: 'aeropress', label: 'AeroPress' },
  { value: 'french-press', label: 'French Press' },
  { value: 'cold-brew', label: 'Cold Brew' }
];

const COFFEE_TYPE_OPTIONS = [
  { value: 'tupa', label: 'Tupa Coffee' },
  { value: 'other', label: 'Other Coffee' }
];

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'created_at', label: 'Created Date' },
  { value: 'updated_at', label: 'Last Updated' },
  { value: 'time', label: 'Prep Time' }
];

export function AdvancedRecipeSearch({ filters, onFiltersChange, onClear }: AdvancedRecipeSearchProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const updateFilter = <K extends keyof SearchFilters>(
    key: K,
    value: SearchFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleArrayFilter = (key: 'status' | 'type' | 'method' | 'coffeeType', value: string) => {
    const current = filters[key] as string[];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    updateFilter(key, updated);
  };

  const removeFilter = (key: 'status' | 'type' | 'method' | 'coffeeType', value: string) => {
    const current = filters[key] as string[];
    updateFilter(key, current.filter(v => v !== value));
  };

  const hasActiveFilters = filters.search || 
    filters.status.length > 0 || 
    filters.type.length > 0 || 
    filters.method.length > 0 || 
    filters.coffeeType.length > 0 ||
    filters.timeRange[0] > 0 || 
    filters.timeRange[1] < 60;

  const activeFilterCount = [
    ...filters.status,
    ...filters.type,
    ...filters.method,
    ...filters.coffeeType
  ].length + (filters.search ? 1 : 0);

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        {/* Search Bar */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search recipes by name, description, or ingredients..."
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="pl-10"
            />
          </div>
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="shrink-0">
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
          {hasActiveFilters && (
            <Button variant="outline" onClick={onClear}>
              Clear All
            </Button>
          )}
        </div>

        {/* Active Filters */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 mb-4">
            {filters.search && (
              <Badge variant="secondary">
                Search: "{filters.search}"
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-2"
                  onClick={() => updateFilter('search', '')}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            {filters.status.map(status => (
              <Badge key={status} variant="secondary">
                Status: {status}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-2"
                  onClick={() => removeFilter('status', status)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
            {filters.type.map(type => (
              <Badge key={type} variant="secondary">
                Type: {type}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-2"
                  onClick={() => removeFilter('type', type)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
            {filters.method.map(method => (
              <Badge key={method} variant="secondary">
                Method: {method}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-2"
                  onClick={() => removeFilter('method', method)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
            {filters.coffeeType.map(coffeeType => (
              <Badge key={coffeeType} variant="secondary">
                Coffee: {coffeeType}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 ml-2"
                  onClick={() => removeFilter('coffeeType', coffeeType)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        )}

        {/* Advanced Filters */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Status Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <div className="space-y-2">
                  {STATUS_OPTIONS.map(option => (
                    <label key={option.value} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.status.includes(option.value)}
                        onChange={() => toggleArrayFilter('status', option.value)}
                        className="rounded"
                      />
                      <span className="text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Type Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Type</label>
                <div className="space-y-2">
                  {TYPE_OPTIONS.map(option => (
                    <label key={option.value} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.type.includes(option.value)}
                        onChange={() => toggleArrayFilter('type', option.value)}
                        className="rounded"
                      />
                      <span className="text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Method Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Brewing Method</label>
                <div className="space-y-2">
                  {METHOD_OPTIONS.map(option => (
                    <label key={option.value} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.method.includes(option.value)}
                        onChange={() => toggleArrayFilter('method', option.value)}
                        className="rounded"
                      />
                      <span className="text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Coffee Type Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Coffee Type</label>
                <div className="space-y-2">
                  {COFFEE_TYPE_OPTIONS.map(option => (
                    <label key={option.value} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.coffeeType.includes(option.value)}
                        onChange={() => toggleArrayFilter('coffeeType', option.value)}
                        className="rounded"
                      />
                      <span className="text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Time Range Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Prep Time: {filters.timeRange[0]}m - {filters.timeRange[1]}m
              </label>
              <Slider
                value={filters.timeRange}
                onValueChange={(value) => updateFilter('timeRange', value as [number, number])}
                max={60}
                min={0}
                step={5}
                className="w-full"
              />
            </div>

            {/* Sorting */}
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Sort By</label>
                <Select value={filters.sortBy} onValueChange={(value: any) => updateFilter('sortBy', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Order</label>
                <Select value={filters.sortOrder} onValueChange={(value: any) => updateFilter('sortOrder', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Ascending</SelectItem>
                    <SelectItem value="desc">Descending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}