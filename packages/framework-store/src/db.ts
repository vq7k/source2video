export type FrameworkSqlResult<T> = {
  rows: T[];
};

export type FrameworkSqlClient = {
  query<T>(sql: string, parameters?: readonly unknown[]): Promise<FrameworkSqlResult<T>>;
};
