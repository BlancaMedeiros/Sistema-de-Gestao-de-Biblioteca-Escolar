import { z } from 'zod';

export function hojeEscola(agora = new Date()): string {
  const partes = new Intl.DateTimeFormat('en', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(agora);
  const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)!.value;
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

export function somarDias(data: string, dias: number): string {
  const resultado = new Date(`${data}T12:00:00.000Z`);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado.toISOString().slice(0, 10);
}

export const dataSchema = z
  .string()
  .regex(/^[1-9]\d{3}-\d{2}-\d{2}$/)
  .refine((valor) => {
    const data = new Date(`${valor}T12:00:00Z`);
    return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
  }, 'Informe uma data válida no formato YYYY-MM-DD.');
