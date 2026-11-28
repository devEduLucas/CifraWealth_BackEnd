import { createHash } from "node:crypto";
import { AppError } from "../utils/AppError.js";

export type ParsedStatementTransaction = {
  date: string;
  amount: number;
  description: string;
  fingerprint: string;
  suggestedType: "receita" | "despesa";
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function parseDate(value: string): string | null {
  const input = value.trim();
  const ofx = input.match(/^(\d{4})(\d{2})(\d{2})/);
  if (ofx) return `${ofx[1]}-${ofx[2]}-${ofx[3]}`;

  const br = input.match(/^(\d{2})[\/.-](\d{2})[\/.-](\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;

  const iso = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return input;

  return null;
}

function parseAmount(value: string): number | null {
  let normalized = value.trim().replace(/[R$\s]/g, "");
  if (!normalized) return null;

  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.lastIndexOf(",") > normalized.lastIndexOf(".")
      ? normalized.replace(/\./g, "").replace(",", ".")
      : normalized.replace(/,/g, "");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }

  const amount = Number(normalized);
  return Number.isFinite(amount) && amount !== 0 ? Math.round(amount * 100) / 100 : null;
}

function createFingerprint(date: string, amount: number, description: string): string {
  return createHash("sha256")
    .update(`${date}| ${amount.toFixed(2)}| ${normalizeText(description)}`)
    .digest("hex");
}

function normalizeRecord(dateValue: string, amountValue: string, descriptionValue: string): ParsedStatementTransaction | null {
  const date = parseDate(dateValue);
  const amount = parseAmount(amountValue);
  const description = descriptionValue.trim().replace(/\s+/g, " ").slice(0, 190);
  if (!date || amount === null || !description) return null;

  return {
    date,
    amount: Math.abs(amount),
    description,
    fingerprint: createFingerprint(date, amount, description),
    suggestedType: amount > 0 ? "receita" : "despesa",
  };
}

function parseOfx(text: string): ParsedStatementTransaction[] {
  const records = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
  return records.flatMap((record) => {
    const field = (name: string) => record.match(new RegExp(`<${name}>([^\\r\\n<]+)`, "i"))?.[1] ?? "";
    const transaction = normalizeRecord(field("DTPOSTED"), field("TRNAMT"), field("MEMO") || field("NAME"));
    return transaction ? [transaction] : [];
  });
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      values.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }

  values.push(value.trim());
  return values;
}

function parseCsv(text: string): ParsedStatementTransaction[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const delimiter = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const headers = splitCsvLine(lines[0], delimiter).map(normalizeText);
  const findColumn = (names: string[]) => headers.findIndex((header) => names.some((name) => header.includes(name)));

  const dateIndex = findColumn(["data", "date", "dt"]);
  const amountIndex = findColumn(["valor", "amount", "montante", "value"]);
  const debitIndex = findColumn(["debito", "debit", "saida"]);
  const creditIndex = findColumn(["credito", "credit", "entrada"]);
  const descriptionIndex = findColumn(["descricao", "description", "historico", "memo", "detalhe", "name"]);

  if (dateIndex < 0 || descriptionIndex < 0 || (amountIndex < 0 && debitIndex < 0 && creditIndex < 0)) {
    throw new AppError("CSV não reconhecido. O arquivo precisa conter colunas de data, descrição e valor (ou débito/crédito).", 400);
  }

  return lines.slice(1).flatMap((line) => {
    const cells = splitCsvLine(line, delimiter);
    const amount = amountIndex >= 0
      ? cells[amountIndex] ?? ""
      : (cells[creditIndex] ? cells[creditIndex] : `-${cells[debitIndex] ?? ""}`);
    const transaction = normalizeRecord(cells[dateIndex] ?? "", amount, cells[descriptionIndex] ?? "");
    return transaction ? [transaction] : [];
  });
}

export function parseBankStatement(fileName: string, text: string): ParsedStatementTransaction[] {
  if (!text.trim()) throw new AppError("O arquivo enviado está vazio.", 400);
  const extension = fileName.toLowerCase().split(".").pop();
  const transactions = extension === "ofx" || /<OFX>/i.test(text)
    ? parseOfx(text)
    : extension === "csv" ? parseCsv(text) : null;

  if (!transactions) throw new AppError("Formato não suportado. Envie um arquivo OFX ou CSV.", 400);
  if (transactions.length === 0) throw new AppError("Nenhuma movimentação válida foi encontrada no extrato.", 400);
  if (transactions.length > 5000) throw new AppError("O extrato ultrapassa o limite de 5.000 movimentações.", 400);

  return transactions;
}
