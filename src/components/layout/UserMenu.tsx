
import React, { useMemo } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import UserAvatar from "@/components/ui/UserAvatar";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/lib/auth";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { useUserRole } from "@/hooks/useTeam";
import { Sun, Moon, Monitor } from "lucide-react";

type Props = { variant?: "client" | "admin" };

export default function UserMenu({ variant = "client" }: Props) {
  const navigate = useNavigate();
  const { profile, email } = useProfile();
  const { signOut } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();

  const initialsName = useMemo(() => profile?.full_name ?? null, [profile?.full_name]);

  const profilePath = variant === "admin" ? "/admin/profile" : "/app/profile";
  const prefsPath = variant === "admin" ? "/admin/integrations" : "/app/settings/integrations";

  const { data: effectiveRole } = useUserRole();
  const canManagePos = variant === "admin" || effectiveRole === 'owner' || effectiveRole === 'manager' || effectiveRole === 'tupa_admin';
  const currentTheme = (theme ?? resolvedTheme ?? "system") as "light" | "dark" | "system";

  const handleChangeBranch = () => {
    toast("Usa el selector de sucursal en el header.");
  };

  const handleSignOut = () => {
    signOut();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Abrir menú de usuario" className="rounded-full">
          <UserAvatar fullName={initialsName ?? undefined} email={email ?? undefined} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {profile?.full_name || email || "Usuario"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <NavLink to={profilePath}>Mi perfil</NavLink>
        </DropdownMenuItem>
        {canManagePos && (
          <DropdownMenuItem asChild>
            <NavLink to={prefsPath}>Preferencias</NavLink>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem disabled>Notificaciones</DropdownMenuItem>

        <DropdownMenuSeparator />

        {variant === "client" && (
          <>
            <DropdownMenuItem onSelect={handleChangeBranch}>Cambiar sucursal</DropdownMenuItem>
            {/* Cambiar organización/tenant: oculto si no hay multi-tenant disponible */}
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuLabel>Tema</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={currentTheme} onValueChange={(v) => setTheme(v as any)}>
          <DropdownMenuRadioItem value="light" className="flex items-center gap-2">
            <Sun className="h-4 w-4" />
            Claro
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" className="flex items-center gap-2">
            <Moon className="h-4 w-4" />
            Oscuro
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system" className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Sistema
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem disabled>Idioma: ES / EN</DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={handleSignOut} className="text-destructive">
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
