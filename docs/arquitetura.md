# Arquitetura técnica

**Estado:** fundação local implementada; regras de negócio, migrations, autenticação e Swagger ainda não foram implementados.

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

## Próximas decisões e entregas

1. Versionar migrations, massa fictícia e banco de testes separado.
2. Definir o contrato OpenAPI e disponibilizar Swagger UI.
3. Implementar usuários, livros por quantidade e operações de empréstimo.
4. Substituir os mocks Angular por serviços HTTP.
5. Implementar autenticação e autorização antes de qualquer publicação.
