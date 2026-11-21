/*
 * List 2 (from 21st.dev), restyled for VITALS: rows of icon + title + category, a description and an
 * action, split by thin lines. The button is the site's liquid glass button; the separator is a 1px line
 * (no extra package needed for that). Rows reveal one after another as they scroll into view.
 */
import { ArrowRight } from "lucide-react";
import React from "react";
import { motion } from "framer-motion";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { cn } from "@/lib/utils";

export interface ListItem {
  icon: React.ReactNode;
  title: string;
  category: React.ReactNode;
  description: React.ReactNode;
  /** a button on the right: runs onClick, or follows href */
  action?: { label: string; onClick?: () => void; href?: string; disabled?: boolean };
}

interface List2Props {
  heading?: React.ReactNode;
  eyebrow?: string;
  items: ListItem[];
  className?: string;
}

const Separator = () => <div className="h-px w-full shrink-0 bg-gradient-to-r from-transparent via-cyan-200/20 to-transparent" />;

export const List2 = ({ heading, eyebrow, items, className }: List2Props) => {
  return (
    <section className={cn("py-6", className)}>
      {eyebrow && <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-cyan-300/80">{eyebrow}</p>}
      {heading && <h2 className="mb-8 text-3xl font-semibold tracking-tight md:mb-10 md:text-4xl">{heading}</h2>}
      <div className="flex flex-col">
        <Separator />
        {items.map((item, index) => {
          const button = item.action && (
            <LiquidButton
              type="button"
              size="sm"
              onClick={item.action.onClick}
              disabled={item.action.disabled}
              tabIndex={item.action.href ? -1 : undefined}
              className="h-10 gap-2 bg-cyan-400/15 px-5 text-sm font-semibold text-white disabled:opacity-40"
            >
              <span>{item.action.label}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </LiquidButton>
          );
          return (
            <React.Fragment key={item.title}>
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ type: "spring", stiffness: 260, damping: 30, delay: Math.min(index, 6) * 0.05 }}
                className="grid items-center gap-4 rounded-2xl px-2 py-5 transition-colors duration-300 hover:bg-white/[0.03] lg:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)_auto] lg:gap-8 lg:px-4"
              >
                <div className="order-2 flex items-center gap-3 lg:order-none">
                  <span className="flex h-14 w-16 shrink-0 items-center justify-center">{item.icon}</span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <h3 className="font-semibold text-white">{item.title}</h3>
                    <div className="text-sm text-white/55">{item.category}</div>
                  </div>
                </div>
                <div className="order-1 text-lg font-semibold leading-snug text-white/85 lg:order-none">{item.description}</div>
                {button && (
                  <div className="order-3 ml-auto w-fit lg:order-none">
                    {item.action!.href ? <a href={item.action!.href}>{button}</a> : button}
                  </div>
                )}
              </motion.div>
              <Separator />
            </React.Fragment>
          );
        })}
      </div>
    </section>
  );
};

export default List2;
