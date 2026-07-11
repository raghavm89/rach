"use client";

import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

interface AnimateInProps {
  children: React.ReactNode;
  delay?: number;
  direction?: "up" | "left" | "right";
  duration?: number;
  className?: string;
}

export function AnimateIn({
  children,
  delay = 0,
  direction = "up",
  duration = 0.6,
  className,
}: AnimateInProps) {
  const offsets = {
    up: { x: 0, y: 30 },
    left: { x: -30, y: 0 },
    right: { x: 30, y: 0 },
  };

  return (
    <motion.div
      initial={{ opacity: 0, ...offsets[direction] }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration, ease: "easeOut", delay }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
