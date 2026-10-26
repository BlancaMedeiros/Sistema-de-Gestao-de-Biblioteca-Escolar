# Guia para testar todas as APIs, do login à devolução

Preparado em **16/10/2026**, por leitura das rotas e contratos da branch `feature/livros`, HEAD `39a0815`. Este é um **roteiro para uma nova execução manual**, não um relatório de testes executados. As evidências anteriores estão no [QAT de 16/10](qat-resultado-2026-10-16-frontend.md).

O objetivo é testar as **23 operações de negócio** numa história contínua: entrar, preparar cadastros, vincular perfil, emprestar, consultar, renovar, devolver, inativar e sair. Em cada etapa, conferir **status HTTP, corpo e efeito nos dados**. Um 200 sozinho não aprova uma regra.

Já existiam o [checklist de aceite](qat-aceite-backend.md), o [roteiro de autenticação](como-testar-autenticacao.md) e o [QAT de livros/empréstimos](qat-e-proximos-passos.md). Este guia reúne a ordem de execução; os [contratos completos](specs/2026-10-15-apis-restantes-design.md) e [ajustes para as telas](specs/2026-10-16-aderencia-frontend.md) continuam sendo a referência detalhada. O [índice do workspace](../../relatorios/00-leia-primeiro.markdown) contém os relatórios históricos de setembro.

## Como percorrer o guia

| Ordem | Etapa | O que ela comprova |
| --- | --- | --- |
| 1 | Preparar o ambiente | API disponível, banco conectado e cliente correto |
| 2 | Entrar e criar a conta da rodada | Proteção, login, cadastro de funcionário e logout |
| 3 | Preparar leitores e livros | Cadastros, consultas, edição parcial e validação |
| 4 | Completar o perfil | Contatos, vínculo exclusivo e ausência de gravação parcial |
| 5 | Emprestar e testar os limites | Estoque, idempotência e máximo de três abertos |
| 6 | Cruzar consultas e indicadores | Filtros, paginação, histórico, painel e pendências |
| 7 | Renovar e reiniciar a API | Prazo, limite de renovações e persistência |
| 8 | Devolver e inativar | Recomposição do saldo e preservação do histórico |
| 9 | Trocar senha e encerrar | Duas sessões independentes, invalidação e logout |
| 10 | Complementar com a suíte | Atraso, concorrência e erros difíceis de simular manualmente |

Execute em ordem. Se um pré-requisito falhar, registre os passos dependentes como **bloqueados**, corrija a causa e retome. Use **NE** (não executado), **AP** (aprovado), **RP** (reprovado) e **BL** (bloqueado) no seu registro.

## 1. Preparar o ambiente

No PowerShell, dentro de `Sistema-de-Gestao-de-Biblioteca-Escolar/`, com Docker Desktop aberto e `.env` local preenchido:

```powershell
# Crie apenas se ainda não existir; não sobrescreva sua configuração.
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm.cmd run dev -- --detach
docker compose ps -a
git branch --show-current
git rev-parse --short HEAD
git status --short
```

Espere `mysql` e `backend` saudáveis; `migrate` em `Exited (0)` é sucesso. Se houver erro, use `docker compose logs --tail 100 mysql migrate backend` antes de prosseguir. Não apague volumes para tentar resolver uma falha.

| Verificação técnica | Esperado |
| --- | --- |
| [GET /health](http://127.0.0.1:3000/health) e [GET /api/health](http://127.0.0.1:3000/api/health) | 200, `status: "ok"`; são aliases |
| [GET /ready](http://127.0.0.1:3000/ready) e [GET /api/ready](http://127.0.0.1:3000/api/ready) | 200, `database: "connected"`; são aliases |
| [GET /api/docs/](http://127.0.0.1:3000/api/docs/) | Swagger carregado |
| [GET /api/docs.json](http://127.0.0.1:3000/api/docs.json) | 200, documento OpenAPI com 23 operações de negócio |

Essas rotas técnicas ficam fora da contagem das 23 operações. `GET /` na porta 3000 retorna 404: não existe página inicial do backend.

Use **http://127.0.0.1:3000/api/docs/** durante toda a rodada. Nesta máquina, o acesso a `localhost` por IPv6 apresentou falha; IPv4 respondeu. Não alterne entre `localhost` e `127.0.0.1`: o cookie de uma origem não autentica automaticamente a outra. A porta 4200 e os mocks do Angular não comprovam estas APIs; o proxy atual aponta para o ambiente publicado.

No Swagger, expanda a operação, clique em **Try it out**, preencha e clique em **Execute**. Os caminhos de negócio deste guia são relativos a **`/api/v1`**, acrescentado automaticamente pelo Swagger. Num cliente externo, por exemplo, `/me` significa `http://127.0.0.1:3000/api/v1/me`.

O seletor **Examples** oferece cadastros mínimos/completos e edições parciais com dados fictícios. Adapte-os à rodada abaixo; os exemplos não criam registros nem garantem que seus IDs existam. Em `POST /funcionarios`, os exemplos dispensam `usuarioId`; o vínculo continua opcional no contrato e é testado separadamente na etapa 4.

O login mantém o cookie `__session` no navegador. Não é necessário colá-lo em **Authorize**. No Postman/Insomnia, mantenha o armazenamento de cookies habilitado. Respostas 204 não têm corpo; não espere `{ data }` nelas.

Alguns casos negativos precisam de Postman/Insomnia: o Swagger pode impedir o envio de header obrigatório vazio. Nesse cliente, faça seu próprio login para obter a sessão, envie o caso inválido e confira a resposta HTTP. Uma validação que impediu o envio no Swagger não comprova o 422 da API. O cliente externo não compartilha automaticamente o cookie do navegador. Renovação/devolução agora oferecem o exemplo de corpo `{}` no Swagger, embora o corpo continue opcional.

### Identificar os dados da rodada

Gere um identificador novo e um ISBN sintético para verificar formato/unicidade:

```powershell
$rodadaQat = Get-Date -Format 'yyyyMMdd-HHmmss'
$isbnQat = '9' + (Get-Date -Format 'yyMMddHHmmss')
Write-Output "Rodada: $rodadaQat"
Write-Output "ISBN sintetico: $isbnQat"
```

Nos exemplos, substitua **`<R>`** pelo identificador. O ISBN é apenas dado de teste com 13 dígitos; esta API valida formato, sem calcular o dígito de controle. Se já existir, gere outro antes de começar o caso de ISBN.

Anote os IDs reais; não use IDs de registros de outras pessoas:

| Apelido usado no guia | Valor a registrar |
| --- | --- |
| FA | `data.id` da conta `qat.<R>.a` |
| FB | `data.id` da conta `qat.<R>.b` |
| UA / UB | IDs dos leitores A / B |
| LA / LB / LC | IDs dos livros A / B / C |
| E1 / E2 / E3 / E4 / E5 | IDs dos empréstimos criados, nessa ordem |
| K1 / KR1 / KR2 / KD1 | Chaves do cadastro de E1, duas renovações e devolução de E1 |
| D0 | Resposta completa de `GET /dashboard` antes dos cadastros |

Em caminhos como `/livros/{LA}`, preencha o ID no campo `id` do Swagger. Em corpos JSON, IDs são **números**: substitua os valores ilustrativos `101`, `201`, etc. pelo ID correspondente, sem aspas. Os apelidos não são variáveis que o Swagger resolve.

## 2. Entrar e criar a conta da rodada

### 2.1 Conferir acesso sem sessão

Use uma janela privada nova, sem login. Execute cada requisição abaixo: todas devem retornar **401 `NAO_AUTENTICADO`**.

| Método | Caminho | Dados, quando necessários |
| --- | --- | --- |
| GET | `/me` | — |
| POST | `/funcionarios` | Corpo de cadastro válido da seção 2.3 |
| GET | `/livros` | — |
| GET | `/usuarios` | — |
| GET | `/emprestimos` | — |
| GET | `/dashboard` | — |
| GET | `/relatorios/pendencias` | — |

Essa amostra manual cobre cada área; a suíte complementa a proteção das demais operações. Nenhuma escrita rejeitada pode criar registros.

### 2.2 Validar o login

1. `POST /auth/login` com `{}`: **422 `DADOS_INVALIDOS`**.
2. Com login de uma conta local existente e senha errada: **401 `CREDENCIAIS_INVALIDAS`**.
3. Entre com uma conta local acessível: **200**, perfil em `data`, sem senha/hash. `GET /me` deve retornar o mesmo funcionário.

As contas da seed são `funcionaria.teste` e `bibliotecaria.teste`, inicialmente com `Teste@123`. A seed preserva senhas alteradas, portanto não garante que ambas ainda aceitem essa senha. Se nenhuma funcionar, siga o [procedimento de criação local](como-testar-autenticacao.md#1-preparar-o-ambiente-e-a-conta-da-rodada); não redefina uma conta compartilhada.

### 2.3 Criar uma conta exclusiva

Autenticado, faça `POST /funcionarios`:

```json
{
  "nome": "Operadora QAT <R>",
  "login": "qat.<R>.a",
  "senha": "QatInicial@123"
}
```

Espere **201** e registre **FA**. O perfil tem `usuarioId`/`matricula` nulos e contadores zero. Criar funcionário não cria leitor.

| Tentativa | Esperado |
| --- | --- |
| Repetir o mesmo cadastro | 409 `LOGIN_DUPLICADO`; conta original intacta |
| Alterar o login para outro exclusivo e enviar nome vazio, login com espaço ou senha curta, um erro por vez | 422 `DADOS_INVALIDOS`; nenhum cadastro parcial |
| `POST /auth/logout` | 204 |
| `GET /me` e `GET /livros` após logout | 401 |
| Login com `qat.<R>.a` / `QatInicial@123` | 200; `/me` deve identificar FA |

Continue com **FA** até a etapa 9. Não troque a senha da conta da seed.

## 3. Preparar leitores e livros

Antes de cadastrar, execute `GET /dashboard` e guarde a resposta como **D0**. As comparações seguintes usam diferenças em relação a ela, sem presumir banco vazio. Evite outra rodada alterando os mesmos indicadores durante a conferência.

Use `dataReferencia` do dashboard como data da escola. Se a rodada atravessar a meia-noite de São Paulo, refaça as referências de prazo/atraso e registre a mudança: indicadores de vencimento podem variar apenas pela passagem do dia.

### 3.1 Cadastrar os dois leitores

`POST /usuarios`, leitor **UA**:

```json
{
  "nome": "QAT-<R> Ana Leitora",
  "matricula": "QAT-<R>-A",
  "tipo": "Aluno",
  "email": "leitora.a@example.test",
  "telefone": "(11) 91111-1111",
  "turma": "5A"
}
```

Repita para **UB**, alterando nome para `QAT-<R> Bruno Leitor`, matrícula para `QAT-<R>-B` e tipo para `Professor`. Pode manter os contatos: contato compartilhado é permitido. Ambos devem retornar **201**, `status: "Ativo"` e `dataCadastro` do servidor. Registre UA e UB.

| Requisição | Esperado |
| --- | --- |
| `GET /usuarios/{UA}` e `GET /usuarios/{UB}` | 200 com os dados corretos |
| Repetir POST com matrícula de UA | 409 `MATRICULA_DUPLICADA` |
| POST com matrícula nova e tipo `Visitante`, nome vazio ou e-mail inválido, um erro por vez | 422, sem novo leitor |
| `PATCH /usuarios/{UA}` com `{"turma":"5B","telefone":null}` | 200; turma muda, telefone fica null, demais campos preservados |
| PATCH com `{"nome":"Não deve salvar","email":"invalido"}` | 422; GET confirma que nem o nome mudou |
| PATCH com `{}` | 422 |
| `GET /usuarios?busca=QAT-<R>&tipo=Aluno&status=Ativo&page=1&pageSize=1` | Apenas UA, total 1 |
| `GET /usuarios?busca=QAT-<R>&page=1&pageSize=1`, depois `page=2` | Uma pessoa em cada página, IDs diferentes, total 2; ordem por nome/ID |

No Swagger, informe os parâmetros nos campos próprios, sem digitar a query inteira em `busca`.

### 3.2 Cadastrar os três livros

`POST /livros`, livro **LA**:

```json
{
  "titulo": "QAT-<R> Memórias A",
  "autor": "Autora QAT",
  "isbn": null,
  "categoria": "Teste",
  "anoPublicacao": 2026,
  "quantidadeTotal": 2,
  "quantidadeManutencao": 0,
  "estante": "QAT-E1",
  "prateleira": "P1"
}
```

Cadastre mais dois usando o mesmo modelo com as diferenças abaixo. Não altere os totais posteriormente, salvo quando o roteiro pedir.

| Livro | Título | Total | Manutenção | Estante / prateleira | Disponível / status esperado |
| --- | --- | --- | --- | --- | --- |
| LA | `QAT-<R> Memórias A` | 2 | 0 | `QAT-E1` / `P1` | 2 / `Disponível` |
| LB | `QAT-<R> Manutenção B` | 1 | 1 | null / null | 0 / `Em Manutenção` |
| LC | `QAT-<R> Limites C` | 3 | 0 | `QAT-E3` / null | 3 / `Disponível` |

Cada POST deve retornar **201**; registre LA, LB e LC. Vários livros com ISBN null são permitidos.

| Requisição | Esperado |
| --- | --- |
| `GET /livros?busca=QAT-<R>` | 200, `data` com os três livros ativos, ordenados por título/ID; sem paginação |
| Busca pelo título de LA em minúsculas e sem acento (`qat-<R> memorias a`) | Encontra LA |
| `GET /livros/{LA}` | 200, saldo 2 |
| `PATCH /livros/{LA}` com `{"autor":"Autora QAT Revisada","categoria":null}` | 200, altera autor/apaga categoria; título, total e saldo preservados |
| PATCH com `{"autor":"Não deve salvar","quantidadeTotal":0}` | 422; GET confirma autor anterior e total 2 |
| PATCH com `{"quantidadeManutencao":3}` | 422; manutenção continua 0 |
| PATCH com `{}` ou só `{"quantidadeDisponivel":999}` | 422; precisa de campo editável |
| PATCH com `{"autor":"Autora QAT Revisada","quantidadeDisponivel":999,"status":"Esgotado"}` | 200; saldo continua 2 e status `Disponível`, calculados pelo servidor |
| POST com título/autor vazio, quantidade fracionária ou ISBN `abc`, um erro por vez | 422; não criar livro |

**ISBN:** faça PATCH em LA com `isbn` igual ao ISBN sintético gerado. Insira um hífen em qualquer posição desse texto numérico. Espere 200 e a resposta sem hífen. Depois faça PATCH em LC com a mesma sequência sem hífen: **409 `ISBN_DUPLICADO`**, preservando LC com ISBN null. Guarde a sequência para repetir a tentativa depois da inativação de LA.

**Primeira conciliação:** `GET /dashboard` deve mostrar `totalAcervo = D0 + 6` e `usuariosAtivos = D0 + 2`. Empréstimos, atrasos e devoluções do dia ainda não devem mudar por esses cadastros. Acervo conta unidades, incluindo manutenção; contas de funcionários não entram em usuários ativos.

## 4. Completar o perfil e testar o vínculo

1. Em `GET /me`, confirme FA sem vínculo e com contadores zero.
2. Faça `PATCH /me` com o corpo abaixo, substituindo **201 pelo ID UA**:

```json
{
  "nome": "Operadora QAT <R> Revisada",
  "email": "operadora.a@example.test",
  "telefone": "(11) 92222-2222",
  "usuarioId": 201
}
```

Espere **200**. `GET /me` deve ter `usuarioId: UA`, matrícula de UA e `cargo: "Funcionário autorizado"`. `GET /usuarios/{UA}` deve manter os contatos do leitor: editar a conta não os sincroniza. Os IDs de funcionário e leitor são independentes.

3. Faça `POST /funcionarios` para `qat.<R>.b`, com nome `Operador QAT B`, senha `QatInicial@123`, contatos opcionais e `usuarioId` igual a **UB**. Espere **201**; registre **FB**. O cadastro deve retornar a matrícula de UB. Isso não troca a sessão: `/me` continua sendo FA.
4. Ainda como FA, faça PATCH do perfil com `usuarioId: UB` e `nome: "Não deve salvar"`: **409 `LEITOR_JA_VINCULADO`**. GET deve manter nome e vínculo anteriores de FA.
5. Escolha um inteiro positivo inexistente e confirme `GET /usuarios/{id}` com 404. Envie esse ID em PATCH do perfil, junto de um contato alterado: **404 `USUARIO_NAO_ENCONTRADO`**; contato/vínculo originais permanecem.
6. Tente criar outro funcionário com login novo e `usuarioId: UA`: **409 `LEITOR_JA_VINCULADO`**, sem conta parcial. Tentar login desse novo nome deve dar 401.
7. PATCH com `{"email":"invalido"}`, com `{"nome":""}`, com `{}` e com `{"novaSenha":"QatAlterada@123"}`, separadamente: **422**. A senha continua sendo a inicial.
8. PATCH com `{"nome":"Operadora QAT <R> Revisada","login":"nao-alterar","cargo":"Admin","matricula":"FORJADA","emprestimosAtivos":999,"historicoTotal":999}`: **200**; apenas o nome é editável. Login, cargo, matrícula e contadores continuam vindo do servidor.
9. PATCH com `{"email":null,"telefone":""}`: **200**, ambos null. Reponha os contatos do passo 2, sem enviar `usuarioId`, e confirme que o vínculo foi preservado.

Mantenha FA vinculada a UA até concluir as conferências de empréstimos.

## 5. Emprestar e testar estoque, repetição e limite

### 5.1 Primeiro empréstimo e repetição da mesma intenção

Em `POST /emprestimos`, preencha o header **`Idempotency-Key`** com `qat-<R>-e1` e registre essa chave como **K1**. Corpo, substituindo **101 por LA** e **201 por UA**:

```json
{ "livroId": 101, "usuarioId": 201 }
```

Espere **201** e registre **E1**. Confira:

- `livroId`, `usuarioId` e `funcionarioId` correspondem a LA, UA e FA.
- `dataEmprestimo` é hoje em São Paulo; `devolucaoPrevista`, hoje + 7 dias corridos; `quantidadeRenovacoes: 0`, `status: "Em Andamento"`, `devolucaoReal` e `devolvidoPor` nulos.
- `livro` equivale a `livroTitulo`, `usuario` a `usuarioNome`; `livroLocalizacao: "QAT-E1 - P1"`.
- `GET /livros/{LA}` tem disponível 1; `GET /me` tem ativos 1 e histórico 1.

Repita **a mesma chave K1 e o mesmo corpo**: mesmo **201, ID e corpo**, sem consumir outra unidade nem aumentar contadores. Depois mantenha K1 e altere `usuarioId` para UB: **409 `CHAVE_IDEMPOTENCIA_REUTILIZADA`**, sem novo empréstimo.

Uma intenção nova usa chave nova; repetir intenção usa chave e corpo originais. A chave aceita 1–100 letras ASCII, números, `.`, `_`, `:`, `-`. Use um prefixo da rodada sem espaços/acentos ou um UUID.

### 5.2 Completar o cenário de limites

Faça cada linha na ordem, com **chave nova** para cada intenção. Todos os corpos têm somente `livroId` e `usuarioId`.

| Caso | Livro / leitor | Esperado e efeito |
| --- | --- | --- |
| E2 | LA / UB | 201; LA disponível 0, `Esgotado`; `/me` de FA permanece em 1 ativo/1 histórico |
| Sem estoque | LA / UA | 409 `LIVRO_INDISPONIVEL`; nenhum efeito |
| Em manutenção | LB / UB | 409 `LIVRO_INDISPONIVEL`; LB continua disponível 0 |
| E3 | LC / UA | 201; LC disponível 2; localização `QAT-E3 - S/P` |
| E4 | LC / UA | 201; LC disponível 1; UA agora tem três abertos |
| Quarto do leitor | LC / UA | 409 `LIMITE_EMPRESTIMOS`, mesmo havendo uma unidade disponível |

O mesmo leitor pode ter mais de uma unidade do mesmo livro. O limite é três empréstimos abertos no total.

### 5.3 Rejeições não podem alterar o estado

Anote os saldos/contadores, execute os casos e consulte novamente:

| Requisição | Esperado |
| --- | --- |
| `POST /emprestimos` com IDs válidos, sem header | 422 `DADOS_INVALIDOS` |
| Mesmo POST com header contendo espaço | 422 `DADOS_INVALIDOS` |
| Mesmo POST com `livroId` em texto ou `usuarioId: 0`, com chave nova | 422 |
| POST com referência positiva comprovadamente inexistente, chave nova | 404 de livro/leitor |
| `PATCH /usuarios/{UA}` com `{"status":"Inativo"}` | 409 `USUARIO_COM_EMPRESTIMOS`; UA segue ativo |
| `DELETE /livros/{LA}` | 409 `LIVRO_COM_EMPRESTIMOS`; LA continua consultável |
| `PATCH /livros/{LA}` com `{"autor":"Não deve salvar","quantidadeTotal":1}` | 422, pois há dois emprestados; autor/estoque preservados |
| `PATCH /livros/{LA}` com `{"quantidadeManutencao":1}` | 422; manutenção continua 0 |

## 6. Cruzar consultas, filtros e indicadores

Neste ponto existem **E1, E2, E3 e E4**, todos abertos. UA tem três; UB tem um. Nenhuma rejeição deve ter criado outro registro.

| Consulta | Conferir |
| --- | --- |
| `GET /emprestimos/{E1}` | 200, os mesmos IDs, prazo e localização do empréstimo |
| `GET /emprestimos?busca=QAT-<R>&status=Abertos` | Total 4, mais recentes por criação/ID primeiro |
| `GET /emprestimos?usuarioId={UA}&livroId={LC}&status=Em Andamento` | Total 2, E3 e E4 |
| `GET /usuarios/{UA}/emprestimos?page=1&pageSize=1` | Uma linha; `pagination.total: 3`; `resumo` com total 3, ativos 3, atrasados 0 |
| Mesmo histórico, `page=2` e depois `page=3` | Outros IDs, sem repetição; resumo permanece igual |
| `GET /usuarios/{UB}/emprestimos` | Somente E2 nesta rodada; resumo total/ativos 1 |
| `GET /relatorios/pendencias?busca=QAT-<R>` | Total 4: inclui abertos em dia, não apenas atrasados |
| Mesmo relatório com `usuarioId={UA}&pageSize=1` | Uma linha; total 3, não 1 |
| `GET /me` como FA | Ativos 3, histórico 3; E2 foi operado por FA, mas pertence a UB e não entra no perfil |

Para testar o intervalo inclusivo, copie o `devolucaoPrevista` de E1 e informe **esse mesmo dia** em `vencimentoDe` e `vencimentoAte`, na listagem e no relatório, com `usuarioId: UA`. Antes das renovações, devem aparecer E1, E3 e E4. No histórico de UA, filtre por `status: Devolvido`: página vazia, total filtrado 0, mas `resumo.totalEmprestimos` e `emprestimosAtivos` continuam 3.

Em `GET /dashboard`, compare com D0:

| Métrica | Variação esperada neste ponto |
| --- | --- |
| `totalAcervo` | +6 |
| `usuariosAtivos` | +2 |
| `emprestimosAtivos` | +4 |
| `devolucoesPendentes` | Sem aumento causado pela rodada: seus empréstimos estão em dia |
| `devolucoesHoje` | Sem aumento causado pela rodada: os prazos são daqui a sete dias |

`ultimosEmprestimos` tem até quatro itens; sem outras movimentações, são E4, E3, E2 e E1. Confira nomes/localização em listagem, detalhe, histórico, pendências e painel. Não confunda `data.metricas.devolucoesHoje` (número) com `data.devolucoesHoje` (lista).

### Filtros inválidos e busca literal

| Caso | Esperado |
| --- | --- |
| Leitores com tipo/status desconhecido | 422 |
| Listagem paginada com `page=0`, `pageSize=101` ou `page=abc`, um por vez | 422 |
| Empréstimos/histórico/pendências com data impossível ou início posterior ao fim | 422 |
| Relatório com `status=Devolvido` | 422: relatório aceita somente abertos |
| Busca com 101 caracteres | 422 |
| Query repetida, por exemplo `/usuarios?page=1&page=2` num cliente HTTP | 422; o Swagger não oferece dois campos `page` |
| IDs de caminho `0`, `abc` ou positivo comprovadamente inexistente em livros, leitores e empréstimos | 404 específico do recurso |

Para observar escape de busca, faça PATCH de título de LB para `QAT-<R> 100%_! B`. Busque por `%`, `_` e `!` separadamente em livros: LB deve aparecer e livros sem o símbolo literal não devem aparecer por causa de um curinga. Num cliente HTTP codifique os caracteres de query; no Swagger basta preencher `busca`. Restaure o título de LB após o teste. Não espere total global fixo se outros cadastros também contiverem esses símbolos.

## 7. Renovar, conferir localização atual e reiniciar

### 7.1 Duas renovações, sem duplicar efeito

Use `POST /emprestimos/{E1}/renovacoes`, corpo ausente ou `{}`:

| Intenção | Header | Esperado |
| --- | --- | --- |
| Primeira renovação | `qat-<R>-e1-r1` (**KR1**) | 200; contador 1, vencimento anterior +7 dias |
| Repetição da primeira | Mesma KR1 | Mesmo 200/corpo; contador real continua 1 |
| Segunda renovação | `qat-<R>-e1-r2` (**KR2**) | 200; contador 2, mais 7 dias sobre o prazo renovado |
| Terceira renovação | Nova chave | 409 `LIMITE_RENOVACOES`; prazo e contador preservados |

Ao final, E1 vence 21 dias depois da data inicial, sem alterar estoque. Consulte por GET para conferir o estado atual: repetir KR1 depois da segunda renovação **reapresenta a resposta antiga**, com contador 1, sem desfazer a segunda renovação. Header ausente ou corpo `{"dias":30}` em uma tentativa nova deve dar 422.

### 7.2 Localização atual versus resposta original

Faça `PATCH /livros/{LA}` com `{"estante":"QAT-E2","prateleira":"P2"}`: **200**, saldo continua 0. GET de E1/E2, listagem, histórico, relatório e painel devem refletir `QAT-E2 - P2`. Repetir o cadastro de E1 com K1/corpo original devolve o **corpo original**, com `QAT-E1 - P1`, sem novo empréstimo. GET é a consulta do estado atual.

### 7.3 Persistência após reinício

Recarregue o Swagger e confirme `/me` 200. Guarde os dados de E1 e os saldos. No terminal:

```powershell
docker compose restart backend
docker compose ps -a
```

Aguarde `/ready` com 200. **Sem refazer login**, `/me`, E1 e os livros devem continuar disponíveis com os valores atuais, dentro da validade da sessão. Repita K1 com o corpo original e KR2 em E1: mesmos status/corpos de sucesso, nenhum novo empréstimo/renovação. O estoque não muda.

Se a sessão tiver realmente expirado durante uma rodada longa, registre isso, entre novamente e repita a verificação de persistência numa sessão recente. Reinício não equivale a apagar/recriar banco.

## 8. Devolver, liberar o limite e inativar

### 8.1 Devolver E1

`POST /emprestimos/{E1}/devolucao`, corpo ausente ou `{}`, header `qat-<R>-e1-d1` (**KD1**):

- **200**, `status: "Devolvido"`, `devolucaoReal` hoje em São Paulo e `devolvidoPor: FA`.
- LA passa de 0 para 1 disponível; UA passa de três para dois abertos.
- `/me` tem ativos 2 e histórico 3; histórico mantém E1; relatório de UA deixa de listar E1.
- Dashboard passa a `emprestimosAtivos = D0 + 3`; acervo continua `D0 + 6`.

| Tentativa | Esperado |
| --- | --- |
| Repetir devolução com KD1 | Mesmo 200/corpo; saldo não aumenta outra vez |
| Devolver E1 com chave nova | 409 `EMPRESTIMO_DEVOLVIDO` |
| Renovar E1 com chave nova | 409 `EMPRESTIMO_DEVOLVIDO` |
| Renovar/devolver com corpo contendo campos adicionais | 422 |

### 8.2 Comprovar que a devolução libera novo empréstimo

Crie **E5**, LC / UA, com chave nova: **201**. UA volta a três abertos; LC passa de 1 para 0. `/me` fica em ativos 3 e histórico 4. Assim o teste comprova tanto o bloqueio do quarto quanto sua liberação após devolver.

Devolva **E2, E3, E4 e E5**, cada um com chave nova. Cada ação retorna 200 e recompõe exatamente uma unidade. No fim:

| Conferência | Esperado |
| --- | --- |
| LA / LB / LC disponíveis | 2 / 0 / 3 |
| Histórico de UA | Quatro registros, todos devolvidos; resumo total 4, ativos 0, atrasados 0 |
| Histórico de UB | Um registro devolvido; total 1, ativos 0 |
| Relatório com `busca=QAT-<R>` | Vazio, total 0 |
| `/me` de FA | Ativos 0, histórico 4 |
| Dashboard: empréstimos ativos | Voltou ao valor de D0 |

### 8.3 Inativação e reativação sem perder histórico

1. `DELETE /livros/{LA}`: **204**. GET, PATCH válido e novo DELETE em LA: **404 `LIVRO_NAO_ENCONTRADO`**. A busca de ativos não deve mais listar LA.
2. Repita em LC o PATCH com o ISBN sintético de LA: **200**, com LC exibindo esse ISBN. A inativação de LA libera o ISBN; enquanto LA estava ativo, o mesmo PATCH dava **409 `ISBN_DUPLICADO`**.
3. `PATCH /usuarios/{UA}` com `{"status":"Inativo"}`: **200**. GET de UA continua **200**; a lista sem filtro inclui inativos e `status=Ativo` exclui UA.
4. Cadastro com matrícula de UA: **409 `MATRICULA_DUPLICADA`**, inclusive inativo.
5. Novo empréstimo LC / UA, chave nova: **409 `USUARIO_INATIVO`**. LC está ativo e disponível, isolando o motivo da rejeição.
6. GET de E1 e histórico de UA continuam **200**, com nomes, localização atual de LA e registros devolvidos. Perfil pode continuar vinculado a leitor inativo: ativos 0, histórico 4.
7. Reative UA por PATCH `{"status":"Ativo"}`: **200**. Tente empréstimo LA / UA com chave nova: **409 `LIVRO_INATIVO`**, pois LA continua inativo.
8. Faça PATCH de `/me` com `{"usuarioId":null}`: **200**; matrícula null e contadores zero. Histórico de UA continua com quatro registros. Vincule novamente UA: histórico 4 reaparece no perfil.

Para encerrar sem empréstimos abertos, inative **somente os leitores da rodada** UA/UB e exclua logicamente LB/LC. Esperado: 200 nos PATCHes de leitores, 204 nos DELETEs de livros. Agora acervo, usuários ativos e empréstimos ativos do dashboard devem voltar a D0, se nenhuma outra pessoa tiver alterado o banco.

O histórico e as respostas idempotentes são preservados. Não há endpoint para apagar funcionários ou remover fisicamente os empréstimos; deixe as contas exclusivas identificadas no registro. Não use SQL de exclusão nem `docker compose down -v` como limpeza deste roteiro.

## 9. Trocar senha em duas sessões e encerrar

Faça esta etapa **apenas com FA**, a conta exclusiva.

1. Mantenha o Swagger atual como **sessão A**. Abra outro navegador ou contexto privado independente como **sessão B**, na mesma URL `127.0.0.1`, e faça login com FA. Confirme `/me` 200 nos dois. Duas abas normais, ou duas janelas que compartilham a mesma sessão privada, não comprovam sessões independentes.
2. Na A, `PUT /me/senha` com `{"senhaAtual":"errada","novaSenha":"QatAlterada@123"}`: **401 `SENHA_ATUAL_INVALIDA`**. `/me` permanece 200 nas duas sessões.
3. Envie `{"senhaAtual":"QatInicial@123","novaSenha":"curta"}`: **422**, sem alterar senha/sessões.
4. Envie o corpo válido abaixo na A:

```json
{ "senhaAtual": "QatInicial@123", "novaSenha": "QatAlterada@123" }
```

Espere **204**. Na A, `/me` continua **200**. Na B, `/me` passa a **401**.

5. Na B, login com senha antiga: **401**; com `QatAlterada@123`: **200**. O perfil deve manter nome/contatos/vínculo salvos.
6. Se quiser restaurar a senha da conta exclusiva, use `PUT /me/senha` com senha atual `QatAlterada@123` e nova `QatInicial@123`. Espere 204; registre qual ficou valendo. Essa troca também invalida as outras sessões de FA.
7. Em cada contexto ainda autenticado, `POST /auth/logout`: **204**. Na mesma sessão, `/me`, livros, leitores, empréstimos, painel e pendências devem retornar **401**.

Não compartilhe senha, cookie, `Set-Cookie` ou conteúdo de `.env` no relatório de evidências.

## 10. Complementar os casos que exigem controle de tempo/concorrência

Não é preciso esperar uma semana nem alterar datas diretamente no banco para terminar a rodada. Os cenários abaixo precisam de fixtures controladas; execute a suíte no banco local e registre o método como **automatizado**. Não marque como execução manual.

```powershell
docker compose exec -T backend npm test
docker compose exec -T backend npm run build
```

Ambos devem terminar com código 0. A quantidade histórica de testes está no QAT; registre a quantidade efetivamente observada nesta rodada. Não execute a suíte enquanto confere deltas globais manualmente, pois ela cria/remove dados temporários.

| Cenário | Arquivo de referência em `backend/src/` |
| --- | --- |
| Atraso de ontem, prazo de hoje, bloqueio de novos empréstimos e de todas as renovações do leitor, liberação após devolver atrasados | `modules/emprestimos/emprestimos.routes.test.ts` |
| Disputa da última unidade, limite global em paralelo, mesma chave simultânea e edição/inativação concorrente | `modules/emprestimos/emprestimos.routes.test.ts` e `modules/livros/livros.routes.test.ts` |
| Virada de data em São Paulo e soma de dias | `utils/datas.test.ts` |
| Painel e pendências com atrasados e vencimentos de hoje, filtros e paginação | `modules/dashboard/dashboard.routes.test.ts` |
| Sessão de funcionário inativo | `modules/auth/funcionarios.routes.test.ts` |
| Vínculo exclusivo em paralelo, rollback e indicadores do perfil | `modules/auth/perfil-funcionario.test.ts` |
| JSON inválido 400, corpo grande 413, charset/encoding não suportado 415 e erro interno 500 sem expor detalhes | `http/erros.test.ts` |

Se precisar de evidência isolada, por exemplo:

```powershell
docker compose exec -T backend npm test -- src/modules/emprestimos/emprestimos.routes.test.ts
```

Associe a saída e as descrições dos testes aos cenários; só o total de testes não comprova uma regra específica. O [checklist de aceite](qat-aceite-backend.md) detalha critérios de aprovação e instalação das migrations em banco descartável. Não provoque indisponibilidade ou erro 500 no ambiente compartilhado para obter uma captura manual.

## Inventário: conferir que nenhuma operação ficou de fora

Os IDs abaixo são os mesmos do checklist de aceite. Todos começam em **NE** na sua nova rodada; substitua pelo resultado e referência da evidência.

| ID | Método | Caminho sob `/api/v1` | Etapas | Estado / evidência |
| --- | --- | --- | --- | --- |
| API-01 | POST | `/auth/login` | 2, 9 | NE |
| API-02 | POST | `/auth/logout` | 2, 9 | NE |
| API-03 | GET | `/me` | 2, 4–9 | NE |
| API-04 | PATCH | `/me` | 4, 8 | NE |
| API-05 | PUT | `/me/senha` | 9 | NE |
| API-06 | POST | `/funcionarios` | 2, 4 | NE |
| API-07 | POST | `/livros` | 3 | NE |
| API-08 | GET | `/livros` | 3, 6, 8 | NE |
| API-09 | GET | `/livros/{id}` | 3, 5, 8 | NE |
| API-10 | PATCH | `/livros/{id}` | 3, 5, 7, 8 | NE |
| API-11 | DELETE | `/livros/{id}` | 5, 8 | NE |
| API-12 | POST | `/usuarios` | 3, 8 | NE |
| API-13 | GET | `/usuarios` | 3, 6, 8 | NE |
| API-14 | GET | `/usuarios/{id}` | 3, 4, 8 | NE |
| API-15 | PATCH | `/usuarios/{id}` | 3, 5, 8 | NE |
| API-16 | GET | `/usuarios/{id}/emprestimos` | 6, 8 | NE |
| API-17 | POST | `/emprestimos` | 5, 8 | NE |
| API-18 | GET | `/emprestimos` | 6, 7 | NE |
| API-19 | GET | `/emprestimos/{id}` | 6–8 | NE |
| API-20 | POST | `/emprestimos/{id}/renovacoes` | 7, 8 | NE |
| API-21 | POST | `/emprestimos/{id}/devolucao` | 8 | NE |
| API-22 | GET | `/dashboard` | 3, 6, 8 | NE |
| API-23 | GET | `/relatorios/pendencias` | 6–8 | NE |

## Registro mínimo da rodada

```text
Rodada / responsável / data e fuso:
Branch / commit / alterações locais:
Base HTTP / banco e versão, sem credenciais:
Caso ou API-ID / método: Swagger, outro cliente ou suíte:
IDs e chaves de teste usados:
Esperado:
Observado: status, corpo relevante e efeito nos dados:
Resultado: NE | AP | RP | BL
Evidência sem credenciais:
Defeito e reteste, quando houver:
Dados/contas de teste mantidos e senha da conta exclusiva restaurada: sim/não
```

Aprove a rodada somente depois de conciliar respostas e efeitos, registrar os casos bloqueados/reprovados e vincular os testes complementares à versão usada. Este aceite cobre as APIs locais; integração das telas e publicação têm verificações próprias no [guia de entrega](entrega-backend-bianca.md).
