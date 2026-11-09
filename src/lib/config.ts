/**
 * Configuração tipada a partir das variáveis de ambiente (componente C13).
 *
 * Todas as variáveis são opcionais em desenvolvimento. Documentação completa de cada uma em
 * `.env.example` e docs/DEPLOY_VERCEL.md. Use as funções (e não `process.env` direto) para que
 * os testes possam alterar o ambiente entre um caso e outro.
 */

/** Lê uma variável de ambiente, tratando string vazia como ausente. */
function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : undefined;
}

export interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
}

/** Credenciais do WhatsApp Cloud API, ou `undefined` se não configurado. */
export function whatsappConfig(): WhatsAppConfig | undefined {
  const accessToken = env("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = env("WHATSAPP_PHONE_NUMBER_ID");
  if (!accessToken || !phoneNumberId) return undefined;
  return { accessToken, phoneNumberId, apiVersion: env("WHATSAPP_API_VERSION") ?? "v23.0" };
}

/** Token que a Meta envia no handshake do webhook (hub.verify_token). */
export const whatsappVerifyToken = (): string | undefined => env("WHATSAPP_VERIFY_TOKEN");

/** App Secret usado para validar a assinatura X-Hub-Signature-256. */
export const whatsappAppSecret = (): string | undefined => env("WHATSAPP_APP_SECRET");

export interface RedisConfig {
  url: string;
  token: string;
}

/**
 * Credenciais do Upstash Redis. Aceita os nomes criados pela integração da Vercel (KV_REST_API_*)
 * ou os nomes padrão do Upstash (UPSTASH_REDIS_REST_*).
 */
export function redisConfig(): RedisConfig | undefined {
  const url = env("KV_REST_API_URL") ?? env("UPSTASH_REDIS_REST_URL");
  const token = env("KV_REST_API_TOKEN") ?? env("UPSTASH_REDIS_REST_TOKEN");
  return url && token ? { url, token } : undefined;
}

/** Token do painel do hospital. `undefined` = painel aberto (apenas desenvolvimento). */
export const dashboardToken = (): string | undefined => env("DASHBOARD_TOKEN");

/** WhatsApp que recebe cópia de todos os chamados (demonstração). */
export const hospitalNotifyWhatsApp = (): string | undefined => env("HOSPITAL_NOTIFY_WHATSAPP");

/** URL que recebe um POST JSON com cada chamado novo. */
export const hospitalWebhookUrl = (): string | undefined => env("HOSPITAL_WEBHOOK_URL");

/** Simulador web ligado? (padrão: sim) */
export const simulatorEnabled = (): boolean => env("ENABLE_SIMULATOR") !== "false";
