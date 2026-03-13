import {
  Asterisk,
  Binary,
  Braces,
  Clock,
  Database,
  ExternalLink,
  Fingerprint,
  Hash,
  KeyRound,
  Link2,
  Timer,
} from "lucide-svelte";

export const toolCategories = [
  "Identifiers",
  "Formatters",
  "Pattern & Scheduling",
  "Encoding",
  "Security",
  "Time",
  "Delivery",
] as const;

export type ToolCategory = (typeof toolCategories)[number];

export type Tool = {
  name: string;
  description: string;
  icon: typeof Fingerprint;
  href: string;
  color: string;
  hoverColor: string;
  category: ToolCategory;
  keywords: string[];
};

export const tools: Tool[] = [
  {
    name: "UUID Generator",
    description: "Generate and validate RFC 4122 UUIDs (v4)",
    icon: Fingerprint,
    href: "/uuid",
    color: "bg-indigo-50 text-indigo-600 border-indigo-100",
    hoverColor: "group-hover:bg-indigo-600 group-hover:text-white",
    category: "Identifiers",
    keywords: ["uuid", "guid", "v4", "id"],
  },
  {
    name: "JSON Formatter",
    description: "Format, minify, and validate JSON data",
    icon: Braces,
    href: "/json",
    color: "bg-emerald-50 text-emerald-600 border-emerald-100",
    hoverColor: "group-hover:bg-emerald-600 group-hover:text-white",
    category: "Formatters",
    keywords: ["json", "format", "minify", "prettify", "validate"],
  },
  {
    name: "Regex Tool",
    description: "Validate, test, and generate regex patterns",
    icon: Asterisk,
    href: "/regex",
    color: "bg-rose-50 text-rose-600 border-rose-100",
    hoverColor: "group-hover:bg-rose-600 group-hover:text-white",
    category: "Pattern & Scheduling",
    keywords: ["regex", "regexp", "pattern", "match"],
  },
  {
    name: "CRON Tool",
    description: "Generate and validate CRON schedules",
    icon: Timer,
    href: "/cron",
    color: "bg-cyan-50 text-cyan-600 border-cyan-100",
    hoverColor: "group-hover:bg-cyan-600 group-hover:text-white",
    category: "Pattern & Scheduling",
    keywords: ["cron", "schedule", "job", "timer"],
  },
  {
    name: "Base64 Tool",
    description: "Encode and decode Base64 strings",
    icon: Binary,
    href: "/base64",
    color: "bg-sky-50 text-sky-600 border-sky-100",
    hoverColor: "group-hover:bg-sky-600 group-hover:text-white",
    category: "Encoding",
    keywords: ["base64", "b64", "encode", "decode"],
  },
  {
    name: "URL Encoder",
    description: "Encode and decode URL strings",
    icon: ExternalLink,
    href: "/url",
    color: "bg-teal-50 text-teal-600 border-teal-100",
    hoverColor: "group-hover:bg-teal-600 group-hover:text-white",
    category: "Encoding",
    keywords: ["url", "uri", "encode", "decode", "query"],
  },
  {
    name: "JWT Decoder",
    description: "Inspect JWT header and payload",
    icon: KeyRound,
    href: "/jwt",
    color: "bg-amber-50 text-amber-600 border-amber-100",
    hoverColor: "group-hover:bg-amber-600 group-hover:text-white",
    category: "Security",
    keywords: ["jwt", "token", "decode", "header", "payload"],
  },
  {
    name: "Hash Tool",
    description: "Generate SHA hashes locally",
    icon: Hash,
    href: "/hash",
    color: "bg-slate-50 text-slate-600 border-slate-100",
    hoverColor: "group-hover:bg-slate-600 group-hover:text-white",
    category: "Security",
    keywords: ["hash", "sha", "digest", "sha256", "sha512"],
  },
  {
    name: "SQL Formatter",
    description: "Beautify and optimize your SQL queries",
    icon: Database,
    href: "/sql",
    color: "bg-blue-50 text-blue-600 border-blue-100",
    hoverColor: "group-hover:bg-blue-600 group-hover:text-white",
    category: "Formatters",
    keywords: ["sql", "format", "minify", "query"],
  },
  {
    name: "Timestamp Tool",
    description: "Convert and validate Unix timestamps",
    icon: Clock,
    href: "/timestamp",
    color: "bg-orange-50 text-orange-600 border-orange-100",
    hoverColor: "group-hover:bg-orange-600 group-hover:text-white",
    category: "Time",
    keywords: ["timestamp", "epoch", "time", "unix"],
  },
  {
    name: "GitHub CDN",
    description: "GitHub links to jsDelivr CDN URLs",
    icon: Link2,
    href: "/jsdelivr",
    color: "bg-purple-50 text-purple-600 border-purple-100",
    hoverColor: "group-hover:bg-purple-600 group-hover:text-white",
    category: "Delivery",
    keywords: ["github", "cdn", "jsdelivr", "raw", "link"],
  },
] as const;
