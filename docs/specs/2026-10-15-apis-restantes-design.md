# Contrato das APIs da biblioteca

**Implementado e validado localmente em 15/10/2026.** Esta entrega completa as operações do [mapa de endpoints](../mapa-inicial-de-endpoints.md), sobre a base de livros. Regras de empréstimo confirmadas pelo Leonardo nesta sessão. Não houve publicação nem alteração de dados de produção. O [QAT](../qat-e-proximos-passos.md) contém o roteiro de teste e as evidências.

**Revisão de 16/10:** [QAT aprovado para integração local](../qat-resultado-2026-10-16.md). `PATCH /me` aceita nome de 1 a 120 caracteres após aparar espaços e devolve 422 acima do limite. Charset/compactação de conteúdo não suportados devolvem 415 estruturado; as respostas 413 e 500 genérico têm testes explícitos.

**Revisão de compatibilidade com as telas, também em 16/10:** perfil completo com contatos, vínculo explícito com leitor e indicadores pessoais; localização e nomes de exibição nos empréstimos. Veja o [contrato dessas alterações](2026-10-16-aderencia-frontend.md) e o [QAT atualizado](../qat-resultado-2026-10-16-frontend.md).

## Escopo e regras confirmadas

- Uma biblioteca, controlada por quantidade, sem exemplares físicos individuais.
- Leitor não tem conta de acesso. Funcionários autenticados e ativos têm um único nível de permissão e podem cadastrar outros funcionários com o mesmo nível.
- Até **3 empréstimos abertos por leitor**, contando os atrasados. Uma operação empresta uma unidade do livro; é permitido ao mesmo leitor retirar mais de uma unidade, respeitando estoque e limite global.
- Prazo inicial de **7 dias corridos** a partir de hoje em `America/Sao_Paulo`. Datas iniciais e funcionário são definidos pelo servidor.
- Até **2 renovações** por empréstimo, cada uma acrescentando **7 dias ao vencimento anterior**.
- Se houver qualquer empréstimo atrasado do leitor, bloquear novo empréstimo e qualquer renovação, até devolver os atrasados. Vencimento igual a hoje ainda está em dia.
- Livro ou leitor com empréstimo aberto não pode ser inativado. Devolução continua permitida para atrasados e registros legados inativos.
- Disponibilidade: `total − manutenção − empréstimos abertos`. Nunca gravar saldo informado pelo cliente. Total não pode ficar abaixo de manutenção mais emprestados.
- Status do livro: `Disponível` se houver saldo; `Em Manutenção` se todas as unidades estiverem em manutenção; `Esgotado` nos demais casos sem saldo.
- Status do empréstimo é calculado a cada leitura: `Devolvido` se devolução registrada, `Atrasado` se aberto com vencimento anterior a hoje, `Em Andamento` nos demais casos.

As decisões acima substituem as hipóteses antigas dos relatórios de setembro sobre exemplares individuais, permissões diferentes e limites ainda indefinidos. O [índice do workspace](../../../relatorios/00-leia-primeiro.markdown) mantém esse histórico sem tratá-lo como estado atual.

## Convenções HTTP

Base `/api/v1`. JSON com campos em `camelCase`. Sucesso de item: `{ data }`. Listagem paginada: `{ data: [], pagination: { page, pageSize, total } }`. Erro: `{ error: { code, message, fields? } }`.

IDs inteiros positivos; datas civis em `YYYY-MM-DD`. Formatação `DD/MM/YYYY` pertence ao frontend. Campos desconhecidos são ignorados nos cadastros/edições de livros, leitores e funcionários; não podem conceder privilégios ou definir saldo/datas de movimentação. Renovação/devolução aceitam corpo ausente ou `{}`, sem comandos adicionais.

Listagens de leitores, empréstimos, histórico e relatório aceitam `page` (padrão 1) e `pageSize` (padrão 20, máximo 100). Livros continuam sem paginação, conforme decisão anterior. Busca é literal, limitada a 100 caracteres, com escape de `%`, `_` e `!`, consultas parametrizadas e collation que ignora caixa/acentos. Parâmetros repetidos/arrays e intervalos inválidos são rejeitados.

## Funcionários

`POST /funcionarios`, autenticado. Entrada:

```json
{ "nome": "Funcionária de demonstração", "login": "funcionaria.demo", "senha": "EscolhaUmaSenha" }
```

Nome até 120 caracteres; login até 60, sem espaços; senha de 8 a 1024 caracteres. Contatos `email`/`telefone` e vínculo `usuarioId` são opcionais. Resposta **201** com o perfil completo descrito abaixo, sem senha/hash. Login repetido dá **409 `LOGIN_DUPLICADO`**, sem modificar a conta. Vínculo inexistente dá 404; leitor já vinculado a outra conta dá 409 `LEITOR_JA_VINCULADO`, sem cadastro parcial. Campos `papel`/`admin` não concedem acesso diferente. A primeira conta continua podendo ser provisionada pelo comando local já existente.

O middleware verifica se o funcionário da sessão ainda existe e está ativo. Conta inativada perde a sessão e recebe 401 nas APIs protegidas.

## Meu Perfil

Login, `GET /me`, `PATCH /me` e criação de funcionário retornam `data: { id, nome, login, email, telefone, usuarioId, matricula, cargo, emprestimosAtivos, historicoTotal }`. Contatos e IDs de vínculo/matrícula podem ser `null`; `cargo` é sempre `Funcionário autorizado`. Os contadores pertencem ao leitor explicitamente vinculado, não aos empréstimos operados pelo funcionário; sem vínculo, são zero. `historicoTotal` conta empréstimos, sem comprovar leitura.

`PATCH /me` aceita ao menos um entre `nome`, `email`, `telefone`, `usuarioId`. Omitidos são preservados, contato vazio/null é apagado, vínculo null é removido sem apagar o leitor ou histórico. Nome tem 1–120 caracteres, email válido até 254 e telefone até 30. Uma conta tem no máximo um leitor e um leitor tem no máximo uma conta; não existe associação implícita por IDs iguais ou contatos semelhantes. `matricula` vem de `/usuarios`; `cargo`, login e contadores não são editáveis por `/me`. Contatos da conta não alteram os contatos do leitor. Detalhes e exemplos no [contrato para as telas](2026-10-16-aderencia-frontend.md).

Senha continua em `PUT /me/senha` com `senhaAtual` e `novaSenha` de pelo menos oito caracteres. O PATCH de perfil não troca senha. Permanece a invalidação das demais sessões após troca bem-sucedida.

## Leitores

| Operação | Comportamento |
| --- | --- |
| `GET /usuarios` | Lista ativos e inativos, ordenados por nome/ID, com `busca`, `tipo`, `status` e paginação |
| `POST /usuarios` | Cria leitor; nome, matrícula e tipo obrigatórios; status padrão `Ativo` |
| `GET /usuarios/:id` | Consulta leitor, inclusive inativo |
| `PATCH /usuarios/:id` | Edição parcial, inativação ou reativação via status; exige ao menos um campo editável |
| `GET /usuarios/:id/emprestimos` | Histórico paginado, incluindo devolvidos; resumo de todos os empréstimos do leitor |

Tipos: `Aluno`, `Professor`, `Bibliotecário`. Status: `Ativo`, `Inativo`. Nome até 160 caracteres; matrícula até 60, única inclusive entre inativos; e-mail opcional e válido até 254; telefone opcional até 30; turma opcional até 100. Texto é aparado; contato/turma vazios viram `null`. `null` no PATCH apaga um opcional. Contato compartilhado entre leitores é permitido. `dataCadastro` é gerada no servidor.

```json
{
  "nome": "Leitora de teste",
  "matricula": "QAT-001",
  "tipo": "Aluno",
  "email": null,
  "telefone": null,
  "turma": "5A"
}
```

Cadastro retorna 201; consultas/edição, 200. Erros: 404 `USUARIO_NAO_ENCONTRADO`, 409 `MATRICULA_DUPLICADA` ou `USUARIO_COM_EMPRESTIMOS`, 422 `DADOS_INVALIDOS`. Histórico retorna também `resumo: { totalEmprestimos, emprestimosAtivos, atrasados }`, calculado sobre todo o histórico, independentemente dos filtros da página.

## Empréstimos

| Operação | Entrada e resposta |
| --- | --- |
| `GET /emprestimos` | Lista paginada; mais recentes por criação/ID primeiro |
| `GET /emprestimos/:id` | Item com status calculado no dia da consulta |
| `POST /emprestimos` | `{ livroId, usuarioId }`; retorna 201 com empréstimo criado |
| `POST /emprestimos/:id/renovacoes` | Corpo ausente ou `{}`; retorna 200 com o novo prazo e contador |
| `POST /emprestimos/:id/devolucao` | Corpo ausente ou `{}`; retorna 200 com data de devolução e operador |

As três escritas exigem `Idempotency-Key` no header. A listagem aceita `busca` por título/nome/matrícula, `usuarioId`, `livroId`, `status`, `vencimentoDe`, `vencimentoAte` e paginação. Status de filtro: `Em Andamento`, `Atrasado`, `Devolvido`, `Abertos` (inclui em dia e atrasados). Os limites de vencimento são inclusivos e devem formar um intervalo válido.

DTO retornado:

```json
{
  "data": {
    "id": 1,
    "livroId": 1,
    "livroTitulo": "Livro de teste",
    "livro": "Livro de teste",
    "livroEstante": "E1",
    "livroPrateleira": "P2",
    "livroLocalizacao": "E1 - P2",
    "usuarioId": 1,
    "usuarioNome": "Leitora de teste",
    "usuario": "Leitora de teste",
    "funcionarioId": 1,
    "dataEmprestimo": "2026-10-15",
    "devolucaoPrevista": "2026-10-22",
    "devolucaoReal": null,
    "devolvidoPor": null,
    "quantidadeRenovacoes": 0,
    "status": "Em Andamento"
  }
}
```

IDs/datas do exemplo são ilustrativos. Erros 404 indicam referência inexistente/ID inválido. Conflitos 409: `USUARIO_INATIVO`, `LIVRO_INATIVO`, `LIVRO_INDISPONIVEL`, `USUARIO_COM_ATRASOS`, `LIMITE_EMPRESTIMOS`, `LIMITE_RENOVACOES`, `EMPRESTIMO_DEVOLVIDO`, `CHAVE_IDEMPOTENCIA_REUTILIZADA`. Entradas ou header inválidos dão 422.

Nomes de exibição `livro`/`usuario` equivalem a `livroTitulo`/`usuarioNome`. Localização faz parte de todos os DTOs de empréstimo, inclusive dashboard, pendências e histórico de livro inativo. Reflete o cadastro atual, sem depender de buscar o livro no acervo ativo. Partes ausentes usam `S/E`/`S/P`; ambas ausentes dão `Não informada`, com campos separados nulos. A resposta idempotente repetida conserva o corpo original; usar GET para os campos e localização atuais.

### Retentativas e concorrência

Uma intenção nova recebe uma chave nova; uma retentativa reaproveita a mesma chave e os mesmos dados. A chave tem de 1 a 100 caracteres ASCII entre letras, números, `.`, `_`, `:`, `-`; UUID é uma opção. Diferencia maiúsculas de minúsculas.

O registro é único por funcionário, operação/recurso e chave. Efeito, histórico e resposta são gravados na mesma transação. Retentativas, inclusive concorrentes, retornam o mesmo status/corpo sem criar empréstimo ou renovar/devolver duas vezes. Mesma chave com outros dados dá 409. Falhas não gravam resultado de sucesso e podem ser tentadas novamente após resolver o motivo. Resultados de sucesso ficam retidos sem expiração automática nesta versão.

A resposta reapresentada é a original: para obter o estado atual após outra movimentação ou passagem de dias, usar GET. Uma devolução repetida com **chave diferente** é nova intenção e recebe 409; com a chave original, recebe o mesmo 200.

Após os locks de idempotência/FK do funcionário, as movimentações bloqueiam leitor → livro → empréstimo, com isolamento READ COMMITTED, para validar os dados após adquirir os locks. Isso protege tanto a última unidade quanto o limite de três empréstimos em livros diferentes. Edição/inativação de livros e leitores participam do mesmo controle. O PATCH do perfil bloqueia funcionário antes de validar o leitor, respeitando a ordem implícita da FK de idempotência para evitar deadlock com empréstimos do mesmo operador. Leituras de listagens/indicadores usam um snapshot consistente.

## Dashboard e pendências

`GET /dashboard` retorna `{ data: { dataReferencia, metricas, ultimosEmprestimos, devolucoesHoje } }`.

| Métrica | Regra |
| --- | --- |
| `totalAcervo` | Soma de unidades de livros ativos, inclusive em manutenção; não é a contagem de títulos |
| `emprestimosAtivos` | Todos os abertos, incluindo atrasados |
| `devolucoesPendentes` | Abertos com vencimento anterior ao dia da escola |
| `usuariosAtivos` | Leitores ativos, sem contar contas de funcionários separadamente |
| `devolucoesHoje` | Abertos com vencimento igual ao dia da escola |

`ultimosEmprestimos` contém até quatro movimentações mais recentes por criação/ID. `devolucoesHoje` contém até vinte registros; a métrica informa o total. Para percorrer todas as devoluções previstas do dia, usar o relatório com os dois limites de vencimento iguais a `dataReferencia`.

`GET /relatorios/pendencias` aceita os filtros da listagem de empréstimos e paginação, com status padrão `Abertos`. Não aceita `Devolvido`. O histórico e as métricas continuam disponíveis depois da inativação de livros/leitores, porque a exclusão é lógica e as relações não apagam empréstimos em cascata.

## Banco, erros e limites da entrega

Migrations novas, um DDL por arquivo: 0004 usuários, 0005 empréstimos, 0006 renovações, 0007 idempotência. Chaves estrangeiras preservam histórico; as migrations publicadas foram preservadas para evoluir o schema por arquivos novos.

A revisão para o frontend acrescenta 0008 (contatos e coluna de vínculo) e 0009 (unicidade/FK do vínculo), mantendo as migrations publicadas 0001–0007 intactas. A separação foi validada em instalação do zero e upgrade no MySQL/TiDB locais.

Dados de teste e transações foram verificados em MySQL 8.4 e TiDB v8.5.3 locais. No TiDB descartável, `tidb_enable_check_constraint` foi habilitado para testar a barreira CHECK; a configuração do TiDB Cloud permanece sem nova verificação/alteração nesta entrega. A API aplica as regras independentemente do CHECK. [Condição de ativação documentada pelo TiDB](https://docs.pingcap.com/tidb/stable/constraints/#check).

Erros internos agora retornam JSON genérico com código `ERRO_INTERNO`, sem SQL ou credenciais na resposta. JSON malformado retorna 400; corpo acima do limite retorna 413. SQL continua parametrizado.

Integração das telas, correção dos testes Angular já falhos, CSRF completo, limitação de tentativas de login, reservas, multas, notificações, exportação CSV e publicação não fazem parte desta entrega de APIs. Não há endpoint de exemplares individuais, conforme o modelo por quantidade já escolhido.
