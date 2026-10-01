# Arquitetura técnica

**Estado:** fundação local implementada. Primeira fatia vertical de negócio implementada e testada localmente: autenticação de funcionário (login, logout, `/me`) com sessão persistida no MySQL, migrations versionadas para essa fatia e Swagger UI que cresce por rota documentada em JSDoc. Acervo, leitores e empréstimos ainda não foram implementados.

## Decisões confirmadas

- Monorepo com Angular em `frontend/`, Express + TypeScript em `backend/` e scripts SQL em `database/`.
- MySQL é iniciado pelo Docker Compose e mantém os dados no volume nomeado `mysql_data`.
- Angular e Express executam em containers próprios durante o desenvolvimento, com o código do Git montado para hot reload.
- O frontend usa `proxy.conf.json` para encaminhar chamadas futuras a `/api` para o serviço `backend`, sem expor CORS no ambiente local.
- A disponibilidade de um livro será controlada por quantidade: não haverá identificação individual de exemplares nesta primeira versão.
- Empréstimos terão prazo padrão de sete dias. As demais regras ainda serão definidas.
- A autenticação real está adiada. O login atual do Angular não representa segurança nem proteção de rotas.

## Serviços locais

```text
Navegador -> frontend:4200 -> backend:3000 -> mysql:3306
```

`npm run dev` executa `docker compose up --build` e apresenta os logs dos serviços em um terminal.

| Serviço | Papel | Persistência |
| --- | --- | --- |
| `frontend` | Angular em modo desenvolvimento, com hot reload | Código vem do Git por bind mount |
| `migrate` | Aplica as migrations pendentes e sai; `backend` espera ele terminar com sucesso | Não persiste nada; só executa contra o `mysql` |
| `backend` | API Express em modo desenvolvimento, com hot reload | Código vem do Git por bind mount |
| `mysql` | Banco relacional local | Dados no volume `mysql_data` |
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

O serviço `migrate` do `compose.yaml` roda `npm run migrate` contra o MySQL do próprio Compose e sai; `backend` declara `depends_on: migrate: condition: service_completed_successfully`, ou seja, só inicia depois que as migrations pendentes forem aplicadas com sucesso. Isso vale tanto para `npm run dev` quanto para `docker compose up` chamado direto.

Ele usa a mesma imagem de desenvolvimento do `backend` (`image: biblioteca-escolar-backend-dev`, compartilhada entre os dois serviços para não buildar duas vezes), com o bind mount extra `./database:/database:ro` — único lugar onde a pasta `database/` é montada dentro de um container. A resolução de caminho em `backend/src/config/local-env.ts` (três níveis acima do próprio arquivo) cai exatamente em `/database/migrations` dentro do container, sem precisar de configuração especial para o caso containerizado.

Reexecutar é seguro: a lógica é idempotente, então rodar de novo com tudo já aplicado só confirma "nenhuma migration pendente" e sai. Testado com uma migration real pendente (criada e depois removida como verificação) — o `migrate` aplicou e o `backend` esperou corretamente antes de subir.

### Manual, fora do Compose

Para rodar sem subir a stack inteira (ex.: só com `mysql` de pé), ou para depurar fora de um container:

```powershell
npm run dev:migrate
```

Roda no host, contra a porta do MySQL publicada pelo Compose, usando `backend/src/config/local-env.ts` para mapear as variáveis `MYSQL_*` do `.env` para o que o backend espera.

## Autenticação (primeira fatia implementada)

- `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/me`, `PATCH /api/v1/me` (só o campo `nome` por enquanto) e `PUT /api/v1/me/senha`, cobertos por testes de integração (`backend/src/modules/auth/*.test.ts`) contra o MySQL real.
- Trocar a senha (`PUT /me/senha`) invalida as demais sessões do funcionário (`destroyOtherSessions`, em `session-store.ts`) — a sessão atual continua válida, para não forçar um novo login imediato após uma troca legítima.
- Um único papel — "funcionário autorizado" — sem distinção ADMIN/OPERADOR por enquanto, para reduzir escopo desta fatia. Tabela `funcionarios` (login único, hash Argon2id da senha).
- Sessão persistida na tabela `sessoes`, via `backend/src/config/session-store.ts`: uma implementação própria de `express-session.Store` sobre o MySQL, no lugar do `MemoryStore` padrão (que perde as sessões a cada reinício do processo e não escala para múltiplas instâncias). Cookie `biblioteca.sid`, `HttpOnly`, `SameSite=Lax`, `Secure` em produção; a sessão é regenerada no login.
- Contas de desenvolvimento criadas por `npm run dev:seed:funcionarios` (`backend/src/db/seed-funcionarios.ts` + `run-seed-funcionarios-cli.ts`), com login e senha conhecidos e fixos no código — deliberado, só para uso local/demo. Idempotente por login (não recria nem sobrescreve senha de quem já existe; nunca apaga dados) e recusa rodar com `NODE_ENV=production`. Credenciais em `README.md`. Uma conta de produção com senha desconhecida (lida de segredo, não fixa no repo) ainda precisa de um comando separado — não existe hoje.
- **Deliberadamente fora desta fatia:** proteção CSRF, limite de tentativas de login, papéis ADMIN/OPERADOR. Nenhuma outra rota depende de autenticação ainda, porque não existe nenhuma outra rota de negócio implementada.

## Documentação da API (Swagger)

`swagger-jsdoc` + `swagger-ui-express`, servidos pelo próprio backend:

- UI: `http://localhost:3000/api/docs`
- Spec bruta: `http://localhost:3000/api/docs.json`

Cada rota implementada ganha um bloco `@openapi` em JSDoc acima do handler, em `backend/src/modules/**/*.routes.ts` (`backend/src/config/swagger.ts` define só as informações gerais e os schemas reutilizáveis). O contrato cresce junto com o código: não existe um YAML mantido à parte, e por isso o Swagger só documenta o que já está implementado, não o mapa completo proposto em `docs/mapa-inicial-de-endpoints.md`.

## Próximas decisões e entregas

1. ~~Versionar migrations~~ — feito para a fatia de autenticação; falta o restante do modelo (livros, exemplares, usuários leitores, empréstimos) conforme cada fatia for implementada.
2. ~~Definir o contrato OpenAPI e disponibilizar Swagger UI~~ — feito, crescendo por rota.
3. Implementar leitores, livros por quantidade e operações de empréstimo (próximas fatias verticais).
4. Substituir os mocks Angular por serviços HTTP, começando por login/`/me`.
5. Antes de qualquer novo `push` para `feat/backend-foundation`: configurar `SESSION_SECRET` no Cloud Run (ver `docs/deploy-firebase-cloud-run.md`) — sem isso, o deploy automático derruba o serviço em produção.
6. CSRF completo e limite de tentativas de login, quando outras rotas de escrita existirem.
