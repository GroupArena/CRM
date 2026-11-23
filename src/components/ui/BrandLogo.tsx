import { useEffect, useState } from 'react';
import { getBrandLogoPath, getBrandSpec, type LogoVariant } from '../../utils/branding';

interface BrandLogoProps {
  entityId?: string;
  variant?: LogoVariant;
  className?: string;
  imgClassName?: string;
  alt?: string;
  customUrl?: string;
}

export function BrandLogo({
  entityId = 'group',
  variant = 'light',
  className = '',
  imgClassName = 'max-h-full max-w-full object-contain',
  alt,
  customUrl,
}: BrandLogoProps) {
  const [failed, setFailed] = useState(false);
  const spec = getBrandSpec(entityId);
  const src = customUrl || getBrandLogoPath(entityId, variant);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed) {
    return (
      <span
        className={`inline-flex items-center justify-center font-display font-bold tracking-tight ${
          variant === 'light' ? 'text-[#19283E]' : 'text-white'
        } ${className}`}
      >
        {spec.label}
      </span>
    );
  }

  return (
    <div className={`inline-flex items-center justify-center shrink-0 ${className}`}>
      <img
        src={src}
        alt={alt ?? `Logo ${spec.label}`}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={imgClassName}
      />
    </div>
  );
}

export function ArenaSymbol({
  className = 'h-8 w-8',
  color = '#C9A125',
  opacity = 1,
}: {
  className?: string;
  color?: string;
  opacity?: number;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={className}
      style={{ opacity }}
    >
      <rect
        x="24"
        y="8"
        width="12"
        height="40"
        rx="6"
        transform="rotate(30 30 28)"
        fill={color}
      />
      <circle cx="46" cy="44" r="7" fill={color} />
    </svg>
  );
}
