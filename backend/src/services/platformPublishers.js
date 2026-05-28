/**
 * Real publishing integrations. Tokens come from Studio → Platforms (encrypted).
 * metadata on ConnectedPlatform holds platform-specific ids (publicationId, authorUrn, siteUrl, etc.)
 */

export function normalizePlatformToken(raw) {
  let token = String(raw || "").trim();
  if (token.toLowerCase().startsWith("bearer ")) {
    token = token.slice(7).trim();
  }
  return token;
}

/** Validate credentials before saving in Studio → Platforms */
export async function verifyPlatformCredentials(platform, accessToken) {
  const token = normalizePlatformToken(accessToken);
  if (!token) throw new Error("API token is required");

  if (platform === "devto") {
    const res = await fetch("https://dev.to/api/users/me", {
      headers: { "api-key": token },
    });
    if (!res.ok) {
      throw new Error(
        "Dev.to API key is invalid. Create a new key at https://dev.to/settings/extensions (paste the key only, not “Bearer”)."
      );
    }
    return token;
  }

  if (platform === "medium") {
    const res = await fetch("https://api.medium.com/v1/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error("Medium integration token is invalid.");
    }
    return token;
  }

  return token;
}

function stripMarkdownTitle(content) {
  const m = String(content || "").match(/^#\s+(.+)/m);
  return m?.[1]?.trim() || "";
}

function articleBody(post) {
  const title = post.title || stripMarkdownTitle(post.content) || "Untitled";
  let body = String(post.content || "").trim();
  if (body.match(/^#\s+/m)) {
    body = body.replace(/^#\s+.+\n?/m, "").trim();
  }
  return { title, body };
}

async function devtoPublish({ post, accessToken, metadata }) {
  const { title, body } = articleBody(post);
  const tags = (post.hashtags || [])
    .map((t) => String(t).replace(/^#/, "").trim())
    .filter(Boolean)
    .slice(0, 4);

  const res = await fetch("https://dev.to/api/articles", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": accessToken,
    },
    body: JSON.stringify({
      article: {
        title,
        body_markdown: body,
        published: true,
        tags: tags.length ? tags : ["sentinel", "ai"],
      },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || data?.message || res.statusText;
    if (res.status === 401) {
      throw new Error(
        "Dev.to: unauthorized — reconnect with a valid API key at Studio → Platforms (dev.to/settings/extensions)."
      );
    }
    throw new Error(`Dev.to: ${msg}`);
  }
  const url = data?.url || `https://dev.to/${data?.user?.username || "u"}/${data?.id}`;
  return { ok: true, url, platform: "devto", id: data?.id };
}

async function mediumPublish({ post, accessToken, metadata }) {
  const meRes = await fetch("https://api.medium.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const meData = await meRes.json().catch(() => ({}));
  if (!meRes.ok) {
    throw new Error(`Medium auth failed: ${meData?.errors?.[0]?.message || meRes.statusText}`);
  }
  const userId = meData?.data?.id;
  if (!userId) throw new Error("Medium: could not resolve user id");

  const { title, body } = articleBody(post);
  const publicationId = metadata?.publicationId;

  const payload = {
    title,
    contentFormat: "markdown",
    content: body,
    publishStatus: "public",
    tags: (post.keywords || []).slice(0, 5),
  };
  if (publicationId) payload.publicationId = publicationId;

  const res = await fetch(`https://api.medium.com/v1/users/${userId}/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Medium: ${data?.errors?.[0]?.message || res.statusText}`);
  }
  return { ok: true, url: data?.data?.url || data?.data?.canonicalUrl, platform: "medium", id: data?.data?.id };
}

async function hashnodePublish({ post, accessToken, metadata }) {
  const publicationId = metadata?.publicationId;
  if (!publicationId) {
    throw new Error("Hashnode: add Publication ID in Platforms → connect form (from hashnode.com dashboard).");
  }
  const { title, body } = articleBody(post);
  const query = `
    mutation PublishPost($input: PublishPostInput!) {
      publishPost(input: $input) {
        post { url slug }
      }
    }
  `;
  const res = await fetch("https://gql.hashnode.com", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: accessToken,
    },
    body: JSON.stringify({
      query,
      variables: {
        input: {
          title,
          contentMarkdown: body,
          publicationId,
          tags: (post.hashtags || []).map((t) => ({ slug: String(t).replace(/^#/, "") })).slice(0, 5),
        },
      },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (json.errors?.length) {
    throw new Error(`Hashnode: ${json.errors[0].message}`);
  }
  const url = json?.data?.publishPost?.post?.url;
  if (!url) throw new Error("Hashnode: no post URL returned");
  return { ok: true, url, platform: "hashnode" };
}

async function linkedinPublish({ post, accessToken, metadata }) {
  const author = metadata?.authorUrn;
  if (!author) {
    throw new Error(
      "LinkedIn: add your Author URN in Platforms (e.g. urn:li:person:XXXX). Get it from LinkedIn Developer tools."
    );
  }
  const { title, body } = articleBody(post);
  const text = `${title}\n\n${body}`.slice(0, 3000);

  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LinkedIn: ${errText.slice(0, 200) || res.statusText}`);
  }
  const postId = res.headers.get("x-restli-id") || res.headers.get("x-linkedin-id");
  return {
    ok: true,
    url: postId ? `https://www.linkedin.com/feed/update/${postId}` : "https://www.linkedin.com/feed/",
    platform: "linkedin",
  };
}

async function wordpressPublish({ post, accessToken, metadata }) {
  const siteUrl = String(metadata?.siteUrl || "").replace(/\/$/, "");
  const username = metadata?.username;
  if (!siteUrl || !username) {
    throw new Error("WordPress: set Site URL and Username in Platforms connect form.");
  }
  const { title, body } = articleBody(post);
  const auth = Buffer.from(`${username}:${accessToken}`).toString("base64");

  const res = await fetch(`${siteUrl}/wp-json/wp/v2/posts`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      content: body,
      status: "publish",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`WordPress: ${data?.message || res.statusText}`);
  }
  return { ok: true, url: data?.link || `${siteUrl}/?p=${data?.id}`, platform: "wordpress", id: data?.id };
}

const HANDLERS = {
  devto: devtoPublish,
  medium: mediumPublish,
  hashnode: hashnodePublish,
  linkedin: linkedinPublish,
  wordpress: wordpressPublish,
};

export async function publishToPlatform({ platform, post, accessToken, metadata = {} }) {
  const handler = HANDLERS[platform];
  if (!handler) {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  return handler({ post, accessToken, metadata });
}

export const PLATFORM_SETUP = {
  devto: {
    label: "Dev.to",
    tokenLabel: "API key",
    tokenHelp: "https://dev.to/settings/extensions → DEV Community API Keys",
    metadataFields: [],
  },
  medium: {
    label: "Medium",
    tokenLabel: "Integration token",
    tokenHelp: "https://medium.com/me/settings/security → Integration tokens",
    metadataFields: [{ key: "publicationId", label: "Publication ID (optional)", placeholder: "" }],
  },
  linkedin: {
    label: "LinkedIn",
    tokenLabel: "Access token (w_member_social)",
    tokenHelp: "LinkedIn Developer app → OAuth token with w_member_social scope",
    metadataFields: [
      { key: "authorUrn", label: "Author URN (required)", placeholder: "urn:li:person:AbCdEf" },
    ],
  },
  hashnode: {
    label: "Hashnode",
    tokenLabel: "Personal access token",
    tokenHelp: "https://hashnode.com/settings/developer",
    metadataFields: [
      { key: "publicationId", label: "Publication ID (required)", placeholder: "From publication dashboard URL" },
    ],
  },
  wordpress: {
    label: "WordPress",
    tokenLabel: "Application password",
    tokenHelp: "WP Admin → Users → Application Passwords",
    metadataFields: [
      { key: "siteUrl", label: "Site URL", placeholder: "https://yoursite.com" },
      { key: "username", label: "WordPress username", placeholder: "admin" },
    ],
  },
};
