import { describe, expect, test } from 'vitest';

import { selectPendingMigrations } from './migrations.js';

describe('selectPendingMigrations', () => {
  test('retorna todos os arquivos disponíveis em ordem quando nenhum foi aplicado', () => {
    const disponiveis = ['0002_segundo.sql', '0001_primeiro.sql'];

    const pendentes = selectPendingMigrations(disponiveis, []);

    expect(pendentes).toEqual(['0001_primeiro.sql', '0002_segundo.sql']);
  });

  test('exclui os arquivos já aplicados', () => {
    const disponiveis = ['0001_primeiro.sql', '0002_segundo.sql', '0003_terceiro.sql'];
    const aplicados = ['0001_primeiro.sql'];

    const pendentes = selectPendingMigrations(disponiveis, aplicados);

    expect(pendentes).toEqual(['0002_segundo.sql', '0003_terceiro.sql']);
  });
});
