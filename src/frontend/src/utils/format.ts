/**
 * Format a number as USD currency
 */
export function formatCurrency(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1_000_000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format a percentage
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format a timestamp (bigint nanoseconds) as a short date/time
 */
export function formatTimestamp(ns: bigint): string {
  const ms = Number(ns / BigInt(1_000_000));
  const date = new Date(ms);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Get risk level label and color
 */
export function getRiskLevel(score: number | bigint): {
  label: string;
  color: string;
  bg: string;
} {
  const n = typeof score === "bigint" ? Number(score) : score;
  if (n <= 3)
    return {
      label: "LOW",
      color: "text-terminal-green",
      bg: "bg-terminal-green/10 border border-terminal-green/30",
    };
  if (n <= 6)
    return {
      label: "MED",
      color: "text-terminal-amber",
      bg: "bg-terminal-amber/10 border border-terminal-amber/30",
    };
  if (n <= 8)
    return {
      label: "HIGH",
      color: "text-orange-400",
      bg: "bg-orange-400/10 border border-orange-400/30",
    };
  return {
    label: "VERY HIGH",
    color: "text-terminal-red",
    bg: "bg-terminal-red/10 border border-terminal-red/30",
  };
}

/**
 * Get account type abbreviation for display
 */
export function getAccountTypeAbbr(type: string): string {
  const map: Record<string, string> = {
    Equity: "EQ",
    Bond: "BD",
    Cash: "CS",
    "Real Estate": "RE",
    Crypto: "CR",
    Commodities: "CM",
    Alternative: "AL",
  };
  return map[type] ?? type.slice(0, 2).toUpperCase();
}

/**
 * Get account type color
 */
export function getAccountTypeColor(type: string): string {
  const map: Record<string, string> = {
    Equity: "text-terminal-green border-terminal-green/30 bg-terminal-green/10",
    Bond: "text-terminal-cyan border-terminal-cyan/30 bg-terminal-cyan/10",
    Cash: "text-terminal-amber border-terminal-amber/30 bg-terminal-amber/10",
    "Real Estate": "text-purple-400 border-purple-400/30 bg-purple-400/10",
    Crypto: "text-blue-400 border-blue-400/30 bg-blue-400/10",
    Commodities: "text-orange-400 border-orange-400/30 bg-orange-400/10",
    Alternative: "text-pink-400 border-pink-400/30 bg-pink-400/10",
  };
  return map[type] ?? "text-muted-foreground border-border/30 bg-muted/10";
}
