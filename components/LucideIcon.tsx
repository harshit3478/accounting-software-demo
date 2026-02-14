'use client';

import { icons } from 'lucide-react';

interface LucideIconProps {
  name: string | null | undefined;
  fallback?: string;
  size?: number;
  className?: string;
}

/**
 * Renders a Lucide icon by its kebab-case name (e.g., "building-2", "banknote").
 * Falls back to the first letter of `fallback` prop if icon not found.
 */
export default function LucideIcon({ name, fallback, size, className }: LucideIconProps) {
  if (!name) {
    return fallback ? <span>{fallback.charAt(0).toUpperCase()}</span> : null;
  }

  // Convert kebab-case to PascalCase: "building-2" -> "Building2"
  const pascalName = name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  const IconComponent = icons[pascalName as keyof typeof icons];

  if (!IconComponent) {
    return fallback ? <span>{fallback.charAt(0).toUpperCase()}</span> : <span>{name}</span>;
  }

  return <IconComponent size={size} className={className} />;
}
