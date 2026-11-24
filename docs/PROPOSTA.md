# Proposta — EmergêncIA (FMU Tech Inovação 2026.2)

Texto da proposta enviada à comissão do FMU Tech Inovação, com pequenas correções de
digitação. Os detalhes técnicos estão em [development_plan.md](../development_plan.md) e o
roteiro da apresentação em [APRESENTACAO.md](APRESENTACAO.md).

## Título

EmergêncIA

## Problema

Aplicativo web mobile pensado para auxiliar nos primeiros socorros em casos de acidentes
caseiros e de trânsito, por exemplo, além de acionar automaticamente a emergência do hospital
mais próximo, já passando a localização exata do chamado.

O seu foco principal é o aplicativo já poder passar orientações para o usuário do que ele deve
fazer com a pessoa acidentada até a chegada dos médicos.

## Público/Contexto

Pessoas que não tenham conhecimento em primeiros socorros e em situações de emergência que
necessitam de ações e tomadas de decisões rápidas.

## Bases de dados públicas utilizadas

- **CNES — Cadastro Nacional de Estabelecimentos de Saúde** (Ministério da Saúde/DATASUS)
- **SIM — Sistema de Informações sobre Mortalidade** (DATASUS)
- **SIH/SUS — Sistema de Informações Hospitalares** (DATASUS)
- **RENAEST** (Senatran/Ministério dos Transportes) e **Dados Abertos da PRF**
- **Protocolos de Suporte Básico de Vida do SAMU 192** (Ministério da Saúde)
- **OpenStreetMap** (dados abertos, licença ODbL)

| Base | Uso no projeto | Situação no protótipo |
|------|----------------|-----------------------|
| CNES | Localizar os hospitais com pronto-socorro mais próximos da vítima | Lista de demonstração com 10 hospitais de SP (`src/data/hospitals.ts`); importação do CNES prevista (tarefa F7.3) |
| SIM e SIH/SUS | Dimensionar o problema (óbitos e internações por causas externas) e priorizar os tipos de acidente | Usadas na justificativa (slides 2 e 3) |
| RENAEST e PRF | Dados de acidentes de trânsito | Usadas na justificativa (slides 2 e 3) |
| Protocolos do SAMU 192 | Base das orientações de primeiros socorros | Usados em `src/lib/triage/protocols.ts` |
| OpenStreetMap | Mapa com a localização da vítima | Usado no painel do hospital |

## Proposta de solução

Criar uma aplicação web mobile que interaja com o WhatsApp, a fim de auxiliar nos primeiros
socorros em pessoas que acabaram de passar por algum acidente (caseiro, trânsito etc.). Essa
aplicação é capaz de orientar o usuário nos passos para estancar sangramentos, manobras de
desengasgo, preparação do ambiente ao redor etc.

Além disso, a aplicação também é capaz de verificar a gravidade do acidente e, em casos mais
graves, aciona sozinha a emergência do hospital mais próximo, já compartilhando a localização e
uma descrição do quadro do paciente para que os paramédicos possam se preparar para o cenário
enquanto ainda estão a caminho. Futuramente, a ideia é fazer uma integração diretamente com o
SAMU.
