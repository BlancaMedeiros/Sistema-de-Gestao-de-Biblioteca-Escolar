import { describe, expect, test } from 'vitest';
import { dataSchema, hojeEscola, somarDias } from './datas.js';
import { statusEmprestimo } from '../modules/emprestimos/emprestimos.repository.js';

describe('datas civis da escola', () => {
  test('antes da meia-noite de São Paulo ainda pertence ao dia anterior', () => {
    expect(hojeEscola(new Date('2026-10-16T02:59:59Z'))).toBe('2026-10-15');
    expect(hojeEscola(new Date('2026-10-16T03:00:00Z'))).toBe('2026-10-16');
  });
  test.each([
    ['2026-12-28', 7, '2027-01-04'],
    ['2024-02-25', 7, '2024-03-03'],
    ['2026-10-15', 7, '2026-10-22'],
  ])('soma dias corridos em %s', (inicio, dias, fim) => {
    expect(somarDias(String(inicio), Number(dias))).toBe(fim);
  });
  test.each(['2026-02-29', '2026-13-01', '15/10/2026', '2026-04-31', '2026-1-01', '0000-01-01'])(
    'rejeita data inválida %s',
    (valor) => {
      expect(dataSchema.safeParse(valor).success).toBe(false);
    },
  );
  test('vencimento hoje não é atraso, e devolvido não depende do vencimento', () => {
    expect(
      statusEmprestimo({ devolucaoPrevista: '2026-10-15', devolucaoReal: null }, '2026-10-15'),
    ).toBe('Em Andamento');
    expect(
      statusEmprestimo({ devolucaoPrevista: '2026-10-14', devolucaoReal: null }, '2026-10-15'),
    ).toBe('Atrasado');
    expect(
      statusEmprestimo(
        { devolucaoPrevista: '2026-10-14', devolucaoReal: '2026-10-15' },
        '2026-10-16',
      ),
    ).toBe('Devolvido');
  });
});
