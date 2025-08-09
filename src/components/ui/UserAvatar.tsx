
import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type UserAvatarProps = {
  fullName?: string | null;
  email?: string | null;
  src?: string | null;
  className?: string;
};

function getInitials(fullName?: string | null, email?: string | null) {
  if (fullName && fullName.trim().length > 0) {
    const parts = fullName.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
    return (first + last).toUpperCase();
  }
  if (email) return (email[0] ?? "U").toUpperCase();
  return "U";
}

export default function UserAvatar({ fullName, email, src, className }: UserAvatarProps) {
  const initials = getInitials(fullName, email);
  return (
    <Avatar className={className}>
      {src ? <AvatarImage src={src} alt={fullName ?? email ?? "User"} /> : null}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}
