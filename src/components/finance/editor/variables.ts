/**
 * @component components/finance/editor/variables.ts
 * @status STABLE
 * @description Moneta invoice canvas — variables
 * @lastReview 2026-03-28
 */
export interface VariableContext {
  client?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    company?: string;
    address?: string;
  };
  job?: {
    title?: string;
    display_id?: string;
    custom_interval?: string;
  };
  org?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  invoice?: {
    number?: string;
    total?: string;
    due_date?: string;
    issue_date?: string;
  };
}

const TOKEN_RE = /\{(\w+)\.(\w+)\}/g;

export function hydrateVariables(text: string, ctx: VariableContext): string {
  return text.replace(TOKEN_RE, (match, entity, field) => {
    const group = ctx[entity as keyof VariableContext];
    if (!group) return match;
    const value = (group as Record<string, string | undefined>)[field];
    return value ?? match;
  });
}

export function extractVariableTokens(text: string): string[] {
  const tokens: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(TOKEN_RE.source, "g");
  while ((m = re.exec(text)) !== null) {
    tokens.push(m[0]);
  }
  return tokens;
}

export interface VariableOption {
  token: string;
  label: string;
  group: string;
}

export const AVAILABLE_VARIABLES: VariableOption[] = [
  { token: "{client.first_name}", label: "Client First Name", group: "Client" },
  { token: "{client.last_name}", label: "Client Last Name", group: "Client" },
  { token: "{client.email}", label: "Client Email", group: "Client" },
  { token: "{client.company}", label: "Client Company", group: "Client" },
  { token: "{client.address}", label: "Client Address", group: "Client" },
  { token: "{job.title}", label: "Job Title", group: "Job" },
  { token: "{job.display_id}", label: "Job ID", group: "Job" },
  { token: "{job.custom_interval}", label: "Service Interval", group: "Job" },
  { token: "{org.name}", label: "Organisation Name", group: "Organisation" },
  { token: "{org.email}", label: "Organisation Email", group: "Organisation" },
  { token: "{org.phone}", label: "Organisation Phone", group: "Organisation" },
  { token: "{invoice.number}", label: "Invoice Number", group: "Invoice" },
  { token: "{invoice.total}", label: "Invoice Total", group: "Invoice" },
  { token: "{invoice.due_date}", label: "Due Date", group: "Invoice" },
  { token: "{invoice.issue_date}", label: "Issue Date", group: "Invoice" },
];
