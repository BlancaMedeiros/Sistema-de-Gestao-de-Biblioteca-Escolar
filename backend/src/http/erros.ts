import type { ErrorRequestHandler, Response } from 'express';
import { z } from 'zod';

export class ErroApi extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string[]>,
  ) {
    super(message);
  }
}

export function erroValidacao(response: Response, erro: z.ZodError): void {
  const { fieldErrors, formErrors } = erro.flatten();
  response.status(422).json({
    error: {
      code: 'DADOS_INVALIDOS',
      message: 'Confira os dados informados.',
      fields: { ...fieldErrors, ...(formErrors.length ? { corpo: formErrors } : {}) },
    },
  });
}

export function lerId(valor: unknown, code: string, recurso: string): number {
  const id = typeof valor === 'string' && /^[1-9]\d*$/.test(valor) ? Number(valor) : NaN;
  if (!Number.isSafeInteger(id) || id > 4_294_967_295) {
    throw new ErroApi(404, code, `${recurso} não encontrado.`);
  }
  return id;
}

export const idSchema = z.number().int().min(1).max(4_294_967_295);
export const buscaSchema = z.string().trim().max(100).optional();
export const numeroQuery = (maximo: number) =>
  z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .refine((valor) => Number.isSafeInteger(valor) && valor <= maximo);
export const paginacaoSchema = {
  page: numeroQuery(1_000_000).optional().default(1),
  pageSize: numeroQuery(100).optional().default(20),
};
export const textoOpcional = (limite: number) =>
  z
    .string()
    .trim()
    .max(limite)
    .transform((valor) => valor || null)
    .nullable()
    .optional();
export const termoLike = (texto: string) => `%${texto.replace(/[!%_]/g, (valor) => `!${valor}`)}%`;

export function codigoMysql(erro: unknown): string | undefined {
  return typeof erro === 'object' && erro !== null && 'code' in erro
    ? String(erro.code)
    : undefined;
}

export const tratarErros: ErrorRequestHandler = (erro: unknown, _request, response, next) => {
  if (response.headersSent) {
    next(erro);
    return;
  }
  if (erro instanceof ErroApi) {
    response.status(erro.status).json({
      error: {
        code: erro.code,
        message: erro.message,
        ...(erro.fields ? { fields: erro.fields } : {}),
      },
    });
    return;
  }
  const tipo = typeof erro === 'object' && erro !== null && 'type' in erro ? erro.type : undefined;
  if (tipo === 'charset.unsupported' || tipo === 'encoding.unsupported') {
    response.status(415).json({
      error: {
        code: 'REQUISICAO_INVALIDA',
        message: 'Use JSON UTF-8 com uma codificação de conteúdo suportada.',
      },
    });
    return;
  }
  if (tipo === 'entity.parse.failed' || tipo === 'entity.too.large') {
    response.status(tipo === 'entity.too.large' ? 413 : 400).json({
      error: {
        code: 'REQUISICAO_INVALIDA',
        message: 'Envie um corpo JSON válido dentro do limite permitido.',
      },
    });
    return;
  }
  console.error('Falha interna ao processar a requisição.', erro);
  response
    .status(500)
    .json({ error: { code: 'ERRO_INTERNO', message: 'Não foi possível concluir a operação.' } });
};
