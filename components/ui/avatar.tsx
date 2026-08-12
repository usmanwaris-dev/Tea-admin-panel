import { cn, colorFromString, initials } from "@/lib/utils";

interface AliasAvatarProps {
  alias: string;
  color?: string | null;
  url?: string | null;
  size?: number;
  className?: string;
}

/**
 * Anonymous-first avatar. Renders the user's stored avatar color + alias
 * initials — never invents a photo the backend doesn't expose. If the backend
 * DOES store an avatar_url we honour it.
 */
export function AliasAvatar({ alias, color, url, size = 32, className }: AliasAvatarProps) {
  const bg = color || colorFromString(alias || "anon");
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium text-white ring-1 ring-inset ring-white/10",
        className
      )}
      style={{ width: size, height: size, background: url ? undefined : bg, fontSize: size * 0.4 }}
      title={alias}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alias} className="h-full w-full object-cover" />
      ) : (
        initials(alias || "??")
      )}
    </span>
  );
}
