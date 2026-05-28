/** Attach soft-delete filter to find queries unless includeDeleted is set. */
export function applySoftDelete(schema) {
  schema.pre(/^find/, function excludeDeleted() {
    if (this.getOptions().includeDeleted) return;
    this.where({ deletedAt: null });
  });
}
