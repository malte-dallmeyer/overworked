import { client } from './api/client.gen'

/** What the generated client throws: the response body, plus the HTTP status it lacks by itself. */
export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown) {
    super(`HTTP ${status}`)
    this.status = status
    this.body = body
  }
}

// Without a response (network error) there is no status to add.
client.interceptors.error.use((error, response) => (response ? new ApiError(response.status, error) : error))

/** Not logged in, or the login has expired. */
export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401
}
