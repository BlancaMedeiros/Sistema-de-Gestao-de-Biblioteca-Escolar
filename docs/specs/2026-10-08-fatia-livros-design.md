# Fatia de livros (acervo) — especificação

**Situação:** proposta para revisão, 08/10/2026. Nada desta fatia foi implementado ainda.
**Branch:** `feature/livros`, com PR para `feat/backend-foundation`. O deploy acontece no merge.

## Objetivo

Persistir o acervo no MySQL e expor as operações que a tela de acervo já oferece com dados fictícios: listar e buscar, cadastrar, editar e excluir livros. É a primeira das quatro fatias de negócio do backend (livros → leitores → empréstimos → dashboard). As fatias seguintes dependem desta.

**Pronto quando:**

- as rotas abaixo aparecem no Swagger;
- os testes de integração passam contra o MySQL do Docker Compose;
- um livro cadastrado continua lá depois de reiniciar a API;
- a tela de acervo consegue trocar o mock pela API sem mudar o que exibe.

## Decisões

| Decisão | Escolha | Motivo |
| --- | --- | --- |
| Disponibilidade | Por quantidade, sem exemplares individuais | Já registrada em `docs/arquitetura.md` |
| Manutenção | Quantidade em manutenção por título (ex.: 1 dos 5) | Escolha do Leonardo em 08/10. É mais fiel que um bloqueio do título inteiro |
| Quantidade disponível | **Calculada** a cada consulta, nunca gravada | Um contador gravado pode ficar dessincronizado, que é o bug do mock atual ao editar o total |
| Status | **Calculado** a partir das quantidades | O formulário nunca deixou escolher status |
| Paginação | Não há; a listagem devolve todos os livros ativos | O acervo tem até ~2 mil títulos (Leonardo, 08/10) |
| Exclusão | Inativa o livro (`ativo = 0`) | Preserva o histórico de empréstimos da fatia 3 |
| ISBN | Opcional e único quando informado | Livros antigos podem não ter ISBN |
| CSRF | Continua fora desta fatia | Ver [Segurança](#segurança) |

### Regra de quantidade e status

```text
disponível = total − em manutenção            (nesta fatia)
disponível = total − em manutenção − emprestados (a partir da fatia de empréstimos)

status = "Disponível"     se disponível > 0
       = "Em Manutenção"  se em manutenção = total
       = "Esgotado"       nos demais casos (só existe a partir da fatia de empréstimos)
```

Sem empréstimos, `disponível = 0` só acontece quando todos os exemplares estão em manutenção, então nesta fatia "Esgotado" não ocorre. Ele entra com a fatia de empréstimos, junto com a contagem que o produz.

Invariante: `0 ≤ em manutenção ≤ total` e `total ≥ 1`. A API valida e devolve 422 com o campo culpado. O banco também tem um `CHECK`, como segunda barreira.

## Banco de dados

`database/migrations/0003_create_livros.sql`, com um único comando DDL, como exige o `migrate.ts`:

```sql
CREATE TABLE livros (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  autor VARCHAR(255) NOT NULL,
  isbn VARCHAR(13) NULL,
  categoria VARCHAR(100) NULL,
  ano_publicacao SMALLINT UNSIGNED NULL,
  quantidade_total INT UNSIGNED NOT NULL,
  quantidade_manutencao INT UNSIGNED NOT NULL DEFAULT 0,
  estante VARCHAR(60) NULL,
  prateleira VARCHAR(60) NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_livros_isbn UNIQUE (isbn),
  CONSTRAINT ck_livros_quantidades CHECK (quantidade_total >= 1 AND quantidade_manutencao <= quantidade_total),
  INDEX idx_livros_ativo_titulo (ativo, titulo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

- `UNIQUE (isbn)` aceita vários `NULL`, então livros sem ISBN não conflitam entre si.
- A collation `utf8mb4_0900_ai_ci` fica explícita para a busca ignorar maiúsculas e acentos igual no MySQL local e no Aiven: "memorias" encontra "Memórias".
- O ISBN é gravado normalizado: só dígitos e `X` maiúsculo, sem hífens nem espaços.

## API

Todas as rotas ficam sob `/api/v1` e exigem sessão (`requireAuth` aplicado no router), devolvendo **401 `NAO_AUTENTICADO`** sem ela. As respostas seguem o padrão do módulo `auth`: `{ data }` no sucesso e `{ error: { code, message, fields? } }` no erro.

### Formato do livro

```json
{
  "id": 7,
  "titulo": "Grande Sertão: Veredas",
  "autor": "João Guimarães Rosa",
  "isbn": "9788520938348",
  "categoria": "Literatura Brasileira",
  "anoPublicacao": 1956,
  "quantidadeTotal": 2,
  "quantidadeManutencao": 0,
  "quantidadeDisponivel": 2,
  "status": "Disponível",
  "estante": "Estante 03",
  "prateleira": "Prateleira A"
}
```

`isbn`, `categoria`, `anoPublicacao`, `estante` e `prateleira` podem ser `null`. Os campos `quantidadeDisponivel` e `status` só aparecem na resposta. Se vierem no corpo da requisição, são ignorados.

### Rotas

| Rota | Sucesso | Erros |
| --- | --- | --- |
| `GET /livros?busca=texto` | 200, livros ativos em ordem de título | — |
| `GET /livros/:id` | 200 | 404 |
| `POST /livros` | 201, livro criado | 409, 422 |
| `PATCH /livros/:id` | 200, livro atualizado | 404, 409, 422 |
| `DELETE /livros/:id` | 204 | 404 |

- **Busca:** `busca` é opcional, sem espaços nas pontas, com no máximo 100 caracteres (acima disso, 422). Vazia equivale a não informar. Procura o texto em título, autor, ISBN, estante e prateleira (os campos que a tela já pesquisa). `%` e `_` são tratados como texto literal, e a consulta é parametrizada.
- **Cadastro (`POST`):** obrigatórios `titulo`, `autor` e `quantidadeTotal` (inteiro ≥ 1). `quantidadeManutencao` vale 0 por padrão. O ano, se informado, é um inteiro entre 1000 e o ano seguinte ao atual.
- **Texto:** todo campo de texto perde os espaços das pontas e respeita o tamanho da coluna. Título e autor não podem ficar vazios. Nos campos opcionais, texto vazio vira `null`.
- **Edição (`PATCH`):** é parcial, ou seja, só muda os campos enviados. Enviar `null` num campo opcional apaga o valor. Corpo sem nenhum campo conhecido devolve 422. A invariante de quantidade é validada sobre o resultado final, juntando o valor enviado com o já gravado.
- **Exclusão (`DELETE`):** marca `ativo = 0`. O livro some da listagem e de `GET /livros/:id`, mas a linha continua no banco. Excluir um livro já inativo devolve 404.
- **IDs:** um `:id` que não seja inteiro positivo devolve 404, como um livro inexistente.

### Erros

| HTTP | `code` | Quando |
| --- | --- | --- |
| 401 | `NAO_AUTENTICADO` | Sem sessão |
| 404 | `LIVRO_NAO_ENCONTRADO` | ID inexistente, inválido ou de livro inativo |
| 409 | `ISBN_DUPLICADO` | ISBN já usado por outro livro, inclusive inativo |
| 422 | `DADOS_INVALIDOS` | Validação falhou; `fields` indica o campo e a mensagem |

O conflito de ISBN é detectado pelo `ER_DUP_ENTRY` da constraint, como o `provisionar-funcionario.ts` faz com o login. Não há consulta prévia, o que evita corrida entre dois cadastros simultâneos.

## Código

```text
backend/src/modules/livros/
  livro.ts                  # tipos, normalizarIsbn() e paraLivroApi() (quantidade + status), funções puras
  livro.test.ts             # testes de unidade das funções puras
  livros.repository.ts      # SQL parametrizado: listar, buscarPorId, inserir, atualizar, inativar
  livros.routes.ts          # schemas zod, handlers e blocos @openapi
  livros.routes.test.ts     # integração com supertest + MySQL real
backend/src/test-utils/
  agente-autenticado.ts     # cria funcionário de teste, faz login e devolve agent + limpeza
database/migrations/0003_create_livros.sql
```

Alterações em arquivos existentes:

- `app.ts`: monta `livrosRouter` em `/api/v1`.
- `config/swagger.ts`: schemas `Livro` e `LivroEntrada`, e o campo `fields` no schema `Erro`.

O `agente-autenticado.ts` é reaproveitado pelas fatias de leitores e de empréstimos. Ele existe só para os testes, por isso fica fora de `modules/`.

## Testes

**Unidade (`livro.test.ts`)**, com valores escritos à mão:

- `normalizarIsbn`:
  - `"978-85-359-0277-8"` vira `"9788535902778"`;
  - `"85 359 0277 x"` vira `"853590277X"`;
  - `""` e `null` viram `null`;
  - `"123"` e `"abc"` são inválidos.
- `paraLivroApi`:
  - total 5 e manutenção 0 dão 5 disponíveis, "Disponível";
  - total 4 e manutenção 4 dão 0, "Em Manutenção";
  - total 3 e manutenção 1 dão 2, "Disponível".

**Integração (`livros.routes.test.ts`)**, com supertest contra o MySQL do Compose:

1. Sem sessão, `GET` e `POST /livros` devolvem 401.
2. Um `POST` válido devolve 201 com quantidade disponível e status calculados. O `GET /livros/:id` em seguida devolve o mesmo livro.
3. `POST` sem título devolve 422 com `fields.titulo`.
4. `POST` com ISBN já cadastrado, mesmo escrito com hífens, devolve 409, e só existe uma linha com aquele ISBN.
5. Dois `POST` sem ISBN devolvem 201 nos dois casos.
6. `POST` com manutenção maior que o total devolve 422.
7. A busca encontra pelo autor ignorando acento, não traz livros que não batem e não traz inativos.
8. Uma busca contendo `%` não age como curinga.
9. `PATCH` de um campo só o altera e mantém os demais.
10. `PATCH` com total abaixo da manutenção já gravada devolve 422, e o banco fica inalterado.
11. `PATCH` com o ISBN de outro livro devolve 409.
12. `GET`, `PATCH` e `DELETE` com ID inexistente devolvem 404.
13. Depois de um `DELETE` (204), `GET /livros/:id` devolve 404, o livro sai da listagem e a linha continua no banco com `ativo = 0`.

Os arquivos de teste rodam em paralelo contra o mesmo banco. Por isso cada teste:

- cria os próprios livros com um prefixo único no título;
- apaga esses livros ao final;
- verifica a presença ou ausência dos próprios registros, nunca a contagem total da tabela.

## Segurança

- **Autenticação:** todas as rotas exigem sessão. Continua existindo um único papel de funcionário.
- **SQL:** todas as consultas são parametrizadas, inclusive a busca.
- **CSRF:** continua fora desta fatia, embora `docs/arquitetura.md` (item 6) previsse tratá-lo quando surgissem rotas de escrita. O risco atual é baixo por dois motivos:
  - o cookie é `SameSite=Lax`, então não acompanha um POST feito a partir de outro site;
  - a API só lê corpo `application/json`, e um formulário de outro site não consegue enviar esse tipo sem uma pré-verificação CORS, que o backend não libera.

  Reavaliar antes da entrega final, junto com o limite de tentativas de login.
- **Erros 500:** continuam saindo no formato padrão do Express (HTML). A tela trata isso como erro genérico. Um tratador de erros em JSON é melhoria separada.

## Contrato para a tela de acervo (frontend)

Esta parte é da Bianca e não faz parte desta entrega do backend. Fica registrada para a troca do mock ser direta:

- O `AcervoService` passa a chamar `GET/POST/PATCH/DELETE ${environment.apiUrl}/livros`.
- Livro sem ISBN deve ser enviado com `isbn: null` ou `""`. O valor fixo `000-0000000000` usado hoje faria o segundo livro sem ISBN receber 409.
- O formulário ganha o campo "Quantidade em manutenção". `status` e `quantidadeDisponivel` não precisam mais ser enviados.
- "Excluir" passa a inativar. A confirmação atual da tela continua fazendo sentido.
- As respostas 409 e 422 devem aparecer na tela usando `error.message` e `error.fields`, sem apagar o que foi digitado.

## Fora do escopo

- Integração da tela (frontend), descrita acima.
- Contagem de emprestados e o status "Esgotado" (fatia de empréstimos).
- Bloquear a exclusão de livro com empréstimo aberto (fatia de empréstimos, caso B11 do plano de testes).
- Reativar um livro inativo ou reaproveitar o ISBN dele.
- Paginação, importação por CSV e seed de livros para desenvolvimento.
