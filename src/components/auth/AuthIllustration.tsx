import React, { useEffect, useMemo, useState } from "react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { CheckCircle2 } from "lucide-react";

interface FeatureItem {
  icon?: React.ReactNode;
  text: string;
}

interface AuthIllustrationProps {
  images: string[];
  title: string;
  description?: string;
  features?: FeatureItem[];
}

export default function AuthIllustration({ images, title, description, features = [] }: AuthIllustrationProps) {
  const [api, setApi] = useState<CarouselApi | undefined>(undefined);

  // Filter duplicates and ensure valid strings
  const slides = useMemo(() => Array.from(new Set(images)).filter(Boolean), [images]);

  useEffect(() => {
    if (!api) return;
    const id = setInterval(() => {
      try {
        api.scrollNext();
      } catch (_) {}
    }, 5000);
    return () => clearInterval(id);
  }, [api]);

  if (!slides.length) {
    return (
      <div className="bg-gradient-brand text-primary-foreground p-8 flex flex-col justify-between flex-1">
        <div>
          <p className="text-sm/6 opacity-90">Bienvenido a</p>
          <h2 className="text-3xl font-semibold tracking-tight">{title}</h2>
          {description ? (
            <p className="mt-2 max-w-sm text-sm/6 opacity-90">{description}</p>
          ) : null}
        </div>
        {features?.length ? (
          <ul className="mt-8 space-y-3 text-sm/6">
            {features.map((f, i) => (
              <li className="flex items-center gap-2" key={i}>
                {f.icon ?? <CheckCircle2 className="h-4 w-4" />} {f.text}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-6 text-xs/5 opacity-80">© {new Date().getFullYear()} TUPÁ. Todos los derechos reservados.</p>
      </div>
    );
  }

  return (
    <div className="relative flex-1">
      <Carousel setApi={setApi} className="w-full">
        <CarouselContent>
          {slides.map((src, idx) => (
            <CarouselItem key={`${src}-${idx}`}>
              <AspectRatio ratio={4 / 5}>
                <img
                  src={src}
                  alt={`Ilustración de autenticación ${idx + 1}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </AspectRatio>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-4 top-1/2 -translate-y-1/2" />
        <CarouselNext className="right-4 top-1/2 -translate-y-1/2" />
      </Carousel>

      {/* Overlay content */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-6">
        <div className="max-w-sm rounded-xl bg-background/60 backdrop-blur-sm p-4 text-foreground">
          <p className="text-xs/5 opacity-80">Bienvenido a</p>
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          {description ? (
            <p className="mt-1 text-xs/5 opacity-90">{description}</p>
          ) : null}
        </div>

        {features?.length ? (
          <div className="max-w-sm rounded-xl bg-background/60 backdrop-blur-sm p-4 text-foreground">
            <ul className="space-y-2 text-xs/5">
              {features.map((f, i) => (
                <li className="flex items-center gap-2" key={i}>
                  {f.icon ?? <CheckCircle2 className="h-4 w-4" />} <span>{f.text}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[10px]/5 opacity-70">© {new Date().getFullYear()} TUPÁ. Todos los derechos reservados.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
