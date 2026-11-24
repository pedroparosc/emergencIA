// Grava o vídeo de demonstração do emergencIA: simulador do WhatsApp ("celular", à esquerda) e
// painel do hospital (à direita), com legendas de cada etapa do fluxo principal.
//
// Pré-requisitos: Playwright com Chromium (npm i -D playwright && npx playwright install chromium),
// ffmpeg, e o app rodando em http://localhost:3100 SEM DASHBOARD_TOKEN e com o banco vazio:
//   npm run build && npx next start -p 3100
// Gravar:   node scripts/record-demo.js /pasta/de/saida
// Converter: ffmpeg -i /pasta/de/saida/*.webm -c:v libx264 -crf 20 -pix_fmt yuv420p -an docs/demo/emergencia-demo.mp4
//
// O mapa do painel precisa de acesso a www.openstreetmap.org e tile.openstreetmap.org.
const { chromium } = require('playwright');

const BASE = 'http://localhost:3100';
const W = 1600, H = 900;
const outDir = process.argv[2];

const STAGE = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
  *{box-sizing:border-box} body{margin:0;width:${W}px;height:${H}px;overflow:hidden;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
    background:linear-gradient(135deg,#1b1f2a,#2a1218);color:#fff}
  #cap{height:96px;display:flex;align-items:center;gap:16px;padding:0 28px}
  #cap .step{background:#c8102e;border-radius:999px;padding:6px 14px;font-weight:800;font-size:18px;white-space:nowrap}
  #cap .txt{font-size:26px;font-weight:600;line-height:1.25}
  #row{display:flex;gap:24px;padding:0 24px}
  .lbl{font-size:14px;opacity:.75;margin:0 0 6px 4px;letter-spacing:.04em;text-transform:uppercase}
  #phone{width:390px;height:760px;border:0;border-radius:28px;background:#fff;box-shadow:0 0 0 10px #0b0d12,0 20px 50px rgba(0,0,0,.5)}
  #dash{width:1138px;height:760px;border:0;border-radius:14px;background:#fff;box-shadow:0 20px 50px rgba(0,0,0,.5)}
  #card{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;
    background:linear-gradient(135deg,#c8102e,#7a0a1c);transition:opacity .6s;z-index:10}
  #card h1{font-size:64px;margin:0 0 12px} #card p{font-size:26px;margin:6px 0;opacity:.95;max-width:1100px}
  .ring{position:fixed;width:46px;height:46px;margin:-23px 0 0 -23px;border:4px solid #ffcc00;border-radius:50%;
    pointer-events:none;z-index:20;animation:ring .7s ease-out forwards}
  @keyframes ring{from{transform:scale(.4);opacity:1}to{transform:scale(1.4);opacity:0}}
</style></head><body>
  <div id="cap"><span class="step" id="step">emergencIA</span><span class="txt" id="txt"></span></div>
  <div id="row">
    <div><p class="lbl">📱 Usuário — WhatsApp (simulador)</p><iframe id="phone" allow="geolocation"></iframe></div>
    <div><p class="lbl">🏥 Hospital — painel de chamados</p><iframe id="dash"></iframe></div>
  </div>
  <div id="card"></div>
</body></html>`;

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir: outDir, size: { width: W, height: H } },
    geolocation: { latitude: -23.5614, longitude: -46.6559 }, // Av. Paulista, São Paulo
    permissions: ['geolocation'],
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  });
  const page = await context.newPage();
  const t0 = Date.now();
  const log = (m) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s ${m}`);
  const wait = (ms) => page.waitForTimeout(ms);

  await page.setContent(STAGE);
  const phone = page.frameLocator('#phone');
  const dash = page.frameLocator('#dash');

  const card = (html) => page.evaluate((h) => { const c = document.getElementById('card'); c.innerHTML = h; c.style.opacity = '1'; c.style.display = 'flex'; }, html);
  const hideCard = async () => { await page.evaluate(() => { document.getElementById('card').style.opacity = '0'; }); await wait(700); await page.evaluate(() => { document.getElementById('card').style.display = 'none'; }); };
  const caption = (step, text) => page.evaluate(([s, t]) => { document.getElementById('step').textContent = s; document.getElementById('txt').textContent = t; }, [step, text]);
  /** Clica mostrando um anel amarelo no ponto do clique (o vídeo headless não mostra o cursor). */
  const click = async (locator) => {
    await locator.waitFor({ state: 'visible' });
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    if (box) {
      await page.evaluate(([x, y]) => { const r = document.createElement('div'); r.className = 'ring'; r.style.left = x + 'px'; r.style.top = y + 'px'; document.body.appendChild(r); setTimeout(() => r.remove(), 800); }, [box.x + box.width / 2, box.y + box.height / 2]);
    }
    await wait(450);
    await locator.click();
  };
  const scrollChat = (to) => phone.locator('.sim-log').evaluate((el, pos) => el.scrollTo({ top: pos === 'end' ? el.scrollHeight : pos, behavior: 'smooth' }), to);
  const botIdle = () => phone.locator('.typing').waitFor({ state: 'detached' });

  // ---------------- Abertura ----------------
  await card('<h1>🚑 emergencIA</h1><p>Primeiros socorros no WhatsApp com acionamento automático do hospital mais próximo</p><p style="opacity:.8;font-size:22px">Demonstração do protótipo · FMU Tech Inovação 2026.2</p>');
  await page.evaluate((b) => { document.getElementById('phone').src = b + '/'; document.getElementById('dash').src = b + '/hospital'; }, BASE);
  await wait(5500);
  await hideCard();
  log('abertura');

  // ---------------- Página inicial ----------------
  await caption('Web mobile', 'Página do serviço no celular: acesso ao WhatsApp, ao simulador e ao 192');
  await wait(3500);
  await phone.locator('body').evaluate(() => window.scrollTo({ top: 520, behavior: 'smooth' }));
  await wait(3000);
  await phone.locator('body').evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await wait(1500);
  await click(phone.getByRole('link', { name: /Testar no simulador/ }));
  await phone.locator('#sim-text').waitFor();
  await wait(1500);
  log('home');

  // ---------------- Caso grave ----------------
  await caption('1 · Relato', 'O usuário descreve o acidente com as próprias palavras');
  await wait(1500);
  await click(phone.locator('#sim-text'));
  await phone.locator('#sim-text').pressSequentially('Meu pai caiu da escada e não acorda', { delay: 70 });
  await wait(800);
  await click(phone.getByRole('button', { name: 'Enviar' }));
  await botIdle();
  log('relato enviado');

  await caption('2 · Triagem', 'Queda + vítima desacordada → gravidade CRÍTICA, sem perder tempo com perguntas');
  await wait(300);
  await scrollChat(0);
  await wait(5000);
  await caption('3 · Orientação', 'Instruções imediatas: checar a respiração, posição lateral ou massagem cardíaca (RCP)');
  await phone.locator('.sim-log').evaluate((el) => el.scrollTo({ top: el.scrollHeight * 0.38, behavior: 'smooth' }));
  await wait(8500);
  await caption('4 · Localização', 'O bot pede a localização, com consentimento para compartilhar com o hospital');
  await scrollChat('end');
  await wait(5000);
  await click(phone.getByRole('button', { name: '📍 Enviar localização' }));
  await phone.getByText(/Chamado aberto/).waitFor();
  await botIdle();
  log('chamado aberto');

  await caption('5 · Chamado aberto', 'O hospital mais próximo é acionado e o usuário recebe o protocolo');
  // Mostra a confirmação do chamado (primeira resposta depois da localização).
  await phone.locator('.sim-log').evaluate((el) => {
    const b = [...el.querySelectorAll('.bubble.bot')].find((x) => x.textContent.includes('Chamado aberto'));
    if (b) el.scrollTo({ top: el.scrollTop + b.getBoundingClientRect().top - el.getBoundingClientRect().top - 8, behavior: 'smooth' });
  });
  await wait(7500);

  // ---------------- Painel do hospital ----------------
  await caption('6 · Hospital', 'O chamado chega ao painel em tempo real: gravidade, motivo, mapa, rota e contato');
  await dash.locator('.alert-item').first().waitFor({ timeout: 15000 });
  await wait(1500);
  await dash.locator('iframe.map').waitFor();
  await wait(9000);
  log('painel');

  await caption('7 · Resposta', 'O hospital confirma o envio da equipe…');
  await wait(1500);
  await click(dash.getByRole('button', { name: /Equipe a caminho/ }));
  await caption('7 · Resposta', '…e a família é avisada na hora pelo WhatsApp');
  await phone.getByText('Equipe a caminho!').waitFor({ timeout: 15000 });
  await scrollChat('end');
  await wait(9000);
  log('status');

  // ---------------- Caso leve ----------------
  await caption('Caso leve', 'Nem todo caso vira chamado: aqui a triagem faz perguntas rápidas de sim/não');
  await click(phone.getByRole('button', { name: 'Reiniciar' }));
  await wait(1200);
  await click(phone.locator('#sim-text'));
  await phone.locator('#sim-text').pressSequentially('Cortei o dedo com uma faca', { delay: 70 });
  await click(phone.getByRole('button', { name: 'Enviar' }));
  await botIdle();
  await wait(2500);
  for (const answer of ['✅ Sim', '❌ Não', '❌ Não', '❌ Não']) {
    await click(phone.locator('.bubble-actions button:not([disabled])', { hasText: answer }).last());
    await botIdle();
    await wait(2700);
  }
  await caption('Caso leve', 'Gravidade BAIXA: cuidados em casa e sinais de alerta. Se piorar, um toque aciona o hospital');
  await phone.locator('.sim-log').evaluate((el) => {
    const b = [...el.querySelectorAll('.bubble.bot')].find((x) => x.textContent.includes('Gravidade'));
    if (b) el.scrollTo({ top: el.scrollTop + b.getBoundingClientRect().top - el.getBoundingClientRect().top - 8, behavior: 'smooth' });
  });
  await wait(7000);
  await scrollChat('end');
  await wait(6000);
  log('caso leve');

  // ---------------- Encerramento ----------------
  await card('<h1>🚑 emergencIA</h1><p>Orienta · Avalia a gravidade · Aciona o hospital mais próximo com a localização</p><p style="font-size:22px;opacity:.85">github.com/pedroparosc/emergencIA</p><p style="font-size:20px;opacity:.85;margin-top:28px">⚠️ Protótipo acadêmico. Em emergência, ligue 192 (SAMU) ou 193 (Bombeiros).</p>');
  await wait(6000);
  log('fim');

  await context.close();
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
