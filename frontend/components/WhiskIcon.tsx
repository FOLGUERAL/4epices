'use client';

import { Icon } from 'lucide-react';
import { whisk } from '@lucide/lab';

interface WhiskIconProps {
  className?: string;
  strokeWidth?: number;
}

export default function WhiskIcon({ className = 'w-5 h-5', strokeWidth = 2 }: WhiskIconProps) {
  return <Icon iconNode={whisk} className={className} strokeWidth={strokeWidth} />;
}
