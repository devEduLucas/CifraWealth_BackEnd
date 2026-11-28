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
    const field = (name: string) => {
      const match = record.match(new RegExp("<" + name + ">([^<\r\n]+)", "i"));
      return match?.[1]?.trim() ?? "";
    };
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

function validateTransactionCount(transactions: ParsedStatementTransaction[]): ParsedStatementTransaction[] {
  if (transactions.length === 0) {
    throw new AppError("Nenhuma movimentação válida foi encontrada no extrato.", 400);
  }
  if (transactions.length > 5000) {
    throw new AppError("O extrato ultrapassa o limite de 5.000 movimentações.", 400);
  }
  return transactions;
}

export function parseBankStatement(fileName: string, text: string): ParsedStatementTransaction[] {
  if (!text.trim()) throw new AppError("O arquivo enviado está vazio.", 400);
  const extension = fileName.toLowerCase().split(".").pop();
  const transactions = extension === "ofx" || /<OFX>/i.test(text)
    ? parseOfx(text)
    : extension === "csv" ? parseCsv(text) : null;

  if (!transactions) throw new AppError("Formato não suportado. Envie um arquivo OFX ou CSV.", 400);
  return validateTransactionCount(transactions);
}

const PDF_MONEY_PATTERN = /(?:R\$\s*)?([+-]?\s*(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})\s*(?:\(?([DC])\)?)?/gi;
const EXPENSE_HINTS = /\b(?:debito|debitado|pagamento|pagto|compra|pix enviado|transferencia enviada|ted enviada|doc enviada|saque|tarifa|boleto|fatura|parcela|recarga|retirada)\b/;
const INCOME_HINTS = /\b(?:credito|creditado|pix recebido|transferencia recebida|ted recebida|doc recebida|salario|deposito|rendimento|estorno|resgate)\b/;

function parsePdfTransactionRecord(record: string): ParsedStatementTransaction | null {
  const dateMatch = record.match(/^\s*(\d{2}\/\d{2}\/\d{4})\b/);
  if (!dateMatch) return null;

  const dateValue = dateMatch[1] ?? "";
  const body = record.slice(dateMatch[0].length);
  const amountMatches = [...body.matchAll(PDF_MONEY_PATTERN)];
  const firstAmount = amountMatches[0];
  if (!firstAmount) return null;

  const rawAmount = firstAmount[1]?.replace(/\s/g, "") ?? "";
  const suffix = firstAmount[2]?.toUpperCase();
  const parsedAmount = parseAmount(rawAmount);
  if (parsedAmount === null) return null;

  let signedAmount = parsedAmount;
  if (suffix === "D") {
    signedAmount = -Math.abs(parsedAmount);
  } else if (suffix === "C") {
    signedAmount = Math.abs(parsedAmount);
  } else if (!/^[+-]/.test(rawAmount)) {
    const normalizedBody = normalizeText(body);
    if (EXPENSE_HINTS.test(normalizedBody)) signedAmount = -Math.abs(parsedAmount);
    else if (INCOME_HINTS.test(normalizedBody)) signedAmount = Math.abs(parsedAmount);
    else return null; // Sem sinal ou indicação de crédito/débito, não presumimos a natureza.
  }

  const description = body
    .replace(PDF_MONEY_PATTERN, " ")
    .replace(/\bsaldo(?:\s+(?:anterior|do dia|final|disponivel|bloqueado))?\b/gi, " ")
    .replace(/[|•]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!description || /^saldo(?:\s|$)/i.test(normalizeText(description))) return null;
  return normalizeRecord(dateValue, String(signedAmount), description);
}

/**
 * Interpreta o texto extraído de um extrato PDF. O parser exige sinal, D/C
 * ou uma descrição que indique claramente crédito/débito; valores ambíguos
 * são ignorados para evitar criar receitas e despesas invertidas.
 */
export function parsePdfStatementText(text: string): ParsedStatementTransaction[] {
  const lines = text.replace(/\u00a0/g, " ").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const records: string[] = [];
  let current: string[] = [];

  const finishCurrent = () => {
    if (current.length) records.push(current.join(" "));
    current = [];
  };

  for (const line of lines) {
    if (/^\d{2}\/\d{2}\/\d{4}\b/.test(line)) {
      finishCurrent();
      current = [line];
      continue;
    }

    const normalizedLine = normalizeText(line);
    const isFooter = /(?:central de atendimento|ouvidoria|sac|itau\.com|www\.)/.test(normalizedLine);
    if (current.length > 0 && current.length < 3 && !isFooter) current.push(line);
  }
  finishCurrent();

  const transactions = records.flatMap((record) => {
    const transaction = parsePdfTransactionRecord(record);
    return transaction ? [transaction] : [];
  });

  if (transactions.length === 0) {
    throw new AppError(
      "Não foi possível identificar movimentações neste PDF. Ele pode estar escaneado como imagem ou usar um layout que ainda não reconhecemos.",
      400
    );
  }

  return validateTransactionCount(transactions);
}

type PdfTextItem = { str?: string; transform?: number[] };

function groupPdfTextItems(items: PdfTextItem[]): string[] {
  const fragments = items
    .filter((item) => typeof item.str === "string" && item.str.trim())
    .map((item) => ({
      text: item.str?.trim() ?? "",
      x: item.transform?.[4] ?? 0,
      y: item.transform?.[5] ?? 0,
    }))
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: Array<{ y: number; fragments: typeof fragments }> = [];
  for (const fragment of fragments) {
    const lastLine = lines[lines.length - 1];
    if (lastLine && Math.abs(lastLine.y - fragment.y) <= 2.5) {
      lastLine.fragments.push(fragment);
    } else {
      lines.push({ y: fragment.y, fragments: [fragment] });
    }
  }

  return lines
    .map((line) => line.fragments.sort((a, b) => a.x - b.x).map((fragment) => fragment.text).join(" ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export async function parseBankStatementPdf(buffer: Buffer): Promise<ParsedStatementTransaction[]> {
  if (buffer.length === 0) throw new AppError("O arquivo enviado está vazio.", 400);
  if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new AppError("O arquivo selecionado não é um PDF válido.", 400);
  }

  let loadingTask: { promise: Promise<{ numPages: number; getPage: (pageNumber: number) => Promise<{ getTextContent: () => Promise<{ items: PdfTextItem[] }>; cleanup: () => void }> }>; destroy: () => Promise<void> } | undefined;

  try {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    loadingTask = getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      isEvalSupported: false,
      enableXfa: false,
      stopAtErrors: true,
      verbosity: 0,
    });

    const pdf = await loadingTask.promise;
    if (pdf.numPages > 100) {
      throw new AppError("O PDF ultrapassa o limite de 100 páginas por importação.", 413);
    }

    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(groupPdfTextItems(content.items).join("\n"));
      page.cleanup();
    }

    return parsePdfStatementText(pages.join("\n"));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "Não foi possível ler este PDF. Verifique se o arquivo não está protegido por senha ou danificado.",
      400
    );
  } finally {
    if (loadingTask) await loadingTask.destroy().catch(() => undefined);
  }
}
