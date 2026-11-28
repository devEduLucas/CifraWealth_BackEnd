import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBankStatement } from "../src/services/bankStatementParser.service.js";

test("parses OFX statement transactions and direction", () => {
  const ofx = `<OFX>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261125120000
<TRNAMT>-125.90
<NAME>SUPERMERCADO
<MEMO>Compra mercado
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261126120000
<TRNAMT>2500.00
<NAME>SALARIO
</STMTTRN>
</BANKTRANLIST>
</OFX>`;

  const result = parseBankStatement("conta.ofx", ofx);
  assert.equal(result.length, 2);
  assert.equal(result[0].date, "2026-11-25");
  assert.equal(result[0].amount, 125.9);
  assert.equal(result[0].suggestedType, "despesa");
  assert.equal(result[0].description, "Compra mercado");
  assert.equal(result[1].suggestedType, "receita");
});

test("parses Brazilian CSV with semicolon and decimal comma", () => {
  const csv = "Data;Descrição;Valor\n25/11/2026;Mercado;-125,90\n26/11/2026;Salário;2.500,00";
  const result = parseBankStatement("extrato.csv", csv);
  assert.equal(result.length, 2);
  assert.equal(result[0].amount, 125.9);
  assert.equal(result[0].suggestedType, "despesa");
  assert.equal(result[1].amount, 2500);
  assert.equal(result[1].suggestedType, "receita");
});

test("creates stable fingerprints for repeated statement entries", () => {
  const csv = "date,description,amount\n2026-11-25,Store,-10.00";
  const first = parseBankStatement("file.csv", csv)[0];
  const second = parseBankStatement("file.csv", csv)[0];
  assert.equal(first.fingerprint, second.fingerprint);
});
