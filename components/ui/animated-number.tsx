'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useTransform, useInView } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  formatFn?: (value: number) => string;
  duration?: number;
  className?: string;
}

export function AnimatedNumber({
  value,
  formatFn = (v) => v.toLocaleString(),
  duration = 1,
  className,
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [displayValue, setDisplayValue] = useState(0);

  const spring = useSpring(0, {
    stiffness: 100,
    damping: 30,
    duration: duration * 1000,
  });

  const display = useTransform(spring, (current) => formatFn(Math.round(current)));

  useEffect(() => {
    if (isInView) {
      spring.set(value);
    }
  }, [spring, value, isInView]);

  useEffect(() => {
    const unsubscribe = display.on('change', (latest) => {
      setDisplayValue(latest as unknown as number);
    });
    return unsubscribe;
  }, [display]);

  return (
    <motion.span ref={ref} className={className}>
      {displayValue || formatFn(0)}
    </motion.span>
  );
}

// Specialized version for currency
interface AnimatedCurrencyProps {
  cents: number;
  currency?: string;
  duration?: number;
  className?: string;
}

export function AnimatedCurrency({
  cents,
  currency = 'USD',
  duration = 1.5,
  className,
}: AnimatedCurrencyProps) {
  return (
    <AnimatedNumber
      value={cents}
      duration={duration}
      className={className}
      formatFn={(value) =>
        new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(value / 100)
      }
    />
  );
}

// Specialized version for percentages
interface AnimatedPercentProps {
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
}

export function AnimatedPercent({
  value,
  decimals = 1,
  duration = 1,
  className,
}: AnimatedPercentProps) {
  return (
    <AnimatedNumber
      value={value * 100} // Multiply to work with whole numbers internally
      duration={duration}
      className={className}
      formatFn={(v) => `${(v / 100).toFixed(decimals)}%`}
    />
  );
}

