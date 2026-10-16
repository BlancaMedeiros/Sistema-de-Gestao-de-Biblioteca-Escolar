# QAT — APIs da biblioteca e próximos passos

**Roteiro atualizado em 16/10/2026; evidências de execução de 15/10/2026.** Este roteiro registra o que foi implementado e validado localmente na branch `feature/livros`. O [índice do workspace](../../relatorios/00-leia-primeiro.markdown) contém o diagnóstico histórico; o [mapa de endpoints](mapa-inicial-de-endpoints.md) e o [contrato completo](specs/2026-10-15-apis-restantes-design.md) descrevem as APIs implementadas.

**Nova rodada concluída em 16/10:** [resultado do QAT](qat-resultado-2026-10-16.md), com 214 testes aprovados em cada banco, 23 operações por HTTP real, conferência visual do Swagger e correções. As evidências de 15/10 abaixo permanecem como histórico. Para integração, use o [guia da Bianca](entrega-backend-bianca.md).

Para organizar uma rodada e decidir se o backend pode ser entregue à Bianca, comece pelo [checklist de aceite e entrega](qat-aceite-backend.md). Ele relaciona as 23 operações, regras obrigatórias, evidências e critérios de aprovação. Os passos detalhados de livros e empréstimos continuam neste roteiro; autenticação e perfil estão no [roteiro de autenticação](como-testar-autenticacao.md).

## Situação atual

| Área | Situação nesta entrega |
| --- | --- |
| Autenticação e perfil | APIs anteriores preservadas; middleware também invalida sessão de funcionário inativado |
| Funcionários | Cadastro por API autenticada; mesmo nível de acesso, sem senha/hash na resposta |
| Livros | CRUD, saldo descontando empréstimos abertos, bloqueio de inativação e edição de estoque comprometido |
| Banco | Migrations 0001–0007 aplicadas e conferidas somente nos bancos locais |
| Tela de acervo | Continua com mocks; integração será feita separadamente |
| Leitores | Cadastro, busca, filtros, edição, inativação/reativação e histórico paginado |
| Empréstimos | Cadastro, consulta, renovação e devolução, com limites, transações e idempotência |
| Dashboard e relatório | Indicadores e pendências calculados no banco, com data da escola |
| Produção | Não alterada nesta entrega; novas APIs não foram publicadas |

O checkout foi atualizado com o remoto de `feat/backend-foundation` no commit `888e4dd`, por merge local `0a1fb18`. As cinco alterações locais anteriores de CI/TiDB foram preservadas: o conteúdo já existia no remoto e foi comparado. Um stash de segurança foi mantido, com a mensagem `backup antes da integracao da API de livros 2026-10-15`.

## Evidências executadas

| Verificação | Resultado observado |
| --- | --- |
| Suite completa do backend contra MySQL 8.4 local | **207 testes passaram em 22 arquivos** |
| Migrations no MySQL local | 0003 na primeira fatia; 0004–0007 nesta ampliação, sem alterar dados existentes |
| Migrations no TiDB v8.5.3 local descartável | Aplicou 0001–0007 do zero; segunda execução sem pendências |
| Suite completa do backend contra TiDB local | **207 testes passaram em 22 arquivos** |
| Persistência após reinício real da API | Fluxo HTTP completo com login, funcionário, leitor, livro, empréstimo, renovação, histórico, relatório, dashboard, reinício do processo, sessão/empréstimo persistidos, repetição de cadastro/renovação com as mesmas chaves após reinício, devolução, inativação e logout. Dados descartáveis removidos |
| Build TypeScript do backend | Passou |
| Build de produção do frontend | Passou na verificação anterior desta sessão, após integrar a base remota; frontend não alterado nesta ampliação de APIs |
| Suite do frontend | Última execução nesta sessão: 8 passaram, 4 falharam por `ActivatedRoute` ausente, mais `EmptyError` no perfil sem usuário em memória. Não repetida nesta ampliação sem alterações no frontend |
| Swagger | Contrato JSON com **23 operações de negócio**; referências internas e autenticação das novas operações verificadas por teste |
| Backend local do Compose | Após reiniciar para carregar todos os módulos: readiness e Swagger 200; login 200; livros, leitores, empréstimos, dashboard e relatório autenticados com 200; logout 204 usando `funcionaria.teste` |
| CI | Workflow alterado para criar MySQL descartável, aplicar migrations e executar suite completa; validado localmente por actionlint 1.7.12 sem ShellCheck/Pyflakes. Ainda não executado no GitHub com esta implementação |

Os testes HTTP usam Supertest e banco real. O fluxo de reinício também usou processos reais e requisições HTTP. Não houve teste visual da interface Swagger nem integração da tela Angular com livros. Os números acima não são testes de carga nem uma auditoria de segurança.

Entre os cenários automatizados: último exemplar disputado, limite de três em livros diferentes, duas renovações, bloqueio por qualquer atraso do leitor, devolução repetida, idempotência concorrente e por funcionário, chaves estrangeiras, inativação concorrente com empréstimo, filtros/paginação, métricas conciliadas e virada do dia em São Paulo. Os arquivos de teste agora executam em série para que a suite de métricas globais não sofra interferência de fixtures de outros arquivos; os cenários concorrentes continuam explícitos dentro dos testes.

**TiDB:** os testes locais habilitaram `tidb_enable_check_constraint = ON` somente no container descartável. A configuração do TiDB Cloud não foi consultada nem alterada. O TiDB exige essa opção para a barreira `CHECK`; confirmar antes da publicação ([documentação oficial](https://docs.pingcap.com/tidb/stable/constraints/#check)). A API valida as quantidades independentemente dessa barreira do banco.

## Preparar e abrir o ambiente

Na raiz do clone, com Docker Desktop em execução e `.env` local já configurado:

```powershell
docker compose up -d --build backend
docker compose ps -a
```

O MySQL e o backend devem ficar saudáveis; o serviço `migrate` terminar com código 0 é esperado. O volume do MySQL preserva os dados. Não sobrescreva um `.env` existente.

Se o hot reload não detectar novos módulos no Windows, reinicie o backend com `docker compose restart backend` e aguarde readiness antes de testar. Isso foi necessário ao ampliar as rotas nesta sessão.

Abra **http://127.0.0.1:3000/api/docs**. A API usa `/api/v1`, incluído automaticamente pelo servidor do Swagger. Saúde: `http://127.0.0.1:3000/api/health`; conexão com banco: `http://127.0.0.1:3000/api/ready`. Nesta máquina, `localhost` resolveu pelo caminho IPv6 e fechou a conexão; o endereço IPv4 acima foi verificado.

As contas da seed local são `bibliotecaria.teste` e `funcionaria.teste`, inicialmente com senha `Teste@123`. A seed não redefine senhas alteradas. São contas de desenvolvimento; não presuma que existam em produção. O [roteiro de autenticação](como-testar-autenticacao.md) explica as operações de perfil e senha.

Nesta rodada, `funcionaria.teste` autenticou com `Teste@123`. A conta `bibliotecaria.teste` rejeitou essa senha; nenhuma senha existente foi redefinida.

**Atenção à origem:** o proxy atual do frontend aponta para o site publicado. Para testar a nova API local, use o Swagger em `127.0.0.1:3000`, não a tela de acervo em `localhost:4200`. A tela ainda não envia as operações de livros à API.

## Roteiro manual básico de livros

Todos os itens abaixo começam com estado **Não executado manualmente**. Os testes automatizados cobrem os respectivos contratos, mas não substituem o registro da sua rodada.

1. No Swagger, executar `GET /livros` antes do login: esperado **401**, `NAO_AUTENTICADO`.
2. Executar `POST /auth/login` com a conta local: esperado **200**. O navegador mantém o cookie `__session` na mesma origem; não é preciso colá-lo no botão Authorize.
3. Executar `POST /livros` com o corpo abaixo. Esperado **201**, `quantidadeDisponivel: 4`, `status: "Disponível"`; anotar `data.id`.

```json
{
  "titulo": "QAT-20261015 Memórias de teste",
  "autor": "Autora QAT",
  "isbn": null,
  "quantidadeTotal": 5,
  "quantidadeManutencao": 1,
  "estante": "QAT-E1",
  "prateleira": "QAT-P1"
}
```

4. Executar `GET /livros/{id}`: esperado **200** com o livro. Buscar por `QAT-20261015 memorias`, sem acento, em `GET /livros?busca=...`: o livro deve aparecer.
5. Executar `PATCH /livros/{id}` com `{"quantidadeTotal": 6}`: esperado **200**, 5 disponíveis, manutenção e demais campos preservados.
6. Executar PATCH com `{"quantidadeTotal": 0}` e depois com `{"quantidadeManutencao": 7}`: esperado **422**, `DADOS_INVALIDOS` e `error.fields` indicando o campo. O livro deve continuar com total 6 e manutenção 1.
7. Executar PATCH com `{"quantidadeManutencao": 6}`: esperado **200**, zero disponíveis e `Em Manutenção`.
8. Tentar reduzir somente o total para 5: esperado **422**. Depois enviar `{"quantidadeTotal": 5, "quantidadeManutencao": 1}`: esperado **200**, 4 disponíveis.
9. Recarregar o Swagger e repetir GET. Reiniciar a API com `docker compose restart backend`, aguardar readiness e repetir GET: o livro e a sessão devem continuar disponíveis dentro do prazo da sessão.
10. Executar `DELETE /livros/{id}`: esperado **204**, sem corpo. Repetir GET e DELETE: **404**, `LIVRO_NAO_ENCONTRADO`. A busca não deve listar o inativo.
11. Executar `POST /auth/logout`: **204**. Repetir GET de livros: **401**.

### Casos complementares

| Caso | Resultado esperado |
| --- | --- |
| Dois livros sem ISBN, com `null`, vazio ou omissão | Ambos aceitos |
| Cadastrar ISBN `978-85-359-0277-8`; tentar outro livro com `9788535902778` | Primeiro normaliza; segundo dá 409 `ISBN_DUPLICADO`, inclusive se o primeiro estiver inativo |
| ISBN inválido, título/autor vazios, quantidades fracionárias, ano inválido | 422 com campos inválidos; nenhuma gravação parcial |
| PATCH só do autor | Demais campos preservados |
| PATCH de campo opcional com `null` ou texto vazio | Campo apagado; ano opcional aceita `null` |
| PATCH vazio, só com campo desconhecido ou só com `status` | 422; requer ao menos um campo editável |
| `status` e `quantidadeDisponivel` falsificados junto com campos válidos | Ignorados; resposta calculada pelo servidor |
| ID inexistente, zero, negativo, fracionário ou texto | 404 |
| Busca por `%`, `_`, `!`, barra invertida ou texto com apóstrofo | Texto literal, sem atuar como curinga ou SQL |
| Busca vazia | Todos os livros ativos ordenados por título, sem paginação |
| Busca maior que 100 caracteres ou parâmetro repetido | 422 |
| Dois POST simultâneos com mesmo ISBN | Um 201 e um 409; uma linha no banco |
| Dois PATCH simultâneos em campos distintos | Ambos preservados |
| PATCHes simultâneos de quantidades incompatíveis | Apenas uma alteração aceita; registro mantém a invariante |

O ISBN valida formato de 10/13 caracteres, sem cálculo do dígito de controle. Com a ampliação desta entrega, livros também descontam empréstimos abertos, exibem `Esgotado` e rejeitam inativação com empréstimos abertos.

## Roteiro manual completo

Use dados novos e identificáveis no banco local. Os IDs abaixo devem ser substituídos pelos retornados em cada cadastro. Cada operação de empréstimo, renovação ou devolução recebe uma **Idempotency-Key nova**, por exemplo um UUID; uma repetição da mesma intenção reutiliza a chave original. O Swagger expõe esse header nas respectivas operações.

1. Fazer login em `POST /auth/login` com a conta local.
2. Cadastrar um leitor em `POST /usuarios`:

```json
{ "nome": "Leitora QAT", "matricula": "QAT-LEITOR-001", "tipo": "Aluno" }
```

3. Cadastrar um livro com duas unidades e zero em manutenção em `POST /livros`. Anotar os dois IDs.
4. Fazer `POST /emprestimos` com header `Idempotency-Key: qat-emprestimo-001` e corpo:

```json
{ "livroId": 1, "usuarioId": 1 }
```

5. Esperado **201**, data atual de São Paulo, vencimento em sete dias e zero renovações. Repetir com mesma chave/corpo: mesmo 201 e ID, sem novo empréstimo. GET do livro deve mostrar uma unidade disponível.
6. Consultar `GET /usuarios/{id}/emprestimos`, `GET /emprestimos/{id}` e `GET /relatorios/pendencias?usuarioId=...`: o empréstimo aparece como aberto. O dashboard conta esse empréstimo em `emprestimosAtivos`.
7. Tentar inativar o leitor (`PATCH /usuarios/{id}` com `{"status":"Inativo"}`) e excluir o livro: **409**, sem mudar os registros.
8. Fazer `POST /emprestimos/{id}/renovacoes` com `Idempotency-Key: qat-renovacao-001`, corpo ausente ou `{}`. Esperado **200**, contador 1 e vencimento mais sete dias sobre o anterior. Repetir a mesma chave: mesmo resultado, contador continua 1.
9. Renovar com chave nova `qat-renovacao-002`: contador 2. Uma terceira intenção com chave nova deve retornar **409 `LIMITE_RENOVACOES`**.
10. Fazer `POST /emprestimos/{id}/devolucao` com chave `qat-devolucao-001`. Esperado **200**, `Devolvido`, data atual e operador registrado. O livro volta a ter duas unidades disponíveis.
11. Repetir com a mesma chave: mesmo 200. Repetir com chave nova: **409 `EMPRESTIMO_DEVOLVIDO`**. Renovar devolvido também deve dar 409.
12. O histórico mantém o registro devolvido; o relatório de pendências não o lista. Inativar leitor/livro agora deve funcionar sem apagar o histórico.
13. Para verificar o limite, usar livro com quatro ou mais unidades e outro leitor ativo. Três empréstimos com chaves diferentes são aceitos; o quarto dá **409 `LIMITE_EMPRESTIMOS`**. Devolver um libera a possibilidade de outro empréstimo.
14. Atraso por passagem do tempo é calculado automaticamente. Os testes já exercitam os casos de vencimento anterior a hoje e bloqueio de todas as renovações/novos empréstimos do leitor. Não é possível forjar datas antigas pelo POST para simular atraso na API; o servidor ignora esses campos.
15. Cadastrar outro funcionário por `POST /funcionarios` na conta local autenticada. Esperado 201 sem senha/hash na resposta; login repetido dá 409. Usar essa conta exclusiva para os testes de perfil e senha do roteiro de autenticação. Não confundir esse cadastro com leitor.

Um livro sem disponibilidade não pode ser emprestado, mesmo que a lista da tela esteja desatualizada. As APIs devolvem 422 para entradas inválidas e 409 para conflitos de estado/limite. O [contrato](specs/2026-10-15-apis-restantes-design.md) detalha os filtros, DTOs e códigos.

Para registrar a execução manual:

```text
Caso:
Data/responsável:
Ambiente e branch/commit:
Dados e passos:
Esperado:
Observado (status HTTP e corpo/tela):
Estado: Não executado | Aprovado | Reprovado | Bloqueado
Evidência sem senha/cookie:
Defeito e próximo passo:
```

## Repetir as verificações automatizadas

Com o MySQL local disponível e dependências do backend instaladas:

```powershell
npm.cmd run dev:migrate
npm.cmd test --prefix backend
npm.cmd run build --prefix backend
```

Esses comandos usam a configuração local da raiz. Não aponte a suite de integração para o banco de produção: ela cria e remove registros de teste. Para executar dentro do backend local do Compose:

```powershell
docker compose exec backend npm test
```

## Próximos passos

1. Executar e registrar o roteiro manual completo. A implementação permanece local na `feature/livros`; o merge de atualização da base já foi registrado.
2. Revisar código, migrations e contratos e preparar commit/PR para `feat/backend-foundation`. O CI valida PRs para essa branch e roda toda a suite do backend contra MySQL descartável. Ainda não houve push/execução desse CI com estas APIs.
3. Bianca integra acervo, leitores, movimentações e indicadores ao [contrato completo](specs/2026-10-15-apis-restantes-design.md), adaptando datas ISO e paginação. Na intenção de emprestar/renovar/devolver, gerar uma chave e preservá-la durante retentativas; uma ação nova exige chave nova. Manter formulário e mostrar erros 409/422.
4. Concluir sessão/logout/perfil e guards no frontend e corrigir seus testes pendentes. Restaurar sessão via `/me` após F5; encerrar a sessão da API ao sair.
5. Antes de publicar, confirmar a configuração de CHECK no TiDB Cloud e revisar o DDL. A publicação é uma etapa separada; depois dela, verificar as migrations, o Swagger e o fluxo na URL pública. O teste local não confirma configuração ou publicação do provedor.

Tratamento global JSON de erros internos foi incluído nesta ampliação. CSRF completo, limitação de tentativas de login e integração/homologação visual continuam pendentes. O documento não declara o sistema completo homologado.
