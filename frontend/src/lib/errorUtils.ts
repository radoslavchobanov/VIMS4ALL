/**
 * Parse Django REST Framework error responses into user-friendly error messages
 */
export function parseDrfErrors(err: any): string[] {
  const errors: string[] = [];

  // Check for response data
  const data = err?.response?.data;
  if (!data) {
    return [err?.message ?? "An unexpected error occurred."];
  }

  // Handle simple detail message
  if (typeof data.detail === "string") {
    return [data.detail];
  }

  // Handle field-level validation errors
  if (typeof data === "object") {
    for (const [field, value] of Object.entries(data)) {
      const isGlobal =
        field === "detail" ||
        field === "non_field_errors" ||
        field === "error";

      if (Array.isArray(value)) {
        value.forEach((msg: any) => {
          errors.push(isGlobal ? String(msg) : `${field}: ${String(msg)}`);
        });
      } else if (typeof value === "string") {
        errors.push(isGlobal ? value : `${field}: ${value}`);
      } else if (value && typeof value === "object") {
        // Handle nested errors
        for (const [nestedKey, nestedValue] of Object.entries(
          value as Record<string, any>
        )) {
          if (Array.isArray(nestedValue)) {
            nestedValue.forEach((msg: any) => {
              errors.push(`${field}.${nestedKey}: ${String(msg)}`);
            });
          } else {
            errors.push(`${field}.${nestedKey}: ${String(nestedValue)}`);
          }
        }
      }
    }
  }

  return errors.length ? errors : [err?.message ?? "Validation failed."];
}
