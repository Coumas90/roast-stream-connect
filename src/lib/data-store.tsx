import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Enums } from "@/integrations/supabase/types";

export type OrderStatus = Enums<"order_status">;
export type Order = {
  id: string;
  tenant: string;
  location: string;
  status: OrderStatus;
  createdAt: string;
};

type DataStore = {
  ordersQueue: Order[];
  createOrder: (tenant: string, location: string) => Order;
  updateOrderStatus: (id: string, status: OrderStatus) => void;
  posConnected: boolean;
  setPosConnected: (connected: boolean) => void;
};

const DataStoreContext = createContext<DataStore | undefined>(undefined);
const STORE_KEY = "tupa_store";

export function DataStoreProvider({ children }: { children: React.ReactNode }) {
  const [ordersQueue, setOrdersQueue] = useState<Order[]>(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return (JSON.parse(raw).ordersQueue || []) as Order[];
    } catch {}
    return [];
  });
  const [posConnected, setPosConnected] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return Boolean(JSON.parse(raw).posConnected);
    } catch {}
    return true;
  });

  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify({ ordersQueue, posConnected }));
  }, [ordersQueue, posConnected]);

  const createOrder = (tenant: string, location: string): Order => {
    const order: Order = {
      id: Math.random().toString(36).slice(2, 9),
      tenant,
      location,
      status: "draft",
      createdAt: new Date().toISOString(),
    };
    setOrdersQueue((q) => [order, ...q]);
    return order;
  };

  const updateOrderStatus = (id: string, status: OrderStatus) => {
    setOrdersQueue((q) => q.map((o) => (o.id === id ? { ...o, status } : o)));
  };

  const value = useMemo<DataStore>(() => ({ ordersQueue, createOrder, updateOrderStatus, posConnected, setPosConnected }), [ordersQueue, posConnected]);

  return <DataStoreContext.Provider value={value}>{children}</DataStoreContext.Provider>;
}

export function useDataStore() {
  const ctx = useContext(DataStoreContext);
  if (!ctx) throw new Error("useDataStore must be used within DataStoreProvider");
  return ctx;
}
