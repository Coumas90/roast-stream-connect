# Roast Stream Connect SDK

Este SDK proporciona tipos y contratos para construir adaptadores de puntos de venta (POS) compatibles con la plataforma Roast Stream.

## Instalación

```bash
npm install @roast-stream/connect-sdk
```

## Uso básico

```ts
import type { POSAdapterFactory, POSKind } from "@roast-stream/connect-sdk/pos";

const createAdapter: POSAdapterFactory = (config) => ({
  meta: { id: config.provider, label: "Demo POS", kindsSupported: ["sales"] },
  async sync(kind: POSKind) {
    console.log(`Sincronizando ${kind}`);
    return 0;
  },
});

const service = createAdapter({ provider: "fudo", apiKey: "TOKEN" });
await service.sync("sales");
```
