// Keeps untrusted text (documents, records, questions) short and free of control
// characters before it is placed in a model prompt.

export function sanitizeForModel(text: string, max = 600): string {
  return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, max);
}
