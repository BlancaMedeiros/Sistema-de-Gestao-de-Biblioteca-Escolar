# Mapa inicial de endpoints

**Atualizado em 15/10/2026:** todas as operações deste mapa estão implementadas e testadas localmente na `feature/livros`. As APIs novas não foram publicadas. Veja o [contrato completo](specs/2026-10-15-apis-restantes-design.md) e o [QAT](qat-e-proximos-passos.md). Os status de produção da autenticação/perfil abaixo são históricos, sem nova validação pública nesta entrega.

## Objetivo

Definir as operações mínimas da API para orientar a divisão do trabalho entre frontend, backend e banco de dados.

## Convenções propostas

- As rotas de negócio usam o prefixo `/api/v1` e JSON com campos em `camelCase`.
- A primeira versão controla a disponibilidade por **quantidade de livros**, sem identificar exemplares físicos individualmente.
- Alunos e professores são leitores cadastrados; apenas funcionários autorizados acessam o sistema.
- Há um único tipo de acesso: **Funcionário autorizado**. Todo funcionário autenticado tem as mesmas permissões.

## Rotas

| Área | Método e rota | Finalidade | Situação |
| --- | --- | --- | --- |
| Técnica | `GET /api/health` | Verificar se a API está em execução | Disponível |
| Técnica | `GET /api/ready` | Verificar a conexão com o MySQL | Disponível |
| Sessão | `POST /api/v1/auth/login` | Iniciar a sessão de um funcionário | Disponível em produção |
| Sessão | `POST /api/v1/auth/logout` | Encerrar a sessão atual | Disponível em produção |
| Sessão | `GET /api/v1/me` | Obter perfil e permissões da sessão atual | Disponível em produção |
| Perfil | `PATCH /api/v1/me` | Atualizar dados permitidos do próprio perfil | Disponível em produção (só o campo `nome` por enquanto) |
| Perfil | `PUT /api/v1/me/senha` | Alterar a própria senha | Disponível em produção (invalida as demais sessões do funcionário) |
| Funcionários | `POST /api/v1/funcionarios` | Cadastrar outro funcionário com a mesma permissão | Implementado e testado localmente; não publicado |
| Acervo | `GET /api/v1/livros`<br>`POST /api/v1/livros` | Listar, buscar e cadastrar livros | Implementado e testado localmente; não publicado |
| Acervo | `GET /api/v1/livros/:id`<br>`PATCH /api/v1/livros/:id`<br>`DELETE /api/v1/livros/:id` | Consultar, editar ou inativar um livro | Implementado e testado localmente; não publicado |
| Leitores | `GET /api/v1/usuarios`<br>`POST /api/v1/usuarios` | Listar, buscar e cadastrar leitores | Implementado e testado localmente; não publicado |
| Leitores | `GET /api/v1/usuarios/:id`<br>`PATCH /api/v1/usuarios/:id` | Consultar, editar, reativar ou inativar leitor | Implementado e testado localmente; não publicado |
| Leitores | `GET /api/v1/usuarios/:id/emprestimos` | Histórico paginado e resumo de pendências | Implementado e testado localmente; não publicado |
| Empréstimos | `GET /api/v1/emprestimos`<br>`POST /api/v1/emprestimos` | Listar e registrar empréstimos | Implementado e testado localmente; não publicado |
| Empréstimos | `GET /api/v1/emprestimos/:id` | Consultar empréstimo e status atual | Implementado e testado localmente; não publicado |
| Empréstimos | `POST /api/v1/emprestimos/:id/renovacoes` | Renovar um empréstimo | Implementado e testado localmente; não publicado |
| Empréstimos | `POST /api/v1/emprestimos/:id/devolucao` | Registrar a devolução | Implementado e testado localmente; não publicado |
| Painel | `GET /api/v1/dashboard` | Métricas, empréstimos recentes e devoluções do dia | Implementado e testado localmente; não publicado |
| Relatórios | `GET /api/v1/relatorios/pendencias` | Listar empréstimos abertos ou vencidos | Implementado e testado localmente; não publicado |

## Decisões confirmadas para esta implementação

1. Primeira conta por comando; demais também por API autenticada. Um único nível de acesso.
2. Prazo de sete dias corridos, até três empréstimos abertos e duas renovações de mais sete dias sobre o vencimento. Atrasos bloqueiam empréstimos e renovações.
3. Controle por quantidade; inativação de livro/leitor exige ausência de empréstimos abertos.
4. Relatório de pendências implementado. Exportação, reservas e notificações continuam fora do escopo.

## Próximo passo

Executar o QAT manual pelo Swagger, integrar as telas e revisar a publicação. O contrato OpenAPI acompanha o código; testes e evidências constam no QAT. Implementação local não comprova disponibilização em produção.
