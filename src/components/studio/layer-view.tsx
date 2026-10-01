import { useEffect, useId, useState } from "react";
import { backgroundBaseFill, edgeExtensionLayout, fittedImageBox, focalCoverBox, imageDimensions, loadImageDimensions, responsiveCenterLines, responsiveImageLayout } from "@/lib/studio/image-fit";
import { polygonPoints } from "@/lib/studio/geom";
import type { ImageLayer, Layer, ShapeLayer, TextLayer } from "@/lib/studio/types";

function wrapLines(layer: TextLayer): string[] {
  const maxChars = Math.max(4, Math.floor(layer.w / Math.max(8, layer.fontSize * 0.92)));
  const raw = layer.text.replace(/\n/g, " ").trim();
  if ([...raw].length <= maxChars) return [raw];
  const words = raw.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if ([...next].length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
}

function ShapeNode({ layer }: { layer: ShapeLayer }) {
  const sw = layer.strokeWidth || 0;
  const common = {
    fill: layer.fill === "none" ? "none" : layer.fill,
    stroke: sw ? layer.stroke : "none",
    strokeWidth: sw,
    opacity: layer.opacity ?? 1,
  };
  if (layer.kind === "ellipse") {
    return (
      <ellipse
        cx={layer.x + layer.w / 2}
        cy={layer.y + layer.h / 2}
        rx={Math.abs(layer.w) / 2}
        ry={Math.abs(layer.h) / 2}
        {...common}
      />
    );
  }
  if (layer.kind === "line") {
    return (
      <line
        x1={layer.x}
        y1={layer.y}
        x2={layer.x + layer.w}
        y2={layer.y + layer.h}
        stroke={layer.stroke}
        strokeWidth={Math.max(1, sw)}
        strokeLinecap="round"
        opacity={layer.opacity ?? 1}
      />
    );
  }
  if (layer.kind === "polygon") {
    return <polygon points={polygonPoints(layer)} {...common} />;
  }
  return (
    <rect
      x={layer.x}
      y={layer.y}
      width={layer.w}
      height={layer.h}
      rx={layer.radius ?? 0}
      {...common}
    />
  );
}

export function LayerView({ layer }: { layer: Layer }) {
  if (layer.hidden) return null;
  const rot = layer.rotation ?? 0;
  const sx = layer.scaleX ?? 1;
  const sy = layer.scaleY ?? 1;
  const cx = layer.x + layer.w / 2;
  const cy = layer.y + layer.h / 2;
  const body = (() => {
    if (layer.type === "shape") return <ShapeNode layer={layer} />;
    if (layer.type === "rect") {
      return (
        <rect
          x={layer.x}
          y={layer.y}
          width={layer.w}
          height={layer.h}
          rx={layer.radius ?? 0}
          fill={layer.fill}
          stroke={layer.strokeWidth ? layer.stroke : undefined}
          strokeWidth={layer.strokeWidth}
          opacity={layer.opacity ?? 1}
        />
      );
    }
    if (layer.type === "image") return <FittedImage layer={layer} />;
    const lines = wrapLines(layer);
    const lh = layer.fontSize * (layer.lineHeight ?? 1.15);
    const startY = layer.y + (layer.h - lh * lines.length) / 2 + layer.fontSize * 0.82;
    const x =
      layer.align === "middle" ? layer.x + layer.w / 2 : layer.align === "end" ? layer.x + layer.w : layer.x;
    const anchor = layer.align === "middle" ? "middle" : layer.align === "end" ? "end" : "start";
    return (
      <text
        x={x}
        y={startY}
        fill={layer.fill}
        fontFamily={layer.fontFamily}
        fontWeight={layer.fontWeight}
        fontSize={layer.fontSize}
        textAnchor={anchor}
        letterSpacing={layer.letterSpacing ?? 0}
        opacity={layer.opacity ?? 1}
      >
        {lines.map((line, i) => (
          <tspan key={i} x={x} dy={i === 0 ? 0 : lh}>
            {line}
          </tspan>
        ))}
      </text>
    );
  })();

  if (!rot && sx === 1 && sy === 1) return body;
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${rot}) scale(${sx} ${sy}) translate(${-cx} ${-cy})`}>{body}</g>
  );
}

function FittedImage({ layer }: { layer: ImageLayer }) {
  const clipId = useId().replace(/:/g, "");
  const [loaded, setLoaded] = useState<{ href: string; width: number; height: number } | null>(null);
  const size = imageDimensions(layer) ?? (loaded?.href === layer.href ? loaded : null);
  useEffect(() => {
    if (imageDimensions(layer)) return;
    let current = true;
    loadImageDimensions(layer.href).then((value) => { if (current) setLoaded({ href: layer.href, ...value }); }).catch(() => {});
    return () => { current = false; };
  }, [layer.href, layer.intrinsicWidth, layer.intrinsicHeight]);
  if (!size) return null;
  if (layer.fit === "responsive") {
    const layout = responsiveImageLayout(layer, size.width, size.height);
    const left = `${clipId}-left`;
    const right = `${clipId}-right`;
    return <g opacity={layer.opacity ?? 1}>
      <defs>
        <clipPath id={left}><rect x={layer.x} y={layer.y} width={layout.cap} height={layer.h}/></clipPath>
        <clipPath id={right}><rect x={layout.rightClipX} y={layer.y} width={layout.cap} height={layer.h}/></clipPath>
      </defs>
      <rect x={layer.x} y={layer.y} width={layer.w} height={layer.h} fill={layer.backgroundFill ?? backgroundBaseFill(layer.href)}/>
      {responsiveCenterLines(layer.backgroundSource ?? layer.href, layer, layout, size.width).map((line, i) =>
        <line key={i} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke={line.stroke} strokeWidth={line.width} opacity={line.opacity}/>)}
      <image href={layer.href} x={layout.leftX} y={layout.imageY} width={layout.imageWidth} height={layout.imageHeight} preserveAspectRatio="none" clipPath={`url(#${left})`}/>
      <image href={layer.href} x={layout.rightX} y={layout.imageY} width={layout.imageWidth} height={layout.imageHeight} preserveAspectRatio="none" clipPath={`url(#${right})`}/>
    </g>;
  }
  const box = layer.focus && layer.fit !== "contain"
    ? focalCoverBox(layer, size.width, size.height)
    : fittedImageBox(layer, size.width, size.height);
  const edge = layer.fit === "contain" && layer.role === "background"
    ? edgeExtensionLayout(layer, size.width, size.height)
    : null;
  const blurId = `${clipId}-edgeblur`;
  const leftFadeId = `${clipId}-leftfade`;
  const rightFadeId = `${clipId}-rightfade`;
  const topFadeId = `${clipId}-topfade`;
  const bottomFadeId = `${clipId}-bottomfade`;
  const blur = Math.max(8, Math.min(layer.w, layer.h) * 0.032);
  const tint = layer.backgroundFill ?? "#ffffff";
  return <g opacity={layer.opacity ?? 1} clipPath={`url(#${clipId})`}>
    <defs>
      <clipPath id={clipId}><rect x={layer.x} y={layer.y} width={layer.w} height={layer.h}/></clipPath>
      {edge && edge.axis !== "none" ? <filter id={blurId} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation={blur}/><feColorMatrix type="saturate" values="0.78"/></filter> : null}
      <linearGradient id={leftFadeId} x1="0%" x2="100%"><stop offset="0%" stopColor={tint} stopOpacity="0.24"/><stop offset="100%" stopColor={tint} stopOpacity="0.03"/></linearGradient>
      <linearGradient id={rightFadeId} x1="0%" x2="100%"><stop offset="0%" stopColor={tint} stopOpacity="0.03"/><stop offset="100%" stopColor={tint} stopOpacity="0.24"/></linearGradient>
      <linearGradient id={topFadeId} y1="0%" y2="100%"><stop offset="0%" stopColor={tint} stopOpacity="0.24"/><stop offset="100%" stopColor={tint} stopOpacity="0.03"/></linearGradient>
      <linearGradient id={bottomFadeId} y1="0%" y2="100%"><stop offset="0%" stopColor={tint} stopOpacity="0.03"/><stop offset="100%" stopColor={tint} stopOpacity="0.24"/></linearGradient>
    </defs>
    {layer.fit === "contain" ? <rect x={layer.x} y={layer.y} width={layer.w} height={layer.h} fill={layer.backgroundFill ?? "#ffffff"}/> : null}
    {edge?.axis === "x" && edge.leftGap > 0 ? (
      <svg x={layer.x} y={layer.y} width={edge.leftGap + 1} height={layer.h} viewBox={`${size.width - edge.slice} 0 ${edge.slice} ${size.height}`} preserveAspectRatio="none" overflow="hidden">
        <image href={layer.href} x={0} y={0} width={size.width} height={size.height} preserveAspectRatio="none" transform={`translate(${size.width} 0) scale(-1 1)`} filter={`url(#${blurId})`} opacity={0.82}/>
      </svg>
    ) : null}
    {edge?.axis === "x" && edge.rightGap > 0 ? (
      <svg x={box.x + box.w - 1} y={layer.y} width={edge.rightGap + 1} height={layer.h} viewBox={`0 0 ${edge.slice} ${size.height}`} preserveAspectRatio="none" overflow="hidden">
        <image href={layer.href} x={0} y={0} width={size.width} height={size.height} preserveAspectRatio="none" transform={`translate(${size.width} 0) scale(-1 1)`} filter={`url(#${blurId})`} opacity={0.82}/>
      </svg>
    ) : null}
    {edge?.axis === "y" && edge.topGap > 0 ? (
      <svg x={layer.x} y={layer.y} width={layer.w} height={edge.topGap + 1} viewBox={`0 ${size.height - edge.slice} ${size.width} ${edge.slice}`} preserveAspectRatio="none" overflow="hidden">
        <image href={layer.href} x={0} y={0} width={size.width} height={size.height} preserveAspectRatio="none" transform={`translate(0 ${size.height}) scale(1 -1)`} filter={`url(#${blurId})`} opacity={0.82}/>
      </svg>
    ) : null}
    {edge?.axis === "y" && edge.bottomGap > 0 ? (
      <svg x={layer.x} y={box.y + box.h - 1} width={layer.w} height={edge.bottomGap + 1} viewBox={`0 0 ${size.width} ${edge.slice}`} preserveAspectRatio="none" overflow="hidden">
        <image href={layer.href} x={0} y={0} width={size.width} height={size.height} preserveAspectRatio="none" transform={`translate(0 ${size.height}) scale(1 -1)`} filter={`url(#${blurId})`} opacity={0.82}/>
      </svg>
    ) : null}
    {edge?.axis === "x" && edge.leftGap > 0 ? <rect x={layer.x} y={layer.y} width={edge.leftGap + 1} height={layer.h} fill={`url(#${leftFadeId})`}/> : null}
    {edge?.axis === "x" && edge.rightGap > 0 ? <rect x={box.x + box.w - 1} y={layer.y} width={edge.rightGap + 1} height={layer.h} fill={`url(#${rightFadeId})`}/> : null}
    {edge?.axis === "y" && edge.topGap > 0 ? <rect x={layer.x} y={layer.y} width={layer.w} height={edge.topGap + 1} fill={`url(#${topFadeId})`}/> : null}
    {edge?.axis === "y" && edge.bottomGap > 0 ? <rect x={layer.x} y={box.y + box.h - 1} width={layer.w} height={edge.bottomGap + 1} fill={`url(#${bottomFadeId})`}/> : null}
    <image href={layer.href} x={box.x} y={box.y} width={box.w} height={box.h} preserveAspectRatio="xMidYMid meet"/>
  </g>;
}
