# Validação do deploy e migrations no TiDB

**Data: 13/10/2026.** Contexto geral: [documentação de deploy](deploy-firebase-cloud-run.md) e [índice inicial do workspace](../../relatorios/00-leia-primeiro.markdown) (diagnóstico histórico).

## Diagnóstico inicial confirmado

- Clone: `feature/livros`, HEAD `b4427eb`. A documentação de deploy já tinha mudanças locais da troca de banco, que foram preservadas.
- Publicação mantida em `feat/backend-foundation`, conforme decisão do usuário. Head remoto consultado: `c0709fec1313c59f6f8a2372580cb6db9c45960c`.
- O workflow remoto consultado inicialmente não tinha etapa de migrations. A [execução anterior, em 08/10/2026](https://github.com/BlancaMedeiros/Sistema-de-Gestao-de-Biblioteca-Escolar/actions/runs/37829326854), passou, mas publicou sem executar migrations e ocorreu antes da troca para TiDB.
- Cloud Run: `biblioteca-api-00015-jvx`, host TiDB em São Paulo, porta 4000, banco `biblioteca`, usuário da aplicação. Senha e CA referenciam os segredos TiDB na versão 1, sem valor inline; o segredo de sessão continua separado.
- Provider OIDC ativo: condição `assertion.repository_id=='1346661430' && assertion.ref=='refs/heads/feat/backend-foundation'`. A conta do deploy tem vínculo `roles/iam.workloadIdentityUser` com o repositório.
- As políticas dos dois segredos concedem acesso à conta da API, mas não à conta do GitHub Actions. A política do projeto consultada também não mostrou `secretAccessor` para essa conta. O acesso aos segredos precisa ser concedido antes de ativar o workflow alterado.
- A branch remota aparece como `protected: false`, sem regras retornadas pelo endpoint de regras aplicáveis. A credencial GitHub tem acesso de push, sem admin. Consultas às políticas gerais do Actions e às permissões padrão de workflows retornaram HTTP 403; essas configurações administrativas não foram verificadas. As permissões explícitas do YAML foram verificadas.
- A branch padrão é `main`, onde a consulta ao arquivo de workflow retornou 404. O GitHub exige o workflow na branch padrão para disparo manual por `workflow_dispatch`; portanto o gatilho confiável atual é push na branch de publicação. O disparo manual não foi executado e requer disponibilizar o workflow também em `main`, preservando a restrição do job de publicação ([GitHub](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)).

## Alterações publicadas

1. O workflow reutiliza `backend/src/db/run-migrations-cli.ts` por `npm run migrate --prefix backend`. O algoritmo de migrations foi mantido.
2. Senha e CA são lidas pelo Secret Manager, com mascaramento, e fornecidas somente ao ambiente do passo de migrations. Não se usa `.env.aiven`, `.env.tidb` ou seed em CI.
3. Migrations ficam depois de gerar a imagem e antes de atualizar Cloud Run/Hosting. A falha de leitura de segredo ou a saída não zero da migration interrompe a publicação. Uma imagem pode já existir no Artifact Registry quando a migration falha; a API publicada não é atualizada por esse workflow nessa situação.
4. O grupo de concorrência existente e `cancel-in-progress: false` foram preservados. A publicação manual ganhou verificação explícita da branch; o token OIDC só é concedido ao job de publicação.
5. O job de validação ganhou testes de pendências, ordenação, falhas de DDL/histórico, saída do CLI e configuração TLS. Não consulta banco real.

## Verificações executadas

| Verificação | Resultado |
| --- | --- |
| Build backend (`npm run build --prefix backend`) | Passou |
| Build frontend (`npm run build --prefix frontend`) | Passou |
| Testes selecionados abaixo | 14 passaram em 4 arquivos |
| Parse YAML e verificações de branch, permissões, concorrência, ordem e ausência de bypass de falha | Passou |
| `actionlint` oficial v1.7.12 | Passou; schema e expressões validados, sem ShellCheck/Pyflakes |
| Leitura da senha e CA, versão 1, no Secret Manager com a identidade local | Passou; conteúdo não impresso; arquivos temporários removidos |
| Conexão do código ao TiDB com CA e validação do certificado | Passou; versão `8.0.11-TiDB-v8.5.3-serverless` |
| Histórico `schema_migrations` | `0001_create_funcionarios.sql` e `0002_create_sessoes.sql`; zero pendências |
| Duas execuções do CLI existente contra TiDB após confirmar zero pendências | Ambas: saída 0 e `Nenhuma migration pendente.`; nenhuma migration reaplicada |
| Site, `/api/health` e `/api/ready` públicos | HTTP 200 nos três; readiness com `database: connected` |

```powershell
npm.cmd test --prefix backend -- src/db/migrations.test.ts src/db/migrate-controle.test.ts src/db/run-migrations-cli.test.ts src/config/database.test.ts
```

A primeira tentativa conjunta dos testes teve erro de cache temporário do Vitest no sandbox Windows; a repetição fora do sandbox passou. Os testes novos verificam falhas simuladas, sem provocar erro ou criar tabelas de teste no TiDB de produção. A suite completa de integração não foi executada: o Docker local estava indisponível.

## Ativação e validação em produção

O usuário autorizou conceder os dois acessos e publicar em produção. Em 13/10/2026, as políticas dos segredos `biblioteca-tidb-db-password` e `biblioteca-tidb-ca` foram atualizadas e consultadas novamente: ambas incluem a conta `biblioteca-github-deployer` em `roles/secretmanager.secretAccessor`, preservando o acesso da API. Não foi concedido acesso no projeto inteiro nem ao segredo de sessão.

O commit `9c24317591c50b164518da244aa81d9372a56a74` foi publicado diretamente em `feat/backend-foundation`, a partir do head anterior `c0709fe`, levando apenas workflow, testes e documentação. A especificação de livros de `b4427eb` não foi incluída. O checkout do usuário permaneceu em `feature/livros`.

O [Actions 38486900414](https://github.com/BlancaMedeiros/Sistema-de-Gestao-de-Biblioteca-Escolar/actions/runs/38486900414), disparado por push, concluiu com **sucesso**. A validação no GitHub executou os mesmos 14 testes com sucesso. O job de publicação comprovou acesso aos dois segredos pela identidade OIDC; as linhas de ambiente de `DB_PASSWORD` e `DB_SSL_CA` aparecem mascaradas nos logs.

Ordem observada nos passos do run, em horário de Brasília (UTC-3), em 13/10/2026:

| Passo | Início | Fim | Resultado |
| --- | --- | --- | --- |
| Obter senha e CA no Secret Manager | 20:54:46 | 20:54:47 | Sucesso |
| Aplicar somente migrations pendentes no TiDB | 20:54:47 | 20:54:49 | Sucesso; `Nenhuma migration pendente.` |
| Atualizar Cloud Run | 20:54:49 | 20:55:07 | Sucesso |
| Publicar Firebase Hosting | 20:55:07 | 20:55:35 | Sucesso |
| Verificar publicação pública | 20:55:35 | 20:55:36 | Sucesso |

Depois do run, foram consultados novamente o Cloud Run e os endpoints públicos:

- Revisão pronta: `biblioteca-api-00016-5c4`; imagem do commit `9c24317591c50b164518da244aa81d9372a56a74`; tag do Hosting `fh-4a86d43b65d865e6` vinculada à nova revisão.
- TiDB, porta 4000, usuário da aplicação, senha e CA na versão 1 e segredo de sessão separado foram preservados; máximo de duas instâncias e pool da API de cinco conexões preservados.
- `/`: HTTP 200 e elemento raiz Angular; `/api/health`: HTTP 200, `status: ok`; `/api/ready`: HTTP 200, `database: connected`.

O fluxo completo com zero migrations pendentes foi validado em produção. A seleção de pendências e a interrupção em caso de falha têm cobertura nos testes; não foi provocada falha nem criada migration artificial no banco de produção. A atualização posterior apenas desta documentação usa `[skip ci]` para registrar as evidências sem repetir a publicação.

Comandos de IAM executados após autorização ([permissão requerida pelo Secret Manager](https://docs.cloud.google.com/secret-manager/docs/access-secret-version)):

```powershell
$segredosTiDB = @('biblioteca-tidb-db-password', 'biblioteca-tidb-ca')
foreach ($segredoTiDB in $segredosTiDB) {
  gcloud.cmd secrets add-iam-policy-binding $segredoTiDB `
    --project=projeto-integrador-2-6352b `
    --member='serviceAccount:biblioteca-github-deployer@projeto-integrador-2-6352b.iam.gserviceaccount.com' `
    --role='roles/secretmanager.secretAccessor' `
    --condition=None
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao conceder acesso ao segredo TiDB' }
}
```

## Limites que permanecem

- O disparo manual depende de disponibilizar o workflow em `main`; isso não foi alterado. O gatilho validado é push em `feat/backend-foundation`.
- A branch continua sem proteção; as políticas administrativas do Actions retornaram 403 e não foram alteradas.
- Não execute migrations manuais em paralelo com o deploy. Uma falha de DDL não desfaz alterações anteriores; revise o schema e o histórico antes de tentar novamente. O histórico controla nomes, sem checksum.
