# Mapa inicial de endpoints

**Situação:** proposta para validação do grupo. As rotas de negócio abaixo ainda não foram implementadas.

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
| Sessão | `POST /api/v1/auth/login` | Iniciar a sessão de um funcionário | Disponível (testado localmente; ainda não implantado) |
| Sessão | `POST /api/v1/auth/logout` | Encerrar a sessão atual | Disponível (testado localmente; ainda não implantado) |
| Sessão | `GET /api/v1/me` | Obter perfil e permissões da sessão atual | Disponível (testado localmente; ainda não implantado) |
| Perfil | `PATCH /api/v1/me` | Atualizar dados permitidos do próprio perfil | Proposta |
| Perfil | `PUT /api/v1/me/senha` | Alterar a própria senha | Proposta |
| Funcionários | `POST /api/v1/funcionarios` | Cadastrar outro funcionário com a mesma permissão | Proposta |
| Acervo | `GET /api/v1/livros`<br>`POST /api/v1/livros` | Listar, buscar e cadastrar livros | Proposta |
| Acervo | `GET /api/v1/livros/:id`<br>`PATCH /api/v1/livros/:id`<br>`DELETE /api/v1/livros/:id` | Consultar, editar ou inativar um livro | Proposta |
| Leitores | `GET /api/v1/usuarios`<br>`POST /api/v1/usuarios` | Listar, buscar e cadastrar leitores | Proposta |
| Leitores | `GET /api/v1/usuarios/:id`<br>`PATCH /api/v1/usuarios/:id` | Consultar, editar ou inativar um leitor | Proposta |
| Leitores | `GET /api/v1/usuarios/:id/emprestimos` | Consultar histórico e pendências de um leitor | Proposta |
| Empréstimos | `GET /api/v1/emprestimos`<br>`POST /api/v1/emprestimos` | Listar e registrar empréstimos | Proposta |
| Empréstimos | `POST /api/v1/emprestimos/:id/renovacoes` | Renovar um empréstimo | Proposta |
| Empréstimos | `POST /api/v1/emprestimos/:id/devolucao` | Registrar a devolução | Proposta |
| Painel | `GET /api/v1/dashboard` | Obter métricas, empréstimos recentes e pendências | Proposta |
| Relatórios | `GET /api/v1/relatorios/pendencias` | Listar empréstimos abertos ou vencidos | Proposta |

## Decisões para validar com o grupo

1. Como será criada a primeira conta e quem poderá cadastrar os demais funcionários? Todas as contas terão a mesma permissão.
2. O prazo padrão de empréstimo será de sete dias? Haverá limite de renovações e bloqueio por atraso?
3. Um livro será controlado somente por quantidade nesta versão? Se o grupo optar por exemplares físicos, o contrato e o banco devem ser revisados antes da implementação.
4. Relatórios, exportação, reservas e notificações ficam fora do MVP, salvo necessidade confirmada?

## Próximo passo após a aprovação

Transformar apenas as rotas aprovadas em contrato OpenAPI, com campos obrigatórios, respostas de erro e exemplos de requisição. O mapa não comprova integração, autenticação ou persistência; ele define o que será implementado.
