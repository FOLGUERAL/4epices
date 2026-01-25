'use client';

import { Utensils } from 'lucide-react';

interface WhiskIconProps {
  className?: string;
}

export default function WhiskIcon({ className = 'w-5 h-5' }: WhiskIconProps) {
  return <Utensils className={className} />;
}
