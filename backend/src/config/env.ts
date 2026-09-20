function readRequired(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`A variável de ambiente ${name} é obrigatória.`);
  }

  return value;
}

function readPort(name: string, fallback: number): number {
  const rawValue = process.env[name] ?? String(fallback);
  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`A variável de ambiente ${name} deve ser uma porta válida.`);
  }

  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: readPort('PORT', 3000),
  database: {
    host: readRequired('DB_HOST'),
    port: readPort('DB_PORT', 3306),
    name: readRequired('DB_NAME'),
    user: readRequired('DB_USER'),
    password: readRequired('DB_PASSWORD'),
  },
};
