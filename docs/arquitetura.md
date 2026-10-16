# Arquitetura técnica

**Estado em 15/10/2026:** todas as operações do mapa de endpoints estão implementadas e testadas localmente: autenticação/perfil, funcionários, livros, leitores, empréstimos/renovações/devoluções, dashboard e pendências. As novas APIs ainda não foram publicadas nem integradas às telas. Consulte o [contrato completo](specs/2026-10-15-apis-restantes-design.md), o [QAT](qat-e-proximos-passos.md) e o [índice histórico do workspace](../../relatorios/00-leia-primeiro.markdown).

**Revisão de 16/10:** [perfil completo e localização nos empréstimos](specs/2026-10-16-aderencia-frontend.md), com [QAT atualizado](qat-resultado-2026-10-16-frontend.md). Contas podem ter um vínculo explícito e exclusivo com leitor, sem mudar o nível de acesso.

## Decisões confirmadas

- Monorepo com Angular em `frontend/`, Express + TypeScript em `backend/` e scripts SQL em `database/`.
- MySQL é iniciado pelo Docker Compose e mantém os dados no volume nomeado `mysql_data`.
- Angular e Express executam em containers próprios durante o desenvolvimento, com o código do Git montado para hot reload.
- Na base remota integrada em 15/10, `frontend/proxy.conf.json` encaminha `/api` ao site publicado. Para testar esta API local sem alterar o trabalho do frontend, use diretamente `http://127.0.0.1:3000/api/docs`; o frontend local não testa automaticamente o backend local nessa configuração.
- A disponibilidade de um livro será controlada por quantidade: não haverá identificação individual de exemplares nesta primeira versão.
- Empréstimos: sete dias corridos, até três abertos por leitor e duas renovações de mais sete dias sobre o prazo anterior. Qualquer atraso bloqueia novos empréstimos/renovações. Livro/leitor com empréstimo aberto não pode ser inativado. Regras confirmadas pelo usuário nesta sessão e cobertas por testes.
- O login Angular chama a autenticação real. A proteção de navegação e a integração completa de sessão/logout/perfil ainda precisam ser verificadas e concluídas no frontend.

## Serviços locais

```text
Swagger ou cliente HTTP -> backend:3000 -> mysql:3306
```

`npm run dev` executa `docker compose up --build` e apresenta os logs dos serviços em um terminal.

| Serviço | Papel | Persistência |
| --- | --- | --- |
| `frontend` | Angular em modo desenvolvimento, com hot reload | Código vem do Git por bind mount |
| `migrate` | Aplica as migrations pendentes, cria as contas de desenvolvimento (seed) e sai; `backend` espera ele terminar com sucesso | Não persiste nada; só executa contra o `mysql` |
| `backend` | API Express em modo desenvolvimento, com hot reload | Código vem do Git por bind mount |
| `mysql` | Banco local MySQL 8.4; mantém o modo ANSI do antigo Aiven. Produção atual usa TiDB | Dados no volume `mysql_data` |
| `adminer` | Interface web para inspecionar o MySQL manualmente (`http://localhost:8080`) | Não persiste nada; só front-end para o `mysql` |

`migrate` aparece como `Exited (0)` em `docker compose ps` depois de rodar — é o estado esperado de um serviço que faz seu trabalho uma vez e termina, não uma falha.

Os volumes `frontend_node_modules` e `backend_node_modules` mantêm dependências Linux separadas das dependências instaladas no Windows do computador.

`adminer` é ferramenta de desenvolvimento — não faz parte da aplicação, não é implantada em produção.

## Verificação inicial

- `GET /health`: confirma que o processo Express está em execução. Não consulta o banco.
- `GET /ready`: consulta o MySQL com `SELECT 1`. Retorna `200` somente quando a API e o banco estiverem conectados; caso contrário, retorna `503` sem expor credenciais.

Esses endpoints não validam migrations, autenticação ou regras da biblioteca. Eles apenas comprovam a fundação da stack.

## Migrations

`database/migrations/*.sql` guarda um comando DDL por arquivo, numerado (`0001_...`, `0002_...`). `backend/src/db/migrate.ts` lê os arquivos, confere o que já foi aplicado na tabela `schema_migrations` (criada automaticamente) e executa só os pendentes, na ordem. Cada arquivo deve ter um único comando DDL — o pool não habilita `multipleStatements`, para não abrir essa porta nas consultas parametrizadas do resto da aplicação.

### Automático, via `docker compose`

O serviço `migrate` do `compose.yaml` roda `npm run migrate` e, em seguida, `npm run seed:funcionarios` (contas de desenvolvimento, ver [Autenticação](#autenticação-primeira-fatia-implementada)) contra o MySQL do próprio Compose e sai; `backend` declara `depends_on: migrate: condition: service_completed_successfully`, ou seja, só inicia depois que as migrations pendentes forem aplicadas e as contas de teste existirem. Isso vale tanto para `npm run dev` quanto para `docker compose up` chamado direto.

O `migrate` depende do healthcheck do `mysql`, que faz o ping **via TCP** (`--protocol=TCP -h 127.0.0.1`). Na primeira subida, com o volume `mysql_data` vazio, o entrypoint da imagem roda um servidor temporário sem rede (`port: 0`) para criar banco e usuário; um ping via socket já responderia nessa fase e o `migrate` falharia com `ECONNREFUSED` ao tentar conectar por TCP. Esse erro foi reproduzido numa subida do zero em 06/10/2026 com o ping via socket, e não ocorreu na subida seguinte do zero com o ping via TCP.

Ele usa a mesma imagem de desenvolvimento do `backend` (`image: biblioteca-escolar-backend-dev`, compartilhada entre os dois serviços para não buildar duas vezes), com o bind mount extra `./database:/database:ro` — único lugar onde a pasta `database/` é montada dentro de um container. A resolução de caminho em `backend/src/config/local-env.ts` (três níveis acima do próprio arquivo) cai exatamente em `/database/migrations` dentro do container, sem precisar de configuração especial para o caso containerizado.

Reexecutar é seguro: a lógica é idempotente, então rodar de novo com tudo já aplicado só confirma "nenhuma migration pendente" e sai. Testado com uma migration real pendente (criada e depois removida como verificação) — o `migrate` aplicou e o `backend` esperou corretamente antes de subir.

### Manual, fora do Compose

Para rodar sem subir a stack inteira (ex.: só com `mysql` de pé), ou para depurar fora de um container:

```powershell
npm run dev:migrate
```

Roda no host, contra a porta do MySQL publicada pelo Compose, usando `backend/src/config/local-env.ts` para mapear as variáveis `MYSQL_*` do `.env` para o que o backend espera.

### Produção

Produção usa TiDB, com migrations bloqueantes no workflow antes da publicação do Cloud Run/Hosting. O comando `prod:migrate` permanece como legado do Aiven e não é o caminho atual do deploy. Consulte [o guia de deploy](deploy-firebase-cloud-run.md) e [a validação de 13/10](validacao-cicd-tidb.md) para os detalhes. A migration de livros foi aplicada apenas nos bancos locais nesta entrega.

### Regras para SQL novo

Use strings entre aspas **simples**, consultas parametrizadas e chave primária em cada tabela. O MySQL local mantém o modo ANSI usado no antigo Aiven; produção agora usa TiDB, e SQL novo precisa ser validado também nele. Um único comando DDL por arquivo de migration. Para `CHECK` no TiDB, confirme `tidb_enable_check_constraint` antes da publicação; os testes de livros usaram `ON` em TiDB local.

## Autenticação (primeira fatia implementada)

- `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/me`, `PATCH /api/v1/me` (nome, contatos e vínculo explícito com leitor) e `PUT /api/v1/me/senha`, cobertos por testes de integração (`backend/src/modules/auth/*.test.ts`) contra MySQL/TiDB locais. O perfil inclui matrícula e contadores do leitor vinculado; sem vínculo, matrícula nula e contadores zero. Não existe correspondência automática por IDs. As migrations 0008/0009 acrescentam os campos e a unicidade/FK sem preencher dados fictícios.
- Trocar a senha (`PUT /me/senha`) invalida as demais sessões do funcionário (`destroyOtherSessions`, em `session-store.ts`) — a sessão atual continua válida, para não forçar um novo login imediato após uma troca legítima.
- Um único papel — "funcionário autorizado" — sem distinção ADMIN/OPERADOR por enquanto, para reduzir escopo desta fatia. Tabela `funcionarios` (login único, hash Argon2id da senha).
- `POST /api/v1/funcionarios` agora permite ao funcionário autenticado e ativo cadastrar outro com o mesmo acesso. O middleware também verifica a atividade da conta antes de aceitar uma sessão existente. Cadastro de leitores permanece separado e não cria conta.
- Sessão persistida na tabela `sessoes`, via `backend/src/config/session-store.ts`: uma implementação própria de `express-session.Store` sobre o MySQL, no lugar do `MemoryStore` padrão (que perde as sessões a cada reinício do processo e não escala para múltiplas instâncias). Cookie `__session`, `HttpOnly`, `SameSite=Lax`, `Secure` em produção; a sessão é regenerada no login.
- **Por que `__session` e `trust proxy`:** o Firebase Hosting descarta das requisições repassadas ao Cloud Run qualquer cookie com outro nome. E o HTTPS termina no proxy do Google, então o Express recebe HTTP com `X-Forwarded-Proto: https`; sem `app.set('trust proxy', 1)` ele trata a conexão como insegura e o `express-session` deixa de enviar o cookie `Secure` (grava a sessão no banco, mas o navegador nunca recebe o cookie). `sessao-producao.test.ts` reproduz esse cenário.
- Contas de desenvolvimento criadas automaticamente pelo serviço `migrate` a cada `npm run dev` (ou manualmente por `npm run dev:seed:funcionarios`, que roda no host) (`backend/src/db/seed-funcionarios.ts` + `run-seed-funcionarios-cli.ts`), com login e senha conhecidos e fixos no código — deliberado, só para uso local/demo. Idempotente por login (não recria nem sobrescreve senha de quem já existe; nunca apaga dados) e recusa rodar com `NODE_ENV=production`. Credenciais em `README.md`.
- Contas reais (inclusive de produção): `npm run dev:funcionario:criar` (banco local) ou `npm run prod:funcionario:criar` (Aiven). Pergunta nome e login, pede a senha duas vezes sem mostrá-la na tela e, em produção, exige digitar `sim`. Senha mínima de 8 caracteres (mesma regra da troca de senha, `SENHA_MINIMA` em `password.ts`); login repetido é recusado sem alterar a conta existente. Núcleo em `modules/auth/provisionar-funcionario.ts`, comando em `db/run-criar-funcionario-cli.ts`.
- **Deliberadamente fora desta fatia:** proteção CSRF completa, limite de tentativas de login, papéis ADMIN/OPERADOR. Todas as rotas de livros agora também dependem de autenticação.

## Documentação da API (Swagger)

`swagger-jsdoc` + `swagger-ui-express`, servidos pelo próprio backend:

- UI: `http://127.0.0.1:3000/api/docs`
- Spec bruta: `http://127.0.0.1:3000/api/docs.json`

Cada rota implementada ganha um bloco `@openapi` em JSDoc acima do handler, em `backend/src/modules/**/*.routes.ts` (`backend/src/config/swagger.ts` define só as informações gerais e os schemas reutilizáveis). O contrato cresce junto com o código: não existe um YAML mantido à parte, e por isso o Swagger só documenta o que já está implementado, não o mapa completo proposto em `docs/mapa-inicial-de-endpoints.md`.

## Próximas decisões e entregas

1. ~~Versionar migrations~~ — 0001–0009 para autenticação/perfil, livros, leitores, empréstimos, renovações, idempotência e vínculo explícito de perfil. Modelo de livros por quantidade, sem exemplares individuais.
2. ~~Definir o contrato OpenAPI e disponibilizar Swagger UI~~ — feito, crescendo por rota.
3. ~~Implementar APIs de leitores, empréstimos e dashboard persistente~~ — feito e testado localmente; falta integrar as telas e publicar após revisão.
4. Substituir os mocks Angular por serviços HTTP. Login já chama a API; concluir sessão/perfil/logout e integrar acervo.
5. ~~Configurar `SESSION_SECRET` no Cloud Run~~ — feito (Secret Manager).
6. CSRF completo e limite de tentativas de login, quando outras rotas de escrita existirem.
7. ~~Comando de provisionamento de conta de funcionário para produção~~ — feito (`npm run prod:funcionario:criar`).
8. ~~Rodar as migrations de produção dentro do próprio deploy~~ — validado em 13/10; esta entrega amplia a validação do CI para a suite completa do backend em MySQL descartável.
9. ~~Excluir a instância Cloud SQL~~ — excluída em 06/10/2026.
