import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Star, MapPin, Coffee, Award } from "lucide-react";
import { CoffeeRadarChart } from "./RadarChart";

interface CoffeeDetailModalProps {
  variety: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CoffeeDetailModal({ variety, open, onOpenChange }: CoffeeDetailModalProps) {
  if (!variety) return null;

  const specs = variety.specifications ? (typeof variety.specifications === 'string' ? JSON.parse(variety.specifications) : variety.specifications) : {};
  const tasting = specs?.tasting || {};
  const technical = specs?.technical || {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Coffee className="h-5 w-5" />
            <span>{variety.name}</span>
            <Badge variant={variety.category === "tupa" ? "default" : "secondary"}>
              {variety.category === "tupa" ? "TUPÁ" : "Otro"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Image and Basic Info */}
          <div className="space-y-4">
            <div className="aspect-square relative rounded-lg overflow-hidden">
              {variety.image_url ? (
                <img
                  src={variety.image_url}
                  alt={variety.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <span className="text-muted-foreground">Sin imagen</span>
                </div>
              )}
              {technical.score && (
                <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-2 rounded-lg flex items-center">
                  <Star className="h-4 w-4 mr-1 fill-current" />
                  <span className="font-semibold">{technical.score}/100</span>
                </div>
              )}
            </div>

            {variety.description && (
              <div>
                <h3 className="font-semibold mb-2">Descripción</h3>
                <p className="text-sm text-muted-foreground">{variety.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              {variety.origin && (
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{variety.origin}</span>
                </div>
              )}
              {variety.price_per_kg && (
                <div className="font-medium">
                  ${variety.price_per_kg}/kg
                </div>
              )}
              {technical.region && (
                <div>
                  <span className="font-medium">Región:</span> {technical.region}
                </div>
              )}
              {technical.varietal && (
                <div>
                  <span className="font-medium">Varietal:</span> {technical.varietal}
                </div>
              )}
              {technical.process && (
                <div>
                  <span className="font-medium">Proceso:</span> {technical.process}
                </div>
              )}
              {technical.altitude && (
                <div>
                  <span className="font-medium">Altitud:</span> {technical.altitude} msnm
                </div>
              )}
              {technical.harvest && (
                <div>
                  <span className="font-medium">Zafra:</span> {technical.harvest}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Tasting Analysis */}
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-4 flex items-center">
                <Award className="h-4 w-4 mr-2" />
                Análisis Sensorial
              </h3>
              <CoffeeRadarChart data={tasting} />
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between">
                <span>Dulzor:</span>
                <span className="font-medium">{tasting.sweetness || 0}/10</span>
              </div>
              <div className="flex justify-between">
                <span>Aroma:</span>
                <span className="font-medium">{tasting.aroma || 0}/10</span>
              </div>
              <div className="flex justify-between">
                <span>Sabor:</span>
                <span className="font-medium">{tasting.flavor || 0}/10</span>
              </div>
              <div className="flex justify-between">
                <span>Retrogusto:</span>
                <span className="font-medium">{tasting.aftertaste || 0}/10</span>
              </div>
              <div className="flex justify-between">
                <span>Acidez:</span>
                <span className="font-medium">{tasting.acidity || 0}/10</span>
              </div>
              <div className="flex justify-between">
                <span>Cuerpo:</span>
                <span className="font-medium">{tasting.body || 0}/10</span>
              </div>
              <div className="flex justify-between">
                <span>Balance:</span>
                <span className="font-medium">{tasting.balance || 0}/10</span>
              </div>
              <div className="flex justify-between">
                <span>General:</span>
                <span className="font-medium">{tasting.overall || 0}/10</span>
              </div>
              <div className="flex justify-between">
                <span>Uniformidad:</span>
                <span className="font-medium">{tasting.uniformity || 0}/10</span>
              </div>
              <div className="flex justify-between">
                <span>Taza Limpia:</span>
                <span className="font-medium">{tasting.clean_cup || 0}/10</span>
              </div>
            </div>

            {tasting.notes && (
              <div>
                <h4 className="font-medium mb-2">Notas de Cata</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {tasting.notes}
                </p>
              </div>
            )}

            {technical.practices && (
              <div>
                <h4 className="font-medium mb-2">Prácticas Agrícolas</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {technical.practices}
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}