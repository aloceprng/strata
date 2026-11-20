import Image from "next/image";

// fill_logo.svg is 1212 × 324
const ASPECT = 1212 / 324;

export function StrataLogo({ height, className }: { height: number; className?: string }) {
  return (
    <Image
      src="/assets/fill_logo.svg"
      alt="Strata"
      width={Math.round(height * ASPECT)}
      height={height}
      className={className}
      style={{ display: "block" }}
    />
  );
}
