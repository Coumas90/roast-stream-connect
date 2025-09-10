import { useState } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Coffee, 
  Loader2, 
  Search, 
  Filter, 
  Eye,
  Package2,
  Info
} from "lucide-react";
import { useCoffeeVarieties, useLocationStock } from "@/hooks/useCoffeeVarieties";
import { CoffeeDetailModal } from "@/components/coffee/CoffeeDetailModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface CoffeeSelection {
  type: "tupa" | "other";
  tupaId?: string;
  customName?: string;
  origin?: string;
}

interface EnhancedCoffeeSelectorProps {
  value: CoffeeSelection;
  onChange: (selection: CoffeeSelection) => void;
  locationId?: string;
  showStockInfo?: boolean;
}

export function EnhancedCoffeeSelector({ 
  value, 
  onChange, 
  locationId,
  showStockInfo = false 
}: EnhancedCoffeeSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("all");
  const [selectedCoffeeForDetail, setSelectedCoffeeForDetail] = useState<any>(null);
  const [showCoffeeDetail, setShowCoffeeDetail] = useState(false);

  // Fetch all coffee varieties with filters
  const { data: allCoffees, isLoading } = useCoffeeVarieties({
    activeOnly: true,
    searchTerm: searchTerm || undefined,
    availableOnly: availabilityFilter === "available"
  });

  // Fetch location stock if needed
  const { data: locationStock } = useLocationStock(locationId);

  const updateSelection = (updates: Partial<CoffeeSelection>) => {
    onChange({ ...value, ...updates });
  };

  // Filter coffees based on current filters
  const filteredCoffees = allCoffees?.filter(coffee => {
    if (categoryFilter !== "all" && coffee.category !== categoryFilter) {
      return false;
    }
    
    if (availabilityFilter === "bulk" && !coffee.available_bulk) {
      return false;
    }
    
    if (availabilityFilter === "packaged" && !coffee.available_packaged) {
      return false;
    }
    
    return true;
  }) || [];

  // Group coffees by category
  const groupedCoffees = filteredCoffees.reduce((acc, coffee) => {
    if (!acc[coffee.category]) {
      acc[coffee.category] = [];
    }
    acc[coffee.category].push(coffee);
    return acc;
  }, {} as Record<string, typeof filteredCoffees>);

  // Get unique categories for filter
  const availableCategories = [...new Set(allCoffees?.map(c => c.category) || [])];

  // Get stock info for a coffee variety
  const getStockInfo = (coffeeId: string) => {
    if (!locationStock) return null;
    const stocks = locationStock.filter(stock => stock.coffee_variety_id === coffeeId);
    const totalStock = stocks.reduce((total, stock) => total + (stock.current_kg || 0), 0);
    return { stocks, totalStock };
  };

  const openCoffeeDetail = (coffee: any) => {
    setSelectedCoffeeForDetail(coffee);
    setShowCoffeeDetail(true);
  };

  return (
    <div className="space-y-6">
      <RadioGroup
        value={value.type}
        onValueChange={(type: "tupa" | "other") => updateSelection({ type })}
        className="space-y-6"
      >
        {/* TUPA Coffee Section */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="tupa" id="tupa" />
            <Label htmlFor="tupa" className="text-base font-semibold">
              Café TUPÁ
            </Label>
          </div>
          
          {value.type === "tupa" && (
            <div className="ml-6 space-y-4">
              {/* Search and Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre, descripción u origen..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las categorías</SelectItem>
                    {availableCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category === "tupa" ? "Café TUPÁ" : category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <Package2 className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Disponibilidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="available">Solo disponibles</SelectItem>
                    <SelectItem value="bulk">A granel</SelectItem>
                    <SelectItem value="packaged">Empaquetado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Coffee Selection */}
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Cargando cafés...</span>
                </div>
              ) : filteredCoffees.length === 0 ? (
                <Card className="text-center py-8">
                  <CardContent>
                    <Coffee className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No se encontraron cafés con los filtros aplicados</p>
                  </CardContent>
                </Card>
              ) : (
                <Tabs defaultValue="grid" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="grid">Vista de Tarjetas</TabsTrigger>
                    <TabsTrigger value="select">Lista Desplegable</TabsTrigger>
                  </TabsList>

                  <TabsContent value="grid">
                    <div className="space-y-6">
                      {Object.entries(groupedCoffees).map(([category, coffees]) => (
                        <div key={category}>
                          <h3 className="text-lg font-semibold mb-4 flex items-center">
                            <Coffee className="mr-2 h-5 w-5" />
                            {category === "tupa" ? "Café TUPÁ" : category}
                            <Badge variant="secondary" className="ml-2">
                              {coffees.length}
                            </Badge>
                          </h3>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {coffees.map((coffee) => {
                              const isSelected = value.tupaId === coffee.id;
                              const stockInfo = showStockInfo ? getStockInfo(coffee.id) : null;
                              
                              return (
                                <Card 
                                  key={coffee.id} 
                                  className={`group cursor-pointer transition-all duration-300 hover:shadow-lg hover:border-primary/40 border-2 ${
                                    isSelected ? "border-primary bg-primary/5" : "border-border"
                                  }`}
                                  onClick={() => updateSelection({ tupaId: coffee.id })}
                                >
                                  <CardContent className="p-4">
                                    <div className="flex items-start space-x-3">
                                      {coffee.image_url ? (
                                        <div className="relative flex-shrink-0">
                                          <img
                                            src={coffee.image_url}
                                            alt={coffee.name}
                                            className="w-16 h-16 rounded-lg object-cover border"
                                          />
                                          {coffee.specifications?.overall && (
                                            <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                              {coffee.specifications.overall}
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center border">
                                          <Coffee className="h-6 w-6 text-muted-foreground" />
                                        </div>
                                      )}
                                      
                                      <div className="flex-1 min-w-0 space-y-2">
                                        <div className="flex items-start justify-between">
                                          <h4 className="font-semibold text-sm leading-tight">
                                            {coffee.name}
                                          </h4>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="p-1 h-6 w-6"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openCoffeeDetail(coffee);
                                            }}
                                          >
                                            <Eye className="h-3 w-3" />
                                          </Button>
                                        </div>
                                        
                                        {coffee.description && (
                                          <p className="text-xs text-muted-foreground line-clamp-2">
                                            {coffee.description}
                                          </p>
                                        )}
                                        
                                        <div className="flex flex-wrap gap-1">
                                          {coffee.origin && (
                                            <Badge variant="secondary" className="text-xs">
                                              {coffee.origin}
                                            </Badge>
                                          )}
                                          {coffee.available_bulk && (
                                            <Badge variant="outline" className="text-xs">
                                              A granel
                                            </Badge>
                                          )}
                                          {coffee.available_packaged && (
                                            <Badge variant="outline" className="text-xs">
                                              Empaquetado
                                            </Badge>
                                          )}
                                          {coffee.price_per_kg && (
                                            <Badge variant="default" className="text-xs">
                                              ${coffee.price_per_kg}/kg
                                            </Badge>
                                          )}
                                        </div>

                                        {/* Stock information */}
                                        {stockInfo && stockInfo.totalStock > 0 && (
                                          <div className="flex items-center space-x-2">
                                            <div className={`w-2 h-2 rounded-full ${
                                              stockInfo.totalStock <= 2 
                                                ? 'bg-destructive' 
                                                : stockInfo.totalStock <= 5 
                                                ? 'bg-warning' 
                                                : 'bg-success'
                                            }`} />
                                            <span className="text-xs text-muted-foreground">
                                              Stock: {stockInfo.totalStock} kg
                                            </span>
                                            <TooltipProvider>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  <div className="space-y-1">
                                                    {stockInfo.stocks.map((stock, idx) => (
                                                      <div key={idx} className="text-sm">
                                                        Tolva {stock.hopper_number}: {stock.current_kg} kg
                                                      </div>
                                                    ))}
                                                  </div>
                                                </TooltipContent>
                                              </Tooltip>
                                            </TooltipProvider>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="select">
                    <Select 
                      value={value.tupaId} 
                      onValueChange={(tupaId) => updateSelection({ tupaId })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecciona un café TUPÁ" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(groupedCoffees).map(([category, coffees]) => (
                          <div key={category}>
                            <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                              {category === "tupa" ? "Café TUPÁ" : category}
                            </div>
                            {coffees.map((coffee) => (
                              <SelectItem key={coffee.id} value={coffee.id}>
                                <div className="flex items-center gap-3 w-full">
                                  <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                                    <Coffee className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium">{coffee.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {coffee.description || coffee.origin}
                                      {coffee.price_per_kg && ` • $${coffee.price_per_kg}/kg`}
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="p-1 h-6 w-6 flex-shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openCoffeeDetail(coffee);
                                    }}
                                  >
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                </div>
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  </TabsContent>
                </Tabs>
              )}

              {/* Selected Coffee Preview */}
              {value.tupaId && filteredCoffees && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardHeader>
                    <CardTitle className="text-sm">Café Seleccionado</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const coffee = allCoffees?.find(c => c.id === value.tupaId);
                      if (!coffee) return null;
                      
                      const stockInfo = showStockInfo ? getStockInfo(coffee.id) : null;
                      
                      return (
                        <div className="flex items-start gap-4">
                          {coffee.image_url ? (
                            <img
                              src={coffee.image_url}
                              alt={coffee.name}
                              className="w-16 h-16 rounded-lg object-cover border"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Coffee className="h-8 w-8 text-primary" />
                            </div>
                          )}
                          <div className="flex-1">
                            <h4 className="font-medium">{coffee.name}</h4>
                            {coffee.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {coffee.description}
                              </p>
                            )}
                            {coffee.origin && (
                              <p className="text-sm text-muted-foreground">
                                Origen: {coffee.origin}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-1 mt-2">
                              <Badge variant="secondary" className="text-xs">
                                {coffee.category.toUpperCase()}
                              </Badge>
                              {coffee.available_bulk && (
                                <Badge variant="secondary" className="text-xs">
                                  Disponible a granel
                                </Badge>
                              )}
                              {coffee.price_per_kg && (
                                <Badge variant="secondary" className="text-xs">
                                  ${coffee.price_per_kg}/kg
                                </Badge>
                              )}
                              {stockInfo && stockInfo.totalStock > 0 && (
                                <Badge 
                                  variant={stockInfo.totalStock <= 2 ? "destructive" : "default"} 
                                  className="text-xs"
                                >
                                  Stock: {stockInfo.totalStock} kg
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openCoffeeDetail(coffee)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Detalles
                          </Button>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Other Coffee Section */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="other" id="other" />
            <Label htmlFor="other" className="text-base font-semibold">
              Otro café
            </Label>
          </div>
          
          {value.type === "other" && (
            <div className="ml-6 space-y-3">
              <div>
                <Label htmlFor="custom-name" className="text-sm text-muted-foreground">
                  Nombre del café *
                </Label>
                <Input
                  id="custom-name"
                  placeholder="Ej: Colombia Huila"
                  value={value.customName || ""}
                  onChange={(e) => updateSelection({ customName: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="origin" className="text-sm text-muted-foreground">
                  Origen (opcional)
                </Label>
                <Input
                  id="origin"
                  placeholder="Ej: Finca Los Andes, Colombia"
                  value={value.origin || ""}
                  onChange={(e) => updateSelection({ origin: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>
      </RadioGroup>

      {/* Coffee Detail Modal */}
      {selectedCoffeeForDetail && (
        <CoffeeDetailModal
          variety={selectedCoffeeForDetail}
          open={showCoffeeDetail}
          onOpenChange={(open) => {
            setShowCoffeeDetail(open);
            if (!open) setSelectedCoffeeForDetail(null);
          }}
        />
      )}
    </div>
  );
}
