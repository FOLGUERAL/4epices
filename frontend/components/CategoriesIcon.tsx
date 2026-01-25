'use client';

import { Tag } from 'lucide-react';

interface CategoriesIconProps {
  className?: string;
}

export default function CategoriesIcon({ className = 'w-5 h-5' }: CategoriesIconProps) {
  return <Tag className={className} />;
}
