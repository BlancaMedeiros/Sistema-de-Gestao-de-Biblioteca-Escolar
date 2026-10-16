import path from 'node:path';
import { fileURLToPath } from 'node:url';

import swaggerJSDoc from 'swagger-jsdoc';
import { componentesNegocio } from './schemas-negocio.js';

const configDir = path.dirname(fileURLToPath(import.meta.url));

const propriedadesLivro = {
  titulo: {
    type: 'string',
    minLength: 1,
    maxLength: 255,
    example: 'Memórias Póstumas de Brás Cubas',
  },
  autor: { type: 'string', minLength: 1, maxLength: 255, example: 'Machado de Assis' },
  isbn: {
    type: 'string',
    nullable: true,
    description:
      'ISBN-10 ou ISBN-13; hífens e espaços são removidos. Opcional, sem validação do dígito de controle.',
    example: '9788520932223',
  },
  categoria: { type: 'string', nullable: true, maxLength: 100 },
  anoPublicacao: {
    type: 'integer',
    nullable: true,
    minimum: 1000,
    description: 'Até o ano seguinte ao atual.',
  },
  quantidadeTotal: { type: 'integer', minimum: 1, maximum: 4294967295, example: 5 },
  quantidadeManutencao: {
    type: 'integer',
    minimum: 0,
    maximum: 4294967295,
    default: 0,
    description: 'Não pode exceder o total.',
    example: 1,
  },
  estante: { type: 'string', nullable: true, maxLength: 60, example: 'Estante 01' },
  prateleira: { type: 'string', nullable: true, maxLength: 60, example: 'Prateleira A' },
};
const respostaErro = (description: string) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
});

// A base do OpenAPI é /api/v1, mesmo prefixo com que as rotas de negócio
// são montadas no Express — cada arquivo *.routes.ts documenta seus
// caminhos relativos a essa base em um bloco JSDoc @openapi acima do
// handler. O contrato cresce endpoint a endpoint, sem precisar manter um
// YAML separado.
const definition = {
  openapi: '3.0.3',
  info: {
    title: 'API do Sistema de Gestão de Biblioteca Escolar',
    version: '0.1.0',
    description:
      'Contrato das 23 operações de negócio, gerado a partir das rotas implementadas. ' +
      'Inclui autenticação, perfil, funcionários, livros, leitores, empréstimos, dashboard e pendências.',
  },
  servers: [{ url: '/api/v1', description: 'Prefixo de todas as rotas de negócio' }],
  components: {
    securitySchemes: {
      sessao: {
        type: 'apiKey',
        in: 'cookie',
        name: '__session',
        description: 'Faça login na mesma origem antes de executar as rotas protegidas.',
      },
    },
    parameters: {
      ...componentesNegocio.parameters,
      LivroId: {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'integer', minimum: 1, maximum: 4294967295 },
      },
    },
    responses: {
      ...componentesNegocio.responses,
      SemSessao: respostaErro('401 NAO_AUTENTICADO: sessão ausente ou expirada.'),
      DadosInvalidos: respostaErro(
        '422 DADOS_INVALIDOS: fields indica os campos inválidos; corpo indica erro no objeto inteiro.',
      ),
      LivroNaoEncontrado: respostaErro(
        '404 LIVRO_NAO_ENCONTRADO: ID inválido, inexistente ou livro inativo.',
      ),
      IsbnDuplicado: respostaErro(
        '409 ISBN_DUPLICADO: ISBN reservado por outro livro, inclusive inativo.',
      ),
      LivroEncontrado: {
        description: 'Livro ativo com disponibilidade calculada.',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { data: { $ref: '#/components/schemas/Livro' } },
            },
          },
        },
      },
    },
    schemas: {
      ...componentesNegocio.schemas,
      LivroEntrada: {
        type: 'object',
        description:
          'Texto é aparado; opcionais vazios viram null. Campos desconhecidos, status e quantidadeDisponivel são ignorados.',
        properties: propriedadesLivro,
      },
      LivroCadastro: {
        allOf: [{ $ref: '#/components/schemas/LivroEntrada' }],
        required: ['titulo', 'autor', 'quantidadeTotal'],
      },
      LivroEdicao: {
        allOf: [{ $ref: '#/components/schemas/LivroEntrada' }],
        minProperties: 1,
        description:
          'Ao menos um campo editável; null apaga um campo opcional. As quantidades são validadas após combinar com o registro atual.',
      },
      Livro: {
        type: 'object',
        required: ['id', ...Object.keys(propriedadesLivro), 'quantidadeDisponivel', 'status'],
        properties: {
          id: { type: 'integer', readOnly: true },
          ...propriedadesLivro,
          quantidadeDisponivel: {
            type: 'integer',
            readOnly: true,
            description: 'Total menos manutenção e empréstimos abertos; calculado pelo servidor.',
          },
          status: {
            type: 'string',
            readOnly: true,
            enum: ['Disponível', 'Em Manutenção', 'Esgotado'],
          },
        },
      },
      FuncionarioPerfil: {
        type: 'object',
        required: [
          'id',
          'nome',
          'login',
          'email',
          'telefone',
          'usuarioId',
          'matricula',
          'cargo',
          'emprestimosAtivos',
          'historicoTotal',
        ],
        properties: {
          id: { type: 'integer', example: 1 },
          nome: { type: 'string', example: 'Ana Bibliotecária' },
          login: { type: 'string', example: 'ana.bibliotecaria' },
          email: { type: 'string', format: 'email', maxLength: 254, nullable: true },
          telefone: { type: 'string', maxLength: 30, nullable: true },
          usuarioId: {
            type: 'integer',
            minimum: 1,
            nullable: true,
            description: 'Vínculo explícito ao leitor; não é inferido pelo ID, nome ou e-mail.',
          },
          matricula: {
            type: 'string',
            nullable: true,
            readOnly: true,
            description: 'Do leitor vinculado; null quando não há vínculo.',
          },
          cargo: { type: 'string', enum: ['Funcionário autorizado'], readOnly: true },
          emprestimosAtivos: {
            type: 'integer',
            minimum: 0,
            readOnly: true,
            description:
              'Empréstimos abertos do leitor vinculado, inclusive atrasados; zero sem vínculo.',
          },
          historicoTotal: {
            type: 'integer',
            minimum: 0,
            readOnly: true,
            description:
              'Total de empréstimos do leitor vinculado, não livros comprovadamente lidos; zero sem vínculo.',
          },
        },
      },
      Erro: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'CREDENCIAIS_INVALIDAS' },
              message: { type: 'string', example: 'Login ou senha incorretos.' },
              fields: {
                type: 'object',
                additionalProperties: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
    },
  },
};

export const swaggerSpec = swaggerJSDoc({
  definition,
  // O glob usa barras normais também no Windows; barras invertidas podem
  // ser interpretadas como escapes e gerar um contrato sem nenhuma rota.
  apis: [path.join(configDir, '..', 'modules', '**', '*.routes.{ts,js}').replaceAll('\\', '/')],
});
