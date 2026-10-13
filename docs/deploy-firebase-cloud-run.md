# Deploy no Firebase Hosting + Cloud Run + TiDB

**Estado conferido em 13/10/2026:** a API roda no Cloud Run (`biblioteca-api`, projeto `projeto-integrador-2-6352b`), o frontend no Firebase Hosting e o banco de produção no **TiDB Cloud Starter**, instância `biblioteca-univesp`, em São Paulo. O limite mensal de gastos do TiDB está em **US$ 0**. Esse limite é do banco, separado do faturamento dos serviços do GCP.

## Arquitetura

```text
Navegador -> Firebase Hosting -> /api/** -> Cloud Run (biblioteca-api) -> TiDB (TLS, protocolo MySQL)
```

O Hosting entrega o build Angular e encaminha `/api` ao Cloud Run. O navegador usa a mesma origem da API.

O `firebase.json` usa `pinTag: true`: cada publicação do Hosting fica vinculada a uma revisão da API. Atualizar apenas o Cloud Run não muda esse vínculo. Ao trocar a revisão usada em produção, também é necessário publicar o Hosting com o vínculo correspondente ([documentação do Firebase](https://firebase.google.com/docs/hosting/full-config#rewrite-pintag)).

## Banco de produção: TiDB Cloud Starter

- Instância `biblioteca-univesp`, região AWS São Paulo (`sa-east-1`).
- Versão observada: TiDB v8.5.3. Usa o protocolo MySQL; o ambiente Docker local permanece em MySQL 8.4.
- Banco `biblioteca`, com charset `utf8mb4` e collation `utf8mb4_0900_ai_ci`.
- TLS com CA ISRG Root X1 e validação do certificado do servidor (`rejectUnauthorized: true`).
- Pool de 5 conexões por instância; Cloud Run limitado a 2 instâncias.

### Banco e usuários

| Usuário | Uso |
| --- | --- |
| `2Kp8VfvRaoPPGwc.root` | Administração do TiDB. Credencial local, não usada pela API. |
| `2Kp8VfvRaoPPGwc.biblioteca_app` | Aplicação e migrations: `GRANT ALL PRIVILEGES ON biblioteca.*`, sem privilégios globais. |

O prefixo faz parte do nome de usuário fornecido pelo TiDB e precisa ser mantido na conexão.

Na migração do Aiven, foram copiadas 8 contas de funcionários e 1 sessão, preservando IDs, hashes de senha e conteúdo. Os dados de origem e destino foram comparados integralmente. As tabelas existentes são `funcionarios`, `sessoes` e `schema_migrations`.

### Credenciais locais (fora do Git)

Na raiz do repositório:

- `.env.tidb`: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSL_CA` (conteúdo PEM completo) e `DB_CONNECTION_LIMIT`.
- `tidb-ca.pem`: certificado CA usado na conexão.

Ambos estão ignorados pelo Git. As senhas não devem ser incluídas na documentação. `SESSION_SECRET` em produção permanece no Secret Manager.

### Migrations em produção

O backend HTTP não aplica migrations na inicialização. O workflow foi ajustado para executar o **CLI existente** (`npm run migrate --prefix backend`) antes de atualizar o Cloud Run. O usuário autorizou a publicação em `feat/backend-foundation` e a permissão de leitura dos dois segredos para a conta do deploy; os acessos foram concedidos e a publicação está em andamento. Veja as [evidências da validação](validacao-cicd-tidb.md).

O CLI compara os arquivos `.sql` de `database/migrations/` com `schema_migrations`, executa apenas os ausentes em ordem de nome e registra cada arquivo depois de seu SQL concluir. Em falha, retorna código 1 e interrompe as migrations seguintes. No workflow, isso impede tanto o deploy da API quanto a publicação do Hosting. Não há seed de funcionários no deploy.

As duas existentes, `0001_create_funcionarios.sql` e `0002_create_sessoes.sql`, estão registradas no TiDB. Em 13/10/2026, duas execuções do CLI, usando senha e CA obtidos do Secret Manager, retornaram zero e nenhuma pendência.

Cada arquivo deve conter **um único comando SQL**. Não edite arquivos já aplicados: o controle atual usa nomes, sem checksum. DDL e registro no histórico não formam uma transação atômica; se o SQL concluir e a gravação do histórico falhar, confira o estado do banco antes de repetir. Use alterações de schema compatíveis com a API anterior, que continua servindo durante a migration. A serialização do Actions não coordena execuções manuais.

Para uma execução manual com credenciais locais (fora do Git), com as dependências instaladas, rode na raiz do repositório:

```powershell
node --env-file=.env.tidb --import ./backend/node_modules/tsx/dist/loader.mjs backend/src/db/run-migrations-cli.ts
```

O comando usa as variáveis do `.env.tidb`. O workflow usa Secret Manager, sem depender desse arquivo local. Não execute migrations manuais enquanto houver um deploy em andamento.

**Comandos antigos:** `npm run prod:migrate` e `npm run prod:funcionario:criar` continuam carregando a configuração do Aiven. Não devem ser usados para administrar o TiDB. A criação interativa de contas em produção ainda precisa ter seu carregamento de configuração adaptado antes de uso com o TiDB. A seed com senha conhecida é destinada somente ao ambiente local.

### Sessão atrás do Firebase Hosting

- O cookie de sessão se chama `__session`: o Hosting descarta outros cookies das requisições repassadas ao Cloud Run ([documentação](https://firebase.google.com/docs/hosting/manage-cache)).
- O Express usa `trust proxy` com 1 salto para reconhecer o HTTPS terminado no proxy do Google e emitir o cookie `Secure`.

Esses comportamentos têm cobertura em `backend/src/modules/auth/sessao-producao.test.ts`. A persistência e a invalidação de sessões também foram testadas com o código do projeto conectado ao TiDB.

## Parâmetros de produção (Cloud Run)

| Parâmetro | Valor |
| --- | --- |
| Serviço / região | `biblioteca-api` / `southamerica-east1` |
| Máximo de instâncias | `2` |
| `DB_HOST` | `gateway01.sa-east-1.prod.aws.tidbcloud.com` |
| `DB_PORT` | `4000` |
| `DB_NAME` | `biblioteca` |
| `DB_USER` | `2Kp8VfvRaoPPGwc.biblioteca_app` |
| `DB_CONNECTION_LIMIT` | `5` |
| `DB_PASSWORD` | segredo `biblioteca-tidb-db-password`, versão `1` |
| `DB_SSL_CA` | segredo `biblioteca-tidb-ca`, versão `1` (conteúdo PEM) |
| `SESSION_SECRET` | segredo `biblioteca-session-secret`, preservado |

A conta de serviço `biblioteca-api@projeto-integrador-2-6352b.iam.gserviceaccount.com` precisa de `roles/secretmanager.secretAccessor` nos segredos usados pela API. Não é necessário usar chave JSON em `GOOGLE_APPLICATION_CREDENTIALS`.

A troca manteve a mesma imagem da API. A revisão com TiDB é `biblioteca-api-00015-jvx`. A publicação do Hosting `181886835cddc20c` usa a tag `fh-181886835cddc20c`, vinculada a essa revisão. Os seis arquivos do frontend foram preservados integralmente.

## CI/CD

O workflow `.github/workflows/deploy-firebase.yml` mantém o gatilho de `push` em `feat/backend-foundation`. Em `workflow_dispatch`, o job de publicação só é permitido quando a referência selecionada também é `refs/heads/feat/backend-foundation`; em outra branch ele é ignorado. O clone atual está em `feature/livros`, que não publica em produção por push.

O arquivo não foi encontrado na branch padrão `main` na consulta de 13/10/2026. Como o GitHub exige o workflow na branch padrão para o disparo manual, a declaração `workflow_dispatch` sozinha não comprova disponibilidade pela aba Actions. A publicação por push foi confirmada no histórico; o gatilho manual ainda requer disponibilizar o workflow em `main` ([GitHub](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)).

```text
push -> builds + testes de migrations/TLS -> OIDC -> Docker + Artifact Registry -> Secret Manager -> migrations pendentes -> Cloud Run -> Firebase Hosting -> verificações públicas
```

A autenticação usa Workload Identity Federation, restrita ao ID do repositório `1346661430` e à branch de publicação. `contents: read` é suficiente para o job de validação; `id-token: write` é concedido apenas ao job de publicação. O deploy do Cloud Run troca apenas a imagem, preservando variáveis, segredos e limites configurados. A publicação seguinte do Hosting atualiza o vínculo da revisão da API.

Migrations e deploy pertencem ao mesmo grupo de concorrência `deploy-firebase-feat-backend-foundation`, com `cancel-in-progress: false`. Apenas uma execução desse grupo trabalha por vez; uma execução nova não cancela a que está em andamento. A fila padrão pode substituir uma execução ainda pendente, portanto não representa garantia de publicar todo commit ([GitHub](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)).

O workflow lê `biblioteca-tidb-db-password/1` e `biblioteca-tidb-ca/1` usando `google-github-actions/get-secretmanager-secrets@v3`, que mascara os valores nos logs. Eles são passados pelo ambiente apenas ao passo de migrations, sem interpolação no comando shell, impressão ou arquivo `.env`. A CA chega como PEM completo e o pool usa `rejectUnauthorized: true`. As versões e os parâmetros de conexão devem ser atualizados junto com o Cloud Run ao rotacionar segredos ou trocar o banco. A migration usa uma conexão e um `SESSION_SECRET` fictício, pois não inicia HTTP nem cria sessões; não lê o segredo de sessão da API ([ação de acesso aos segredos](https://github.com/google-github-actions/get-secretmanager-secrets)).

**Permissão concedida e conferida em 13/10/2026:** `biblioteca-github-deployer@projeto-integrador-2-6352b.iam.gserviceaccount.com` tem `roles/secretmanager.secretAccessor` nos dois segredos TiDB. Não foi concedido esse papel no projeto inteiro nem acesso ao segredo de sessão. Os comandos e as evidências estão no [registro de validação](validacao-cicd-tidb.md).

O workflow exige sucesso em `/`, `/api/health` e `/api/ready`. O job de validação compila frontend/backend e executa os 14 testes selecionados de migrations, CLI e configuração TLS, com credenciais fictícias e sem banco real. Os testes de integração do backend e os testes do frontend não fazem parte desse job.

## Validação da troca

No site publicado, `https://projeto-integrador-2-6352b.web.app`:

- Frontend: HTTP 200, com o elemento raiz Angular.
- `/api/health`: HTTP 200.
- `/api/ready`: HTTP 200 e `database=connected`.
- Login com credenciais inexistentes: HTTP 401, `CREDENCIAIS_INVALIDAS`.
- Perfil sem autenticação: HTTP 401.

A disponibilidade também foi conferida diretamente no Cloud Run. Não foi feito login com a senha de um funcionário real.

## Histórico e reversão

O banco passou de Cloud SQL para Aiven em 05/10/2026 e de Aiven para TiDB em 13/10/2026. O Aiven, os segredos `biblioteca-aiven-db-password` e `biblioteca-aiven-ca` e a revisão `biblioteca-api-00014-z47` foram mantidos.

A publicação anterior do Hosting é `296eb807c08fee32`, cuja tag `fh-296eb807c08fee32` continua apontando para a revisão com Aiven. Uma reversão do Hosting recupera esse vínculo. Antes de reverter, é necessário considerar e reconciliar dados gravados no TiDB após a troca; os dois bancos não são sincronizados automaticamente.
