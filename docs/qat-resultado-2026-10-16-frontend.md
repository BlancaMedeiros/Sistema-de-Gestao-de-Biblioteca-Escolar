# QAT — perfil e compatibilidade com as telas — 16/10/2026

**Aprovado tecnicamente para integração local.** Código validado: `5ddd31a6729d8744339f9c61fa13141f2be8a759`, branch `feature/livros`. Os testes foram executados no conteúdo desse commit; as alterações seguintes registram documentação/evidências. O [PR 13](https://github.com/BlancaMedeiros/Sistema-de-Gestao-de-Biblioteca-Escolar/pull/13) continua em rascunho para `feat/backend-foundation`, sem merge ou deploy.

Esta rodada amplia o [QAT anterior de 214 testes](qat-resultado-2026-10-16.md). O contrato atual está no [documento de aderência às telas](specs/2026-10-16-aderencia-frontend.md), e a reprodução está no [guia para Bianca](entrega-backend-bianca.md). O [índice do workspace](../../relatorios/00-leia-primeiro.markdown) preserva os relatórios históricos.

## Resultados e evidências

| Verificação | Resultado | Evidência |
| --- | --- | --- |
| Regressão completa, MySQL 8.4.11 local | **236/236 testes, 24 arquivos**, sem falhas ou ignorados | [Vitest MySQL](evidencias/qat-2026-10-16-frontend/vitest-mysql.json) |
| Regressão completa, TiDB 8.5.3 local descartável | **236/236 testes, 24 arquivos**, sem falhas ou ignorados | [Vitest TiDB](evidencias/qat-2026-10-16-frontend/vitest-tidb.json) |
| HTTP real no MySQL | **36 casos, 129 requisições**, 23 operações, reinício real | [HTTP MySQL](evidencias/qat-2026-10-16-frontend/http-mysql.json) |
| HTTP real no TiDB | **36 casos, 129 requisições**, mesma cobertura e reinício | [HTTP TiDB](evidencias/qat-2026-10-16-frontend/http-tidb.json) |
| Upgrade local e reexecução das migrations | Histórico 0001–0009; nenhuma pendência na segunda execução | [MySQL](evidencias/qat-2026-10-16-frontend/migrations-mysql.json), [TiDB](evidencias/qat-2026-10-16-frontend/migrations-tidb.json) |
| Instalação do zero, MySQL e TiDB | Nove migrations finais aplicadas em bancos exclusivos; segunda execução vazia; bancos removidos | [MySQL vazio](evidencias/qat-2026-10-16-frontend/migrations-fresh-mysql.json), [TiDB vazio](evidencias/qat-2026-10-16-frontend/migrations-fresh-tidb.json) |
| Backend TypeScript e frontend Angular | Ambos os builds aprovados; nenhum arquivo do frontend foi alterado | `npm.cmd run build --prefix backend` e `--prefix frontend` |
| OpenAPI | Referências resolvidas; campos novos e segurança de `/me`/senha/logout conferidos | `dashboard.routes.test.ts` |
| Workflow | actionlint 1.7.12 aprovado, sem ShellCheck/Pyflakes | `.github/workflows/deploy-firebase.yml`; resultado remoto da versão atual no PR |

O aumento de 214 para 236 corresponde a **19 testes de perfil e três de localização**. Os testes de contrato e as asserções existentes também foram ampliados. A execução HTTP usa processo próprio compilado em `127.0.0.1:3007`, cliente independente de Supertest, banco real, cookies e reinício do processo. Os relatórios não contêm senhas/cookies; registram método, caminho, status, códigos, IDs e paginação. As fixtures de cada rodada foram removidas; os dados anteriores foram preservados.

O TiDB foi executado localmente em container descartável, com CHECK habilitado apenas nele. A versão testada não é uma comprovação das configurações ou dados do TiDB Cloud. Nenhuma migration foi aplicada em produção nesta rodada.

## Compatibilidade comprovada

| Caso | Resultado e comprovação |
| --- | --- |
| COMPAT-01 — Meu Perfil | AP: dez campos em login/perfil/criação; contatos editáveis sem nome, aparados e persistidos; null/vazio apaga; validações e campos calculados protegidos. HTTP e `perfil-funcionario.test.ts` |
| COMPAT-02 — associação com leitor | AP: associação explícita/exclusiva, matrícula correta, contatos independentes, leitor inexistente 404, disputa 409 sem gravação parcial. Suíte cobre também cadastro com vínculo e leitor inativo |
| COMPAT-03 — indicadores pessoais | AP: contam empréstimos do leitor associado, incluem atrasados entre abertos e devolvidos no histórico; não contam leitores apenas atendidos pelo operador. Devolução atualiza ativos; reinício preserva contatos/vínculo; desvincular mantém histórico |
| COMPAT-04 — localização | AP: detalhe, criação, renovação, devolução, listas, histórico, dashboard e pendências usam o mesmo DTO. Livro inativo preserva localização. Suíte verifica partes ausentes, alteração do cadastro atual e resposta idempotente original |
| Concorrência do perfil | AP: dois contatos em paralelo preservados; duas contas disputando leitor deixam apenas um vínculo; vínculo e empréstimo simultâneos concluem sem deadlock. Suíte nos dois bancos |

As **23 operações API-01–23** foram repetidas e aprovadas por HTTP nos dois bancos. As regras REG-01–14 do [checklist](qat-aceite-backend.md) permanecem cobertas pela regressão completa e pelo QAT HTTP; a [matriz da rodada anterior](qat-resultado-2026-10-16.md#cobertura-das-regras) relaciona as descrições dos testes que continuam presentes. Foram preservados: limite de três abertos, duas renovações, sete dias, bloqueio por atraso, inativação com aberto recusada, saldo e idempotência transacionais.

## Problemas encontrados e resolvidos nesta revisão

| Problema | Correção e reteste |
| --- | --- |
| Perfil tinha apenas ID/nome/login, sem os contatos e indicadores da tela | Colunas de contatos, associação opcional e consulta única do perfil. Login, `/me`, PATCH e criação retornam os mesmos campos, sem senha/hash |
| IDs de conta e leitor poderiam ser confundidos na integração | Vínculo explícito `usuarioId`, sem associação por igualdade dos IDs; sem vínculo, matrícula nula e indicadores zero |
| Histórico dependia de buscar localização em acervo que omite livros inativos | Localização e nomes de exibição incluídos no próprio DTO do empréstimo e nos consumidores |
| Vincular perfil durante empréstimo concorrente produziu deadlock MySQL | O PATCH bloqueia o funcionário antes do leitor, respeitando o lock implícito da FK de idempotência. Caso reproduzido, corrigido e aprovado nas suítes dos dois bancos |
| TiDB recusou a FK adicionada junto da criação da coluna no mesmo ALTER | DDL novo separado em 0008/0009 antes da publicação. Protótipo local ajustado preservando valores; instalação final do zero e upgrade aprovados nos dois bancos. Migrations publicadas 0001–0007 intactas |

Não foi identificado defeito crítico/alto aberto no escopo verificado das APIs locais. A revisão de código/DDL/contrato foi feita pelo próprio agente; revisão independente do PR e aceite da integração permanecem etapas seguintes.

## Reprodução e limites do aceite

Com `.env` local configurado, Docker Desktop e dependências instaladas:

```powershell
npm.cmd run dev:migrate
npm.cmd test --prefix backend
npm.cmd run qat:http --prefix backend
npm.cmd run build --prefix frontend
```

O QAT HTTP exige desenvolvimento, `DB_HOST=127.0.0.1` e ausência de socket externo. Não use banco de produção. `QAT_PORT` e `QAT_OUTPUT` podem definir porta e saída; padrão de evidência em `tmp/qat-http.json`. O CI do PR cria MySQL vazio, aplica as migrations e executa regressão/QAT HTTP/builds. Consulte os checks do PR no commit mais recente; o job de publicação não executa em eventos de PR.

Esta revisão não executou novo fluxo visual no Swagger; a [prova visual anterior](qat-resultado-2026-10-16.md#conferência-pelo-navegador) permanece histórica. Os campos e fluxos novos foram comprovados pelo cliente HTTP real e pelos testes. Não se declara execução manual humana de todas as operações.

O frontend continua com mocks nas áreas novas. Bianca ainda precisa integrar serviços HTTP, sessão após F5/logout/guards, paginação, opcionais nulos, dados calculados pelo servidor, idempotência e tratamento de erros. Meu Perfil precisa incluir senha atual na troca de senha; o rótulo `Total de Leituras` deve refletir a contagem de empréstimos. Os testes Angular já falhos não foram corrigidos nem declarados aprovados; foi verificado apenas o build do frontend.

Continuam fora deste aceite: publicação, homologação na URL pública, CSRF completo e limite de tentativas de login. O [guia de integração](entrega-backend-bianca.md) registra os passos para receber a versão. Nenhuma mensagem foi enviada à Bianca.
