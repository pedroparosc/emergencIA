/**
 * Validação da assinatura do webhook (componente C10).
 *
 * A Meta assina cada POST com HMAC-SHA256 do corpo BRUTO usando o App Secret e envia o resultado
 * no cabeçalho `X-Hub-Signature-256: sha256=<hex>`. Validar impede que terceiros enviem
 * mensagens falsas ao nosso webhook (e, por exemplo, abram chamados falsos em hospitais).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export function computeSignature(rawBody: string, appSecret: string): string {
  return `sha256=${createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`;
}

/** Compara em tempo constante para não vazar informação por tempo de resposta. */
export function isValidSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header) return false;
  const expected = Buffer.from(computeSignature(rawBody, appSecret));
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
