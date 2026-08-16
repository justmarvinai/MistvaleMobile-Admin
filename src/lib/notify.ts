import { notifications } from '@mantine/notifications';
import { ApiError } from '@/api/client';

/**
 * Toasts.
 *
 * Errors always quote the server's own message and request id — an operator filing a bug
 * should be able to read the id straight off the screen (ADMIN_SUITE_DESIGN §4).
 */

export function notifySuccess(title: string, message?: string): void {
  notifications.show({ color: 'mist', title, message, autoClose: 4000 });
}

export function notifyInfo(title: string, message?: string): void {
  notifications.show({ color: 'blue', title, message, autoClose: 4000 });
}

export function notifyError(title: string, error: unknown): void {
  notifications.show({
    color: 'red',
    title,
    message: describeError(error),
    // Failures stay until dismissed: an operator must be able to copy the request id.
    autoClose: false,
    withCloseButton: true,
  });
}

/** One line describing a failure, including the request id when the server sent one. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    const parts = [error.message];
    const issues = error.fieldIssues();
    if (issues.length > 0) {
      parts.push(issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '));
    }
    if (error.requestId) parts.push(`request ${error.requestId}`);
    return parts.join(' — ');
  }
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred.';
}

/** The error code, when it came from the API — used to special-case auth failures. */
export function errorCode(error: unknown): string | undefined {
  return error instanceof ApiError ? error.code : undefined;
}
