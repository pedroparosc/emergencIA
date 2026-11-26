/**
 * Política de privacidade (LGPD). Também é a URL exigida pela Meta para publicar o app do
 * WhatsApp. Mantenha alinhada ao que o código de fato coleta e aos prazos de `src/lib/store`.
 */
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Quais dados o emergencIA usa, por quanto tempo e como pedir a exclusão.",
};

const UPDATED_AT = "26 de novembro de 2026";
const CONTACT_URL = "https://github.com/pedroparosc/emergencIA/issues";

export default function Privacidade() {
  return (
    <main className="container prose">
      <h1>Política de privacidade</h1>
      <p className="muted">Última atualização: {UPDATED_AT}</p>

      <p>
        O emergencIA é um projeto acadêmico (FMU Tech Inovação 2026.2) que orienta primeiros socorros
        pelo WhatsApp e pelo simulador web e, nos casos graves, abre um chamado no hospital mais
        próximo. Esta página explica quais dados usamos, para quê e por quanto tempo, conforme a Lei
        Geral de Proteção de Dados (Lei nº 13.709/2018).
      </p>

      <h2>Dados que usamos</h2>
      <ul>
        <li>
          <strong>Número do WhatsApp</strong> de quem conversa com o bot, para responder e para o
          hospital poder retornar o contato.
        </li>
        <li>
          <strong>Mensagens e respostas da triagem</strong> (o que aconteceu, respostas de sim/não),
          para avaliar a gravidade e escolher as orientações.
        </li>
        <li>
          <strong>Localização ou endereço</strong>, somente quando você envia, para encontrar o
          hospital mais próximo e abrir o chamado.
        </li>
      </ul>
      <p>
        Não pedimos nome, CPF, documentos nem dados de saúde além do relato do acidente. Não usamos os
        dados para publicidade e não os vendemos.
      </p>

      <h2>Com quem compartilhamos</h2>
      <ul>
        <li>
          <strong>Hospital escolhido:</strong> recebe o chamado com gravidade, tipo de acidente,
          localização e o número do WhatsApp, apenas nos casos em que um chamado é aberto. Você
          autoriza isso ao enviar a localização.
        </li>
        <li>
          <strong>Meta (WhatsApp Cloud API):</strong> transporta as mensagens entre você e o bot.
        </li>
        <li>
          <strong>Serviço de IA (OpenRouter):</strong> quando um relato escrito livremente não é
          reconhecido pelas regras, o texto da mensagem pode ser enviado a um modelo de IA para
          classificação. Enviamos só o texto, sem número de telefone e sem localização.
        </li>
        <li>
          <strong>Infraestrutura:</strong> Vercel (hospedagem) e Upstash (banco de dados), que
          processam os dados em nosso nome.
        </li>
      </ul>

      <h2>Por quanto tempo guardamos</h2>
      <ul>
        <li>Conversa em andamento (sessão): apagada automaticamente em 24 horas.</li>
        <li>Chamados enviados ao hospital: apagados automaticamente em 30 dias.</li>
        <li>Registros técnicos de mensagens já processadas: 24 horas.</li>
      </ul>

      <h2>Seus direitos</h2>
      <p>
        Você pode pedir acesso, correção ou exclusão dos seus dados antes desses prazos. Abra um pedido
        em <a href={CONTACT_URL}>{CONTACT_URL.replace("https://", "")}</a> informando o horário
        aproximado da conversa; não publique seu número no pedido, nós entraremos em contato. Para
        parar de usar o serviço, basta não enviar novas mensagens: os dados expiram sozinhos.
      </p>

      <h2>Segurança</h2>
      <p>
        As mensagens do WhatsApp chegam com assinatura verificada, o painel do hospital é protegido por
        senha e o acesso aos dados é restrito à equipe do projeto.
      </p>

      <h2>Emergências</h2>
      <p>
        O emergencIA não substitui o atendimento médico. Em caso de risco de vida, ligue{" "}
        <a href="tel:192">192 (SAMU)</a> ou <a href="tel:193">193 (Bombeiros)</a>.
      </p>

      <p>
        <Link href="/">← Voltar ao início</Link>
      </p>
    </main>
  );
}
