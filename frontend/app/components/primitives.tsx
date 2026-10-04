"use client";

import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

import { useDefault } from "./BrandProvider";

export function Stack({
  direction = "column",
  gap,
  align,
  justify,
  as: Tag = "div",
  children,
  ...rest
}: {
  direction?: "row" | "column";
  gap?: "tight" | "loose";
  align?: "start" | "end";
  justify?: "between";
  as?: ElementType;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<"div">, "children">) {
  return (
    <Tag
      className="strata-stack"
      data-direction={direction}
      data-gap={gap}
      data-align={align}
      data-justify={justify}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function Text({
  tone,
  size,
  as: Tag = "p",
  children,
  ...rest
}: {
  tone?: "secondary" | "accent" | "inverse" | "danger";
  size?: "caption";
  as?: ElementType;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<"p">, "children">) {
  return (
    <Tag className="strata-text" data-tone={tone} data-size={size} {...rest}>
      {children}
    </Tag>
  );
}

export function Heading({
  level = 1,
  as,
  children,
  ...rest
}: {
  level?: 1 | 2 | 3 | 4;
  as?: ElementType;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<"h1">, "children">) {
  const Tag = (as ?? (`h${level}` as ElementType)) as ElementType;
  return (
    <Tag className="strata-heading" data-level={level} {...rest}>
      {children}
    </Tag>
  );
}

export function Button({
  variant,
  size,
  children,
  ...rest
}: {
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<"button">, "children">) {
  const resolvedVariant = useDefault(variant, (d) => d.button?.variant, "primary");
  const resolvedSize = useDefault(size, (d) => d.button?.size, "md");

  return (
    <button
      type="button"
      className="strata-button"
      data-variant={resolvedVariant}
      data-size={resolvedSize}
      {...rest}
    >
      {children}
    </button>
  );
}

export function IconButton({
  variant,
  shape = "square",
  label,
  children,
  ...rest
}: {
  variant?: "primary" | "secondary";
  shape?: "square" | "circle";
  
  label: string;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<"button">, "children">) {
  const resolvedVariant = useDefault(variant, (d) => d.button?.variant, "primary");

  return (
    <button
      type="button"
      className="strata-icon-button"
      data-variant={resolvedVariant}
      data-shape={shape}
      aria-label={label}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Badge({
  tone = "neutral",
  shape = "pill",
  children,
  ...rest
}: {
  tone?: "neutral" | "accent" | "danger";
  shape?: "pill" | "square";
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<"span">, "children">) {
  return (
    <span className="strata-badge" data-tone={tone} data-shape={shape} {...rest}>
      {children}
    </span>
  );
}

export function Field({
  label,
  description,
  invalid,
  htmlFor,
  children,
  ...rest
}: {
  label: string;
  description?: string;
  invalid?: boolean;
  htmlFor?: string;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<"div">, "children">) {
  return (
    <div className="strata-field" data-invalid={invalid || undefined} {...rest}>
      <label className="strata-field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {description ? (
        <span className="strata-field-description">{description}</span>
      ) : null}
    </div>
  );
}

export function Input(props: ComponentPropsWithoutRef<"input">) {
  return <input className="strata-input" {...props} />;
}

export function Select({
  options,
  children,
  ...rest
}: {
  options?: string[];
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<"select">, "children">) {
  return (
    <select className="strata-select" {...rest}>
      {options ? options.map((o) => <option key={o}>{o}</option>) : children}
    </select>
  );
}

export function Card({
  elevation,
  children,
  ...rest
}: {
  elevation?: "flat" | "raised";
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<"div">, "children">) {
  const resolved = useDefault(elevation, (d) => d.card?.elevation, "flat");
  return (
    <div className="strata-card" data-elevation={resolved} {...rest}>
      {children}
    </div>
  );
}

export function Row({
  label,
  meta,
  value,
  children,
  ...rest
}: {
  label?: ReactNode;
  meta?: ReactNode;
  value?: ReactNode;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<"div">, "children">) {
  return (
    <div className="strata-row" {...rest}>
      {children ?? (
        <>
          <span className="strata-row-label">{label}</span>
          {meta ? <span className="strata-row-meta">{meta}</span> : null}
          {value ? <span className="strata-row-value">{value}</span> : null}
        </>
      )}
    </div>
  );
}
