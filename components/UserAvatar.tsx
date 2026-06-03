"use client";

import { getUserInitials } from "../lib/user-avatar-display";

type UserAvatarProps = {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-20 w-20 text-xl",
};

export default function UserAvatar({
  src,
  name,
  email,
  size = "md",
  className = "",
}: UserAvatarProps) {
  const initials = getUserInitials(name, email);
  const sizeClass = sizeClasses[size];

  if (src) {
    return (
      <img
        src={src}
        alt={name?.trim() || email || "Profile"}
        className={`rounded-full object-cover border-2 border-white shadow-sm ${sizeClass} ${className}`}
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-semibold flex items-center justify-center border-2 border-white shadow-sm ${sizeClass} ${className}`}
      aria-hidden
    >
      {initials}
    </div>
  );
}
