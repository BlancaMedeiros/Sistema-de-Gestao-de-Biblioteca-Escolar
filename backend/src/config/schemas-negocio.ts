import { dadosExemploSwagger as exemplos } from './exemplos-swagger.js';

const inteiro = { type: 'integer', minimum: 0, example: 0 };
const identificador = { type: 'integer', minimum: 1, maximum: 4294967295, example: 1 };
const data = { type: 'string', format: 'date', example: '2026-10-16' };
const propriedadesUsuario = {
  nome: { type: 'string', minLength: 1, maxLength: 160, example: exemplos.leitorMinimo.nome },
  matricula: {
    type: 'string',
    minLength: 1,
    maxLength: 60,
    example: exemplos.leitorMinimo.matricula,
    description: 'Única inclusive entre inativos; espaços das pontas são removidos.',
  },
  email: {
    type: 'string',
    format: 'email',
    maxLength: 254,
    nullable: true,
    example: 'joao@example.test',
  },
  telefone: {
    type: 'string',
    maxLength: 30,
    nullable: true,
    example: '+55 11 98888-8888',
    description:
      'Texto para preservar DDI, zeros e formatação. Opcional; null ou texto vazio apaga. A API limita o tamanho, sem validar um formato telefônico específico.',
  },
  turma: { type: 'string', maxLength: 100, nullable: true, example: '5A' },
  tipo: { type: 'string', enum: ['Aluno', 'Professor', 'Bibliotecário'], example: 'Aluno' },
  status: { type: 'string', enum: ['Ativo', 'Inativo'], default: 'Ativo', example: 'Ativo' },
};
const resumoUsuario = {
  type: 'object',
  properties: { totalEmprestimos: inteiro, emprestimosAtivos: inteiro, atrasados: inteiro },
};
const schemaLista = (nome: string) => ({
  type: 'object',
  required: ['data', 'pagination'],
  properties: {
    data: { type: 'array', items: { $ref: `#/components/schemas/${nome}` } },
    pagination: { $ref: '#/components/schemas/Paginacao' },
  },
});
const respostaItem = (nome: string, exemplo: unknown) => ({
  description: 'Registro persistido.',
  content: {
    'application/json': {
      schema: { type: 'object', properties: { data: { $ref: `#/components/schemas/${nome}` } } },
      example: { data: exemplo },
    },
  },
});
const respostaLista = (nome: string, exemplo: unknown) => ({
  description: 'Lista paginada.',
  content: {
    'application/json': {
      schema: schemaLista(nome),
      example: { data: [exemplo], pagination: { page: 1, pageSize: 20, total: 1 } },
    },
  },
});
const respostaErro = (description: string, code: string, message: string) => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Erro' },
      example: { error: { code, message } },
    },
  },
});
const filtroId = (name: string, example: number, description: string) => ({
  in: 'query',
  name,
  description,
  schema: { ...identificador, example },
});

export const componentesNegocio = {
  parameters: {
    RecursoId: {
      in: 'path',
      name: 'id',
      required: true,
      description: 'ID real retornado no cadastro do recurso. Exemplos não criam registros.',
      schema: identificador,
    },
    UsuarioId: {
      in: 'path',
      name: 'id',
      required: true,
      description: 'ID do leitor, obtido em POST/GET /usuarios. Substitua 201 pelo ID real.',
      schema: { ...identificador, example: 201 },
    },
    EmprestimoId: {
      in: 'path',
      name: 'id',
      required: true,
      description: 'ID do empréstimo, obtido em POST/GET /emprestimos. Substitua 301 pelo ID real.',
      schema: { ...identificador, example: 301 },
    },
    Page: {
      in: 'query',
      name: 'page',
      description: 'Página iniciando em 1. Percorra as páginas até alcançar pagination.total.',
      schema: { type: 'integer', minimum: 1, maximum: 1000000, default: 1, example: 1 },
    },
    PageSize: {
      in: 'query',
      name: 'pageSize',
      description:
        'Itens por página: padrão 20, máximo 100. total informa todos os resultados do filtro.',
      schema: { type: 'integer', minimum: 1, maximum: 100, default: 20, example: 20 },
    },
    UsuarioFiltro: filtroId(
      'usuarioId',
      201,
      'Opcional: ID real do leitor a consultar, não o ID da conta de funcionário.',
    ),
    LivroFiltro: filtroId(
      'livroId',
      101,
      'Opcional: ID real do livro. Omita para incluir todos os livros.',
    ),
    BuscaMovimentacao: {
      in: 'query',
      name: 'busca',
      description: 'Texto literal no título, nome do leitor ou matrícula; ignora caixa/acentos.',
      schema: { type: 'string', maxLength: 100, example: 'João' },
    },
    StatusEmprestimo: {
      in: 'query',
      name: 'status',
      description:
        'Abertos reúne Em Andamento e Atrasado. Omitir inclui também Devolvido; atraso usa a data atual de São Paulo.',
      schema: {
        type: 'string',
        enum: ['Em Andamento', 'Atrasado', 'Devolvido', 'Abertos'],
        example: 'Abertos',
      },
    },
    VencimentoDe: {
      in: 'query',
      name: 'vencimentoDe',
      description:
        'Primeiro dia do vencimento, inclusive, em YYYY-MM-DD. Não pode ser posterior a vencimentoAte.',
      schema: data,
    },
    VencimentoAte: {
      in: 'query',
      name: 'vencimentoAte',
      description:
        'Último dia do vencimento, inclusive. Para consultar um único dia, use a mesma data nos dois limites.',
      schema: { ...data, example: '2026-10-31' },
    },
    IdempotencyKey: {
      in: 'header',
      name: 'Idempotency-Key',
      required: true,
      description:
        'Crie uma chave por intenção, por exemplo um UUID. Em caso de timeout ou clique repetido, reutilize a mesma chave e os mesmos dados. Uma nova ação exige chave nova. A repetição devolve o status/corpo original, sem repetir o efeito; use GET para consultar o estado atual.',
      schema: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        pattern: '^[A-Za-z0-9._:-]+$',
        example: 'emprestimo-20261016-001',
      },
    },
  },
  responses: {
    UsuarioEncontrado: respostaItem('Usuario', exemplos.leitor),
    ListaUsuarios: respostaLista('Usuario', exemplos.leitor),
    EmprestimoEncontrado: respostaItem('Emprestimo', exemplos.emprestimo),
    EmprestimoRenovado: respostaItem('Emprestimo', {
      ...exemplos.emprestimo,
      quantidadeRenovacoes: 1,
      devolucaoPrevista: '2026-10-30',
    }),
    EmprestimoDevolvido: respostaItem('Emprestimo', {
      ...exemplos.emprestimo,
      devolucaoReal: '2026-10-16',
      devolvidoPor: 42,
      status: 'Devolvido',
    }),
    ListaEmprestimos: respostaLista('Emprestimo', exemplos.emprestimo),
    HistoricoUsuario: {
      description:
        'Histórico paginado e resumo de todos os empréstimos do leitor, independentemente dos filtros.',
      content: {
        'application/json': {
          schema: {
            ...schemaLista('Emprestimo'),
            properties: { ...schemaLista('Emprestimo').properties, resumo: resumoUsuario },
          },
          example: {
            data: [exemplos.emprestimo],
            pagination: { page: 1, pageSize: 20, total: 1 },
            resumo: { totalEmprestimos: 1, emprestimosAtivos: 1, atrasados: 0 },
          },
        },
      },
    },
    NaoEncontrado: respostaErro(
      '404: leitor, livro ou empréstimo inexistente/ID inválido. O código identifica o recurso; o exemplo abaixo é de empréstimo.',
      'EMPRESTIMO_NAO_ENCONTRADO',
      'Empréstimo não encontrado.',
    ),
    ConflitoNegocio: respostaErro(
      '409: duplicidade de matrícula/login, leitor já vinculado a outra conta, estado incompatível, limite de empréstimos/renovações, atraso ou chave de idempotência reutilizada com outros dados.',
      'LIMITE_EMPRESTIMOS',
      'O leitor já possui três empréstimos abertos.',
    ),
    CadastroFuncionarioConflito: respostaErro(
      '409 LOGIN_DUPLICADO: escolha um login ainda não cadastrado. Se optar por vincular leitor, ele também precisa estar livre.',
      'LOGIN_DUPLICADO',
      'Este login já está cadastrado.',
    ),
    MatriculaDuplicada: respostaErro(
      '409 MATRICULA_DUPLICADA: matrícula já reservada, inclusive por leitor inativo.',
      'MATRICULA_DUPLICADA',
      'Esta matrícula já está cadastrada.',
    ),
    EdicaoUsuarioConflito: respostaErro(
      '409: matrícula duplicada ou tentativa de inativar leitor com empréstimos abertos. O exemplo mostra inativação bloqueada.',
      'USUARIO_COM_EMPRESTIMOS',
      'Devolva os empréstimos abertos antes de inativar o leitor.',
    ),
    LivroComEmprestimos: respostaErro(
      '409 LIVRO_COM_EMPRESTIMOS: devolva todas as unidades antes de inativar.',
      'LIVRO_COM_EMPRESTIMOS',
      'Devolva os empréstimos abertos antes de inativar o livro.',
    ),
    RenovacaoConflito: respostaErro(
      '409: limite de duas renovações, atraso do leitor, leitor inativo ou empréstimo já devolvido. O exemplo mostra o limite.',
      'LIMITE_RENOVACOES',
      'O empréstimo já foi renovado duas vezes.',
    ),
    DevolucaoConflito: respostaErro(
      '409 EMPRESTIMO_DEVOLVIDO: já devolvido. Uma retentativa deve manter a chave original, em vez de criar outra.',
      'EMPRESTIMO_DEVOLVIDO',
      'O empréstimo já foi devolvido.',
    ),
    PerfilConflito: respostaErro(
      '409 LEITOR_JA_VINCULADO: vínculo opcional já utilizado por outra conta. Nenhum campo do PATCH é salvo nessa falha.',
      'LEITOR_JA_VINCULADO',
      'Este leitor já está vinculado a outra conta de funcionário.',
    ),
    UsuarioNaoEncontrado: respostaErro(
      '404 USUARIO_NAO_ENCONTRADO: ID do leitor inválido ou inexistente.',
      'USUARIO_NAO_ENCONTRADO',
      'Leitor não encontrado.',
    ),
  },
  schemas: {
    Paginacao: {
      type: 'object',
      required: ['page', 'pageSize', 'total'],
      properties: {
        page: { type: 'integer', minimum: 1, example: 1 },
        pageSize: { type: 'integer', minimum: 1, maximum: 100, example: 20 },
        total: {
          ...inteiro,
          example: 1,
          description: 'Total do filtro em todas as páginas, não apenas nesta página.',
        },
      },
    },
    UsuarioEntrada: {
      type: 'object',
      required: ['nome', 'matricula', 'tipo'],
      properties: propriedadesUsuario,
      example: exemplos.leitorCompleto,
      description:
        'Contato/turma opcionais; texto vazio vira null. Cadastro de leitor não concede acesso ao sistema.',
    },
    UsuarioEdicao: {
      type: 'object',
      minProperties: 1,
      properties: propriedadesUsuario,
      example: { turma: '5B', telefone: null },
      description:
        'Ao menos um campo editável. status Inativo exige ausência de empréstimos abertos; pode reativar com Ativo.',
    },
    Usuario: {
      type: 'object',
      required: ['id', 'nome', 'matricula', 'tipo', 'status', 'dataCadastro'],
      properties: {
        id: { ...identificador, readOnly: true, example: 201 },
        ...propriedadesUsuario,
        dataCadastro: { ...data, readOnly: true },
      },
      example: exemplos.leitor,
    },
    FuncionarioEntrada: {
      type: 'object',
      required: ['nome', 'login', 'senha'],
      description:
        'Cria uma conta de acesso. Login identifica a conta; senha é o segredo usado para entrar. O backend gera o ID. Contatos são opcionais; não é necessário informar usuarioId.',
      example: exemplos.funcionarioCompleto,
      properties: {
        nome: { type: 'string', minLength: 1, maxLength: 120, example: 'Ana Silva' },
        login: {
          type: 'string',
          minLength: 1,
          maxLength: 60,
          pattern: '^\\S+$',
          example: 'ana.silva',
          description:
            'Nome de acesso único, com até 60 caracteres e sem espaços. Não é a senha. Escolha outro se retornar LOGIN_DUPLICADO.',
        },
        senha: {
          type: 'string',
          format: 'password',
          minLength: 8,
          maxLength: 1024,
          writeOnly: true,
          example: 'Teste@123',
          description:
            'Senha escolhida para a conta, de 8 a 1024 caracteres. Exemplo apenas para teste local; nunca é devolvida na resposta.',
        },
        email: { ...propriedadesUsuario.email, example: 'ana@example.test' },
        telefone: { ...propriedadesUsuario.telefone, example: '+55 11 99999-9999' },
        usuarioId: {
          ...identificador,
          nullable: true,
          example: 201,
          description:
            'Opcional, fora dos exemplos de cadastro: ID de leitor já existente para vínculo explícito. Não é o ID do novo funcionário. Omita se não precisar dos indicadores pessoais; não cria leitor e não infere vínculo por nome/email.',
        },
      },
    },
    PerfilEdicao: {
      type: 'object',
      minProperties: 1,
      description:
        'Ao menos um campo editável. null/texto vazio apaga contato; usuarioId null remove vínculo sem apagar o leitor ou histórico. Login, cargo, matrícula e contadores não são editáveis.',
      example: {
        nome: 'Ana Silva Santos',
        email: 'ana.santos@example.test',
        telefone: '+55 11 97777-7777',
      },
      properties: {
        nome: { type: 'string', minLength: 1, maxLength: 120, example: 'Ana Silva Santos' },
        email: { ...propriedadesUsuario.email, example: 'ana.santos@example.test' },
        telefone: { ...propriedadesUsuario.telefone, example: '+55 11 97777-7777' },
        usuarioId: {
          ...identificador,
          nullable: true,
          example: 201,
          description:
            'Vínculo opcional com leitor já cadastrado; null remove a associação, sem apagar histórico.',
        },
      },
    },
    EmprestimoEntrada: {
      type: 'object',
      required: ['livroId', 'usuarioId'],
      properties: {
        livroId: {
          ...identificador,
          example: 101,
          description: 'ID real do livro ativo, retornado pelo cadastro/consulta de livros.',
        },
        usuarioId: {
          ...identificador,
          example: 201,
          description:
            'ID real do leitor ativo, retornado pelo cadastro/consulta de leitores. Não é o ID de funcionário.',
        },
      },
      example: exemplos.emprestimoEntrada,
      description:
        'Empresta uma unidade. Substitua os IDs ilustrativos pelos retornados pela API. Datas, funcionário, status e saldo são definidos no servidor.',
    },
    AcaoEmprestimo: {
      type: 'object',
      additionalProperties: false,
      example: {},
      description:
        'Renovação/devolução aceitam corpo ausente ou {}. Não envie prazo, datas, operador ou outros campos.',
    },
    Emprestimo: {
      type: 'object',
      properties: {
        id: identificador,
        livroId: identificador,
        livroTitulo: { type: 'string' },
        livro: {
          type: 'string',
          readOnly: true,
          description: 'Mesmo valor de livroTitulo; compatível com a tabela do dashboard.',
        },
        livroEstante: { type: 'string', nullable: true, readOnly: true },
        livroPrateleira: { type: 'string', nullable: true, readOnly: true },
        livroLocalizacao: {
          type: 'string',
          readOnly: true,
          description:
            'Localização cadastrada atualmente, também para livro inativo; não é snapshot da data do empréstimo.',
        },
        usuarioId: identificador,
        usuarioNome: { type: 'string' },
        usuario: {
          type: 'string',
          readOnly: true,
          description: 'Mesmo valor de usuarioNome; compatível com a tabela do dashboard.',
        },
        funcionarioId: identificador,
        dataEmprestimo: data,
        devolucaoPrevista: data,
        devolucaoReal: { ...data, nullable: true },
        devolvidoPor: { ...identificador, nullable: true },
        quantidadeRenovacoes: { type: 'integer', minimum: 0, maximum: 2 },
        status: { type: 'string', enum: ['Em Andamento', 'Atrasado', 'Devolvido'] },
      },
      example: exemplos.emprestimo,
    },
    Dashboard: {
      type: 'object',
      properties: {
        dataReferencia: data,
        metricas: {
          type: 'object',
          properties: {
            totalAcervo: inteiro,
            emprestimosAtivos: {
              ...inteiro,
              description: 'Todos os abertos, incluindo atrasados.',
            },
            devolucoesPendentes: {
              ...inteiro,
              description: 'Abertos com vencimento anterior a hoje.',
            },
            usuariosAtivos: inteiro,
            devolucoesHoje: inteiro,
          },
        },
        ultimosEmprestimos: {
          type: 'array',
          maxItems: 4,
          items: { $ref: '#/components/schemas/Emprestimo' },
        },
        devolucoesHoje: {
          type: 'array',
          maxItems: 20,
          description:
            'Primeira página; metricas.devolucoesHoje informa o total. Use o relatório com intervalo igual a hoje para percorrer todas.',
          items: { $ref: '#/components/schemas/Emprestimo' },
        },
      },
      example: {
        dataReferencia: '2026-10-16',
        metricas: {
          totalAcervo: 5,
          usuariosAtivos: 1,
          emprestimosAtivos: 1,
          devolucoesPendentes: 0,
          devolucoesHoje: 0,
        },
        ultimosEmprestimos: [exemplos.emprestimo],
        devolucoesHoje: [],
      },
    },
  },
};
