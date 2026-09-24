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

`npm run dev` executa `docker compose up --build` e apresenta os logs dos três serviços em um terminal.

| Serviço | Papel | Persistência |
| --- | --- | --- |
| `frontend` | Angular em modo desenvolvimento, com hot reload | Código vem do Git por bind mount |
| `backend` | API Express em modo desenvolvimento, com hot reload | Código vem do Git por bind mount |
| `mysql` | Banco relacional local | Dados no volume `mysql_data` |

Os volumes `frontend_node_modules` e `backend_node_modules` mantêm dependências Linux separadas das dependências instaladas no Windows do computador.

## Verificação inicial

- `GET /health`: confirma que o processo Express está em execução. Não consulta o banco.
- `GET /ready`: consulta o MySQL com `SELECT 1`. Retorna `200` somente quando a API e o banco estiverem conectados; caso contrário, retorna `503` sem expor credenciais.

Esses endpoints não validam migrations, autenticação ou regras da biblioteca. Eles apenas comprovam a fundação da stack.

## Migrations

`database/migrations/*.sql` guarda um comando DDL por arquivo, numerado (`0001_...`, `0002_...`). `backend/src/db/migrate.ts` lê os arquivos, confere o que já foi aplicado na tabela `schema_migrations` (criada automaticamente) e executa só os pendentes, na ordem.

Como `database/` não é montado dentro do container `backend` no `compose.yaml` (só `backend/` e `frontend/` são), o comando roda no host, contra a porta do MySQL publicada pelo Compose:

```powershell
npm run dev:migrate
```

Reaplicar o comando é seguro (idempotente); nada acontece se não houver migration pendente.

## Autenticação (primeira fatia implementada)

- `POST /api/v1/auth/login`, `POST /api/v1/auth/logout` e `GET /api/v1/me`, cobertos por testes de integração (`backend/src/modules/auth/*.test.ts`) contra o MySQL real.
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
