# Contrato para atender às telas atuais

Revisão do backend em 16/10/2026, na `feature/livros`. Complementa o [contrato das APIs](2026-10-15-apis-restantes-design.md) e o [guia para Bianca](../entrega-backend-bianca.md). A comparação usa os componentes, modelos e serviços Angular desta branch. As telas continuam com mocks nas áreas novas; estes ajustes disponibilizam os dados para sua integração HTTP.

## Meu Perfil

Login, `GET /me`, `PATCH /me` e criação de funcionário retornam o mesmo formato em `data`, sem senha ou hash:

```json
{
  "data": {
    "id": 42,
    "nome": "Funcionária da biblioteca",
    "login": "funcionaria.demo",
    "email": "funcionaria@example.test",
    "telefone": "(11) 90000-0000",
    "usuarioId": 81,
    "matricula": "FUNC-081",
    "cargo": "Funcionário autorizado",
    "emprestimosAtivos": 1,
    "historicoTotal": 4
  }
}
```

IDs e contatos são ilustrativos. `id` identifica a conta de funcionário; `usuarioId` identifica o leitor explicitamente associado. Números iguais nas duas tabelas não estabelecem associação. Email, nome ou matrícula semelhantes também não vinculam cadastros automaticamente.

| Campo | Origem e regra |
| --- | --- |
| `nome`, `login` | Conta autenticada; login não é editável nesta API |
| `email`, `telefone` | Contatos da conta, independentes dos contatos do leitor; opcionais e anuláveis |
| `usuarioId` | Vínculo opcional com leitor existente, exclusivo: uma conta por leitor e um leitor por conta |
| `matricula` | Matrícula atual do leitor vinculado; `null` sem vínculo; não é editada por `/me` |
| `cargo` | `Funcionário autorizado`, informativo e não editável; permanece um único nível de acesso |
| `emprestimosAtivos` | Empréstimos abertos do leitor vinculado, incluindo atrasados |
| `historicoTotal` | Todos os empréstimos do leitor vinculado, incluindo devolvidos; não comprova livros lidos |

Sem vínculo, `usuarioId` e `matricula` são `null` e os dois contadores são zero. Empréstimos registrados pelo funcionário **para outros leitores** não entram nesses indicadores. Um leitor inativo pode continuar associado para consultar seu histórico; isso não libera novos empréstimos para ele.

`PATCH /me` aceita qualquer combinação não vazia dos campos editáveis:

```json
{ "email": "funcionaria@example.test", "telefone": "(11) 90000-0000", "usuarioId": 81 }
```

Também aceita `nome` entre 1 e 120 caracteres, após aparar espaços. Email tem até 254 caracteres e precisa ser válido; telefone, até 30. Omitir preserva o valor; `null` ou texto vazio apaga um contato. `usuarioId: null` remove o vínculo, preservando o leitor e seus empréstimos. Contatos da conta e do leitor não são sincronizados.

Vínculo inexistente retorna 404 `USUARIO_NAO_ENCONTRADO`; leitor já associado a outra conta retorna 409 `LEITOR_JA_VINCULADO`. A operação inteira é revertida nesses casos, inclusive contatos enviados juntos. A criação de conta por `POST /funcionarios` aceita os mesmos contatos e vínculo opcionais; logins repetidos continuam retornando 409 `LOGIN_DUPLICADO`.

Campos calculados, login, identidade e permissões enviados junto de um campo válido são ignorados. Um PATCH sem nenhum campo editável retorna 422. `novaSenha` não é um atalho para trocar senha: usar `PUT /me/senha` com `senhaAtual` e `novaSenha` de pelo menos oito caracteres. O formulário atual precisa acrescentar a senha atual para essa ação.

O vínculo pode ser informado na criação da conta ou no PATCH do próprio perfil, por funcionário autenticado. Não foi criada uma tela de associação nem uma API de administração de outras contas. Antes de integrar os indicadores pessoais, identificar o cadastro de leitor correto e informar seu ID explicitamente.

## Localização nos empréstimos

Todos os DTOs de empréstimo passam a incluir:

```json
{
  "livroTitulo": "Livro de exemplo",
  "livro": "Livro de exemplo",
  "usuarioNome": "Leitora de exemplo",
  "usuario": "Leitora de exemplo",
  "livroEstante": "E1",
  "livroPrateleira": "P2",
  "livroLocalizacao": "E1 - P2"
}
```

Isso se aplica a criação, renovação, devolução, detalhe, listagem, histórico do leitor, dashboard e relatório de pendências. `livro`/`usuario` são nomes de exibição equivalentes a `livroTitulo`/`usuarioNome`, compatíveis com o modelo de empréstimos recentes do painel.

A tela pode exibir `livroLocalizacao` diretamente, sem procurar o livro na lista de acervo ativo. A localização continua disponível quando o livro é inativado após a devolução. Ela corresponde ao cadastro **atual** do livro; não é uma fotografia da localização na data do empréstimo. Nomes de livro/leitor também refletem seus cadastros atuais.

Partes ausentes usam `S/E` ou `S/P`; ambas ausentes resultam em `Não informada`. Os campos separados permanecem `null` quando não preenchidos. Uma resposta idempotente repetida mantém o corpo original, inclusive localização anterior ou ausência dos novos campos em operações antigas. Usar GET para consultar o estado atual.

## Ajustes que continuam no frontend

| Tela/serviço | Integração necessária |
| --- | --- |
| Meu Perfil | Consumir `/me`; salvar contatos por PATCH e usar a resposta; exibir matrícula nula como ausência; trocar senha por ação separada com senha atual; atualizar indicadores consultando a API |
| Rótulo `Total de Leituras` | Preferir `Total de empréstimos`, pois o contador não mede leitura concluída |
| Login/sessão | Restaurar por `/me` após F5, encerrar por `/auth/logout` e tratar 401; não derivar leitor pelo ID da conta nem usar localStorage como confirmação de sessão |
| Empréstimos e painel | Consumir a localização retornada e os nomes de exibição; consultar novamente após movimentação |
| Cadastro de empréstimo | Enviar somente os IDs; datas/prazo, operador, saldo e status pertencem ao servidor; apresentar o prazo de sete dias como informação |
| Escritas de empréstimo | Uma `Idempotency-Key` por intenção; manter a chave em retentativa e impedir clique duplo enquanto aguarda |
| Seletor de leitores/histórico/listas | Buscar por texto e percorrer páginas; padrão 20, máximo 100 por página; não tratar uma única página como cadastro completo |
| Acervo e contatos | Tratar opcionais anuláveis como ISBN/email; saldo e status vêm da API; manutenção é suportada no backend, mas não tem campo no formulário atual |
| Formulários em geral | Aguardar sucesso para mostrar confirmação; apresentar 422/409, preservar dados em falha e atualizar a lista depois de salvar |

Nenhuma regra já confirmada foi alterada: três empréstimos simultâneos, duas renovações, sete dias, bloqueio por atraso e bloqueio de inativação com empréstimo aberto. A autenticação continua restrita a funcionários; cadastrar leitor não cria login.

## Banco e verificação

Migration 0008 adiciona contatos e `usuario_id` anulável em `funcionarios`; 0009 adiciona unicidade e chave estrangeira para `usuarios`. Arquivos separados permitem executar no MySQL e no TiDB. As contas existentes permanecem sem vínculo e com contatos nulos até preenchimento explícito; as migrations 0001–0007 não foram alteradas.

Os testes em `perfil-funcionario.test.ts` verificam validação, persistência, isolamento dos cadastros, contadores, rollback e concorrência. `emprestimos.routes.test.ts` cobre localização em todos os consumidores, inativação, partes ausentes e resposta idempotente original. O [QAT desta revisão](../qat-resultado-2026-10-16-frontend.md) registra resultados e limitações.
