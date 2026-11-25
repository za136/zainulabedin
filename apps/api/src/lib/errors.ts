/**
 * Every error the API returns has the shape `{ error: { code, message, details? } }`.
 * Codes are stable, machine-readable identifiers the storefront translates.
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message?: string,
    public details?: unknown,
  ) {
    super(message ?? code);
  }
}

export const notFound = (what: string) => new AppError(404, 'not_found', `${what} not found`);
export const badRequest = (code: string, message?: string, details?: unknown) => new AppError(400, code, message, details);
export const conflict = (code: string, message?: string, details?: unknown) => new AppError(409, code, message, details);
export const unauthorized = () => new AppError(401, 'unauthorized', 'Authentication required');
export const forbidden = () => new AppError(403, 'forbidden', 'Not allowed');
