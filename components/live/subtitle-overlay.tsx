import { SubtitleChunk } from "@/lib/mock/subtitles";
import { cn } from "@/lib/utils";

type SubtitleOverlayProps = {
  lines: SubtitleChunk[];
  size: "S" | "M" | "L";
  position: "bottom" | "top";
  withBackground: boolean;
};

const sizeClasses = {
  S: "text-lg md:text-xl",
  M: "text-xl md:text-2xl",
  L: "text-2xl md:text-3xl"
};

export function SubtitleOverlay({
  lines,
  size,
  position,
  withBackground
}: SubtitleOverlayProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 z-20 flex justify-center px-4",
        position === "bottom" ? "bottom-8" : "top-20"
      )}
    >
      <div
        className={cn(
          "max-w-4xl rounded-2xl border border-white/15 px-4 py-3 backdrop-blur-lg transition-all",
          withBackground ? "bg-black/45" : "bg-transparent border-transparent"
        )}
      >
        <div className="space-y-1 text-center font-medium leading-tight text-white">
          {lines.map((line) => (
            <p
              key={line.id}
              className={cn(
                sizeClasses[size],
                line.kind === "partial"
                  ? "opacity-65 italic"
                  : "opacity-100 drop-shadow-[0_0_14px_rgba(255,255,255,0.22)]"
              )}
            >
              {line.text}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
