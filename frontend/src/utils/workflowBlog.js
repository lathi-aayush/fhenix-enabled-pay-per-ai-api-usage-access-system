export function extractBlogResult(run) {
  if (!run) return null;
  const final = run.structuredResult?.final;
  if (final?.blog?.blogPostId) return final.blog;
  if (final?.blogPostId) return final;
  for (const nr of run.nodeResults || []) {
    try {
      const parsed = JSON.parse(nr.output);
      if (parsed?.blogPostId) return parsed;
    } catch {
      /* not json */
    }
  }
  return null;
}
