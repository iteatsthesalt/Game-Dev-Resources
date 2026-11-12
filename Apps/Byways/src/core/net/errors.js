/**
 * A network failure with a machine-readable kind.
 * Built as new NetError(kind, message = kind, {status, retryAfterMs, source}) or from one object
 * new NetError({kind, message, status, retryAfterMs, source}).
 */
export class NetError extends Error {
  constructor(kindOrFields, message, extra = {}) {
    const fields = kindOrFields !== null && typeof kindOrFields === 'object'
      ? kindOrFields
      : { ...extra, kind: kindOrFields, message };
    super(fields.message ?? fields.kind);
    this.name = 'NetError';
    this.kind = fields.kind;
    this.status = fields.status;
    this.retryAfterMs = fields.retryAfterMs;
    this.source = fields.source;
  }
}
