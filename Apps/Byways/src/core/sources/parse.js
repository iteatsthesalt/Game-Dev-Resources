/** Small helpers the adapters share for reading outside replies, whose fields may be missing or oddly typed. */

/** A string, trimmed; anything else gives ''. */
export const text = value => (typeof value === 'string' ? value.trim() : '');

/** A non-empty string as given (not trimmed); anything else, or '', gives undefined, so `??` can fall back. */
export const optionalText = value => (typeof value === 'string' && value ? value : undefined);

/** An array as given; anything else gives []. */
export const list = value => (Array.isArray(value) ? value : []);
