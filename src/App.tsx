
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { ThemeProvider } from "next-themes";
import { OfflineIndicator } from "@/components/app/calibration/OfflineIndicator";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AppHome from "./pages/AppHome";
import AdminHome from "./pages/AdminHome";
import AppLayout from "./layouts/AppLayout";
import AdminLayout from "./layouts/AdminLayout";
import { AuthProvider } from "./lib/auth";
import { TenantProvider } from "./lib/tenant";
import { DataStoreProvider } from "./lib/data-store";
import { RequireClient } from "./components/auth/RequireClient";
import { RequireAdmin } from "./components/auth/RequireAdmin";
import { RequireRole } from "./components/auth/RequireRole";
import AppLogin from "./pages/app/Login";
import AdminLogin from "./pages/admin/Login";
import Recipes from "./pages/app/Recipes";
import Consumption from "./pages/app/Consumption";
import Stock from "./pages/app/Stock";
import Replenishment from "./pages/app/Replenishment";
import MyTeam from "./pages/app/MyTeam";
import Academy from "./pages/app/Academy";
import TrainingManagement from "./pages/app/TrainingManagement";
import Loyalty from "./pages/app/Loyalty";
import Raffles from "./pages/app/Raffles";
import AppIntegrations from "./pages/app/settings/Integrations";
import AdminClients from "./pages/admin/Clients";
import AdminEntitlements from "./pages/admin/Entitlements";
import AdminIntegrations from "./pages/admin/Integrations";
import AdminPosStatus from "./pages/admin/Integrations/PosStatus";
import OrdersQueue from "./pages/admin/OrdersQueue";
import AdminAdvisory from "./pages/admin/Advisory";
import AdminRecipes from "./pages/admin/Recipes";
import AdminAcademy from "./pages/admin/Academy";
import AdminLoyalty from "./pages/admin/Loyalty";
import AdminRaffles from "./pages/admin/Raffles";
import AdminAudits from "./pages/admin/quality/Audits";
import AdminMystery from "./pages/admin/quality/Mystery";
import AdminAnalytics from "./pages/admin/reports/Analytics";
import AdminClientDetail from "./pages/admin/Clients/Detail";
import CoffeeVarietiesAdmin from "./pages/admin/CoffeeVarieties";
import LocationStockAdmin from "./pages/admin/LocationStock";
import AcceptInvitation from "./pages/AcceptInvitation";
import ProfilePage from "./pages/app/Profile";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import LocationPosDetail from "./pages/app/locations/Pos";
import BaristaHome from "./pages/app/Barista";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange={false}
      >
         <TooltipProvider>
          <BrowserRouter>
            <AuthProvider>
              <TenantProvider>
                <DataStoreProvider>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/privacy" element={<Privacy />} />

                  {/* AUTH */}
                  <Route path="/auth/forgot-password" element={<ForgotPassword />} />
                  <Route path="/auth/reset-password" element={<ResetPassword />} />

                  {/* CLIENTE */}
                  <Route path="/app/login" element={<AppLogin />} />
                  <Route
                    path="/app"
                    element={
                      <RequireClient>
                        <AppLayout />
                      </RequireClient>
                    }
                  >
                    <Route index element={
                      <RequireRole allowedRoles={['owner', 'manager', 'tupa_admin']}>
                        <AppHome />
                      </RequireRole>
                    } />
                    <Route path="barista" element={
                      <RequireRole allowedRoles={['barista', 'coffee_master']}>
                        <BaristaHome />
                      </RequireRole>
                    } />
                    <Route path="recipes" element={<Recipes />} />
                    <Route path="consumption" element={
                      <RequireRole allowedRoles={['owner', 'manager', 'tupa_admin']}>
                        <Consumption />
                      </RequireRole>
                    } />
                    <Route path="stock" element={
                      <RequireRole allowedRoles={['owner', 'manager', 'tupa_admin']}>
                        <Stock />
                      </RequireRole>
                    } />
                    <Route path="replenishment" element={
                      <RequireRole allowedRoles={['owner', 'manager', 'tupa_admin']}>
                        <Replenishment />
                      </RequireRole>
                    } />
                    <Route path="my-team" element={
                      <RequireRole allowedRoles={['owner', 'manager', 'tupa_admin']}>
                        <MyTeam />
                      </RequireRole>
                    } />
                    <Route path="academy" element={<Academy />} />
                    <Route path="training-management" element={
                      <RequireRole allowedRoles={['owner', 'manager', 'tupa_admin']}>
                        <TrainingManagement />
                      </RequireRole>
                    } />
                    <Route path="loyalty" element={
                      <RequireRole allowedRoles={['owner', 'manager', 'tupa_admin']}>
                        <Loyalty />
                      </RequireRole>
                    } />
                    <Route path="raffles" element={
                      <RequireRole allowedRoles={['owner', 'manager', 'tupa_admin']}>
                        <Raffles />
                      </RequireRole>
                    } />
                    <Route path="settings/integrations" element={
                      <RequireRole allowedRoles={['owner', 'manager', 'tupa_admin']}>
                        <AppIntegrations />
                      </RequireRole>
                    } />
                    <Route path="locations/:id/pos" element={
                      <RequireRole allowedRoles={['owner', 'manager', 'tupa_admin']}>
                        <LocationPosDetail />
                      </RequireRole>
                    } />
                    <Route path="profile" element={<ProfilePage />} />
                  </Route>

                  {/* INVITATIONS */}
                  <Route path="/invite" element={<AcceptInvitation />} />
                  <Route path="/invite/:token" element={<AcceptInvitation />} />

                  {/* ADMIN */}
                  <Route path="/admin/login" element={<AdminLogin />} />
                  <Route
                    path="/admin"
                    element={
                      <RequireAdmin>
                        <AdminLayout />
                      </RequireAdmin>
                    }
                  >
                    <Route index element={<AdminHome />} />
                    <Route path="clients" element={<AdminClients />} />
                    <Route path="clients/:tenantId" element={<AdminClientDetail />} />
<Route path="entitlements" element={<AdminEntitlements />} />
<Route path="integrations" element={<AdminIntegrations />} />
<Route path="integrations/pos/status" element={<AdminPosStatus />} />
<Route path="orders-queue" element={<OrdersQueue />} />
                    <Route path="advisory" element={<AdminAdvisory />} />
                    <Route path="recipes" element={<AdminRecipes />} />
                    <Route path="academy" element={<AdminAcademy />} />
                    <Route path="loyalty" element={<AdminLoyalty />} />
                    <Route path="raffles" element={<AdminRaffles />} />
                    <Route path="quality/audits" element={<AdminAudits />} />
                    <Route path="quality/mystery" element={<AdminMystery />} />
                    <Route path="reports/analytics" element={<AdminAnalytics />} />
                    <Route path="coffee-varieties" element={<CoffeeVarietiesAdmin />} />
                    <Route path="location-stock" element={<LocationStockAdmin />} />
                    <Route path="profile" element={<ProfilePage />} />
                  </Route>

                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </DataStoreProvider>
            </TenantProvider>
          </AuthProvider>
         </BrowserRouter>
          <Toaster />
          <Sonner />
          <OfflineIndicator />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;

