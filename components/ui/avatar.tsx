import { cn, colorFromString, initials } from "@/lib/utils";
import { avatarById } from "@/lib/avatars";
import { PresetAvatar } from "./preset-avatar";

interface AliasAvatarProps {
  alias: string;
  color?: string | null;
  url?: string | null;
  /** Illustrated-avatar id (users.preset_avatar_id) — renders the same face the app/website show. */
  presetAvatarId?: string | null;
  size?: number;
  className?: string;
}

/**
 * Author avatar. Priority mirrors the app: uploaded photo (avatar_url) → preset
 * illustrated face (preset_avatar_id) → colour disc with alias initials. This
 * keeps the admin preview visually identical to the app and website.
 */
export function AliasAvatar({ alias, color, url, presetAvatarId, size = 32, className }: AliasAvatarProps) {
  const preset = url ? null : avatarById(presetAvatarId);
  const bg = color || colorFromString(alias || "anon");
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium text-white ring-1 ring-inset ring-white/10",
        className
      )}
      style={{ width: size, height: size, background: url || preset ? undefined : bg, fontSize: size * 0.4 }}
      title={alias}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alias} className="h-full w-full object-cover" />
      ) : preset ? (
        <PresetAvatar char={preset} size={size} />
      ) : (
        initials(alias || "??")
      )}
    </span>
  );
}
