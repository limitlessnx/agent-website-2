import type { SupabaseClient } from "@supabase/supabase-js";

type Json = Record<string, unknown>;

export type MetaPublisherConfig = {
  accessToken: string;
  apiVersion: string;
  pageId: string;
  instagramBusinessAccountId?: string;
  instagramAccessToken?: string;
  instagramGraphHost?: string;
};

export type MetaPublishAsset = {
  id: string;
  assetType: string;
  mimeType: string | null;
  bucketId: string;
  storagePath: string;
  position: number;
};

export type MetaPublishPost = {
  id: string;
  organizationId: string;
  brandId: string;
  title: string;
  caption: string;
  format: string;
};

export type MetaPublishResult = {
  platform: "facebook" | "instagram";
  externalPostId: string;
  externalAccountId: string;
  publishedUrl: string | null;
  provider: "meta-graph-api";
  metadata: Record<string, unknown>;
};

async function graph(
  config: MetaPublisherConfig,
  path: string,
  init?: {
    method?: "GET" | "POST";
    params?: Record<string, string>;
  },
) {
  const url = new URL(
    `https://graph.facebook.com/${config.apiVersion}/${path.replace(/^\//, "")}`,
  );

  for (const [key, value] of Object.entries(init?.params || {})) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("access_token", config.accessToken);

  const response = await fetch(url, {
    method: init?.method || "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  const body = (await response.json().catch(() => ({}))) as Json;
  if (!response.ok) {
    const error = body.error as Json | undefined;
    const message =
      typeof error?.message === "string"
        ? error.message
        : `Meta Graph API request failed (${response.status}).`;
    throw new Error(message);
  }

  return body;
}

async function instagramGraph(
  config: MetaPublisherConfig,
  path: string,
  init?: {
    method?: "GET" | "POST";
    params?: Record<string, string>;
  },
) {
  const host = config.instagramGraphHost || "graph.instagram.com";
  const token = config.instagramAccessToken || config.accessToken;
  if (!token) throw new Error("Instagram publishing access token is missing.");

  const url = new URL(
    `https://${host}/${config.apiVersion}/${path.replace(/^\\//, "")}`,
  );
  for (const [key, value] of Object.entries(init?.params || {})) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("access_token", token);

  const response = await fetch(url, {
    method: init?.method || "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as Json;
  if (!response.ok) {
    const error = body.error as Json | undefined;
    const message =
      typeof error?.message === "string"
        ? error.message
        : `Instagram Graph API request failed (${response.status}).`;
    throw new Error(message);
  }
  return body;
}

async function createSignedAssetUrl(
  supabase: SupabaseClient,
  asset: MetaPublishAsset,
) {
  const { data, error } = await supabase.storage
    .from(asset.bucketId)
    .createSignedUrl(asset.storagePath, 24 * 60 * 60);

  if (error) throw error;
  if (!data?.signedUrl) throw new Error("Unable to create a media URL for Meta publishing.");
  return data.signedUrl;
}

function imageAssets(assets: MetaPublishAsset[]) {
  return assets.filter(
    (asset) =>
      asset.assetType === "image" ||
      asset.assetType === "carousel_slide" ||
      String(asset.mimeType || "").startsWith("image/"),
  );
}

function videoAssets(assets: MetaPublishAsset[]) {
  return assets.filter(
    (asset) =>
      asset.assetType === "video" ||
      asset.assetType === "reel" ||
      String(asset.mimeType || "").startsWith("video/"),
  );
}

async function getFacebookPermalink(
  config: MetaPublisherConfig,
  externalPostId: string,
) {
  try {
    const post = await graph(config, externalPostId, {
      params: { fields: "permalink_url" },
    });
    return typeof post.permalink_url === "string" ? post.permalink_url : null;
  } catch {
    return null;
  }
}

async function getInstagramPermalink(
  config: MetaPublisherConfig,
  externalPostId: string,
) {
  try {
    const media = await instagramGraph(config, externalPostId, {
      params: { fields: "permalink" },
    });
    return typeof media.permalink === "string" ? media.permalink : null;
  } catch {
    return null;
  }
}

async function waitForInstagramContainer(
  config: MetaPublisherConfig,
  containerId: string,
) {
  const maxAttempts = 24;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const state = await instagramGraph(config, containerId, {
      params: { fields: "status_code,status" },
    });

    const status = String(state.status_code || state.status || "").toUpperCase();
    if (["FINISHED", "PUBLISHED"].includes(status)) return;

    if (["ERROR", "EXPIRED"].includes(status)) {
      throw new Error(
        `Instagram media container entered ${status.toLowerCase()} state.`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }

  throw new Error("Instagram media processing timed out before publishing.");
}

async function publishFacebookImage(input: {
  config: MetaPublisherConfig;
  supabase: SupabaseClient;
  post: MetaPublishPost;
  asset: MetaPublishAsset;
}) {
  const url = await createSignedAssetUrl(input.supabase, input.asset);
  const body = await graph(input.config, `${input.config.pageId}/photos`, {
    method: "POST",
    params: {
      url,
      caption: input.post.caption,
      published: "true",
    },
  });

  const externalPostId = String(body.post_id || body.id || "");
  if (!externalPostId) throw new Error("Meta did not return a Facebook post ID.");

  return {
    platform: "facebook",
    externalPostId,
    externalAccountId: input.config.pageId,
    publishedUrl: await getFacebookPermalink(input.config, externalPostId),
    provider: "meta-graph-api",
    metadata: {
      endpoint: "photos",
      asset_ids: [input.asset.id],
    },
  } satisfies MetaPublishResult;
}

async function publishFacebookCarousel(input: {
  config: MetaPublisherConfig;
  supabase: SupabaseClient;
  post: MetaPublishPost;
  assets: MetaPublishAsset[];
}) {
  const attachedMedia: Array<{ media_fbid: string }> = [];

  for (const asset of input.assets) {
    const url = await createSignedAssetUrl(input.supabase, asset);
    const created = await graph(input.config, `${input.config.pageId}/photos`, {
      method: "POST",
      params: {
        url,
        published: "false",
      },
    });

    const photoId = String(created.id || "");
    if (!photoId) throw new Error("Meta did not return a Facebook photo ID.");
    attachedMedia.push({ media_fbid: photoId });
  }

  const body = await graph(input.config, `${input.config.pageId}/feed`, {
    method: "POST",
    params: {
      message: input.post.caption,
      attached_media: JSON.stringify(attachedMedia),
    },
  });

  const externalPostId = String(body.id || "");
  if (!externalPostId) throw new Error("Meta did not return a Facebook post ID.");

  return {
    platform: "facebook",
    externalPostId,
    externalAccountId: input.config.pageId,
    publishedUrl: await getFacebookPermalink(input.config, externalPostId),
    provider: "meta-graph-api",
    metadata: {
      endpoint: "feed",
      carousel_photo_ids: attachedMedia.map((item) => item.media_fbid),
      asset_ids: input.assets.map((asset) => asset.id),
    },
  } satisfies MetaPublishResult;
}

async function publishFacebookVideo(input: {
  config: MetaPublisherConfig;
  supabase: SupabaseClient;
  post: MetaPublishPost;
  asset: MetaPublishAsset;
}) {
  const fileUrl = await createSignedAssetUrl(input.supabase, input.asset);
  const body = await graph(input.config, `${input.config.pageId}/videos`, {
    method: "POST",
    params: {
      file_url: fileUrl,
      description: input.post.caption,
      title: input.post.title,
    },
  });

  const externalPostId = String(body.id || "");
  if (!externalPostId) throw new Error("Meta did not return a Facebook video ID.");

  return {
    platform: "facebook",
    externalPostId,
    externalAccountId: input.config.pageId,
    publishedUrl: await getFacebookPermalink(input.config, externalPostId),
    provider: "meta-graph-api",
    metadata: {
      endpoint: "videos",
      asset_ids: [input.asset.id],
    },
  } satisfies MetaPublishResult;
}

async function publishFacebookText(input: {
  config: MetaPublisherConfig;
  post: MetaPublishPost;
}) {
  const body = await graph(input.config, `${input.config.pageId}/feed`, {
    method: "POST",
    params: { message: input.post.caption || input.post.title },
  });

  const externalPostId = String(body.id || "");
  if (!externalPostId) throw new Error("Meta did not return a Facebook post ID.");

  return {
    platform: "facebook",
    externalPostId,
    externalAccountId: input.config.pageId,
    publishedUrl: await getFacebookPermalink(input.config, externalPostId),
    provider: "meta-graph-api",
    metadata: { endpoint: "feed", asset_ids: [] },
  } satisfies MetaPublishResult;
}

async function publishInstagramImage(input: {
  config: MetaPublisherConfig;
  supabase: SupabaseClient;
  post: MetaPublishPost;
  asset: MetaPublishAsset;
}) {
  const instagramId = input.config.instagramBusinessAccountId;
  if (!instagramId) throw new Error("No Instagram Business account is connected.");

  const imageUrl = await createSignedAssetUrl(input.supabase, input.asset);
  const container = await instagramGraph(input.config, `${instagramId}/media`, {
    method: "POST",
    params: {
      image_url: imageUrl,
      caption: input.post.caption,
    },
  });

  const containerId = String(container.id || "");
  if (!containerId) throw new Error("Instagram did not return a media container ID.");

  const published = await instagramGraph(input.config, `${instagramId}/media_publish`, {
    method: "POST",
    params: { creation_id: containerId },
  });

  const externalPostId = String(published.id || "");
  if (!externalPostId) throw new Error("Instagram did not return a published media ID.");

  return {
    platform: "instagram",
    externalPostId,
    externalAccountId: instagramId,
    publishedUrl: await getInstagramPermalink(input.config, externalPostId),
    provider: "meta-graph-api",
    metadata: {
      container_id: containerId,
      media_type: "IMAGE",
      asset_ids: [input.asset.id],
    },
  } satisfies MetaPublishResult;
}

async function createInstagramCarouselChild(input: {
  config: MetaPublisherConfig;
  supabase: SupabaseClient;
  instagramId: string;
  asset: MetaPublishAsset;
}) {
  const mediaUrl = await createSignedAssetUrl(input.supabase, input.asset);
  const isVideo =
    input.asset.assetType === "video" ||
    input.asset.assetType === "reel" ||
    String(input.asset.mimeType || "").startsWith("video/");

  const params: Record<string, string> = {
    is_carousel_item: "true",
  };

  if (isVideo) {
    params.media_type = "VIDEO";
    params.video_url = mediaUrl;
  } else {
    params.image_url = mediaUrl;
  }

  const child = await instagramGraph(input.config, `${input.instagramId}/media`, {
    method: "POST",
    params,
  });

  const id = String(child.id || "");
  if (!id) throw new Error("Instagram did not return a carousel child ID.");

  if (isVideo) {
    await waitForInstagramContainer(input.config, id);
  }

  return id;
}

async function publishInstagramCarousel(input: {
  config: MetaPublisherConfig;
  supabase: SupabaseClient;
  post: MetaPublishPost;
  assets: MetaPublishAsset[];
}) {
  const instagramId = input.config.instagramBusinessAccountId;
  if (!instagramId) throw new Error("No Instagram Business account is connected.");

  const childIds: string[] = [];
  for (const asset of input.assets) {
    childIds.push(
      await createInstagramCarouselChild({
        config: input.config,
        supabase: input.supabase,
        instagramId,
        asset,
      }),
    );
  }

  const container = await instagramGraph(input.config, `${instagramId}/media`, {
    method: "POST",
    params: {
      media_type: "CAROUSEL",
      children: childIds.join(","),
      caption: input.post.caption,
    },
  });

  const containerId = String(container.id || "");
  if (!containerId) throw new Error("Instagram did not return a carousel container ID.");

  await waitForInstagramContainer(input.config, containerId);

  const published = await instagramGraph(input.config, `${instagramId}/media_publish`, {
    method: "POST",
    params: { creation_id: containerId },
  });

  const externalPostId = String(published.id || "");
  if (!externalPostId) throw new Error("Instagram did not return a published carousel ID.");

  return {
    platform: "instagram",
    externalPostId,
    externalAccountId: instagramId,
    publishedUrl: await getInstagramPermalink(input.config, externalPostId),
    provider: "meta-graph-api",
    metadata: {
      container_id: containerId,
      child_container_ids: childIds,
      media_type: "CAROUSEL",
      asset_ids: input.assets.map((asset) => asset.id),
    },
  } satisfies MetaPublishResult;
}

async function publishInstagramReel(input: {
  config: MetaPublisherConfig;
  supabase: SupabaseClient;
  post: MetaPublishPost;
  asset: MetaPublishAsset;
}) {
  const instagramId = input.config.instagramBusinessAccountId;
  if (!instagramId) throw new Error("No Instagram Business account is connected.");

  const videoUrl = await createSignedAssetUrl(input.supabase, input.asset);
  const container = await instagramGraph(input.config, `${instagramId}/media`, {
    method: "POST",
    params: {
      media_type: "REELS",
      video_url: videoUrl,
      caption: input.post.caption,
      share_to_feed: "true",
    },
  });

  const containerId = String(container.id || "");
  if (!containerId) throw new Error("Instagram did not return a Reel container ID.");

  await waitForInstagramContainer(input.config, containerId);

  const published = await instagramGraph(input.config, `${instagramId}/media_publish`, {
    method: "POST",
    params: { creation_id: containerId },
  });

  const externalPostId = String(published.id || "");
  if (!externalPostId) throw new Error("Instagram did not return a published Reel ID.");

  return {
    platform: "instagram",
    externalPostId,
    externalAccountId: instagramId,
    publishedUrl: await getInstagramPermalink(input.config, externalPostId),
    provider: "meta-graph-api",
    metadata: {
      container_id: containerId,
      media_type: "REELS",
      asset_ids: [input.asset.id],
    },
  } satisfies MetaPublishResult;
}

export async function publishMetaPost(input: {
  supabase: SupabaseClient;
  config: MetaPublisherConfig;
  post: MetaPublishPost;
  platform: "facebook" | "instagram";
  assets: MetaPublishAsset[];
}) {
  const orderedAssets = [...input.assets].sort((a, b) => a.position - b.position);
  const images = imageAssets(orderedAssets);
  const videos = videoAssets(orderedAssets);

  if (input.platform === "facebook") {
    if (input.post.format === "carousel") {
      if (images.length < 2) {
        throw new Error("Facebook carousel publishing requires at least two image assets.");
      }
      return publishFacebookCarousel({
        config: input.config,
        supabase: input.supabase,
        post: input.post,
        assets: images,
      });
    }

    if (["video", "reel"].includes(input.post.format)) {
      const asset = videos[0];
      if (!asset) throw new Error("Facebook video publishing requires a ready video asset.");
      return publishFacebookVideo({
        config: input.config,
        supabase: input.supabase,
        post: input.post,
        asset,
      });
    }

    if (input.post.format === "text") {
      return publishFacebookText({ config: input.config, post: input.post });
    }

    const asset = images[0];
    if (!asset) throw new Error("Facebook image publishing requires a ready image asset.");
    return publishFacebookImage({
      config: input.config,
      supabase: input.supabase,
      post: input.post,
      asset,
    });
  }

  if (!input.config.instagramBusinessAccountId) {
    throw new Error("No Instagram Business account is connected.");
  }

  if (input.post.format === "carousel") {
    const carouselAssets = orderedAssets.filter(
      (asset) =>
        asset.assetType === "carousel_slide" ||
        String(asset.mimeType || "").startsWith("image/") ||
        String(asset.mimeType || "").startsWith("video/"),
    );

    if (carouselAssets.length < 2) {
      throw new Error("Instagram carousel publishing requires at least two media assets.");
    }

    return publishInstagramCarousel({
      config: input.config,
      supabase: input.supabase,
      post: input.post,
      assets: carouselAssets,
    });
  }

  if (["video", "reel"].includes(input.post.format)) {
    const asset = videos[0];
    if (!asset) throw new Error("Instagram Reel publishing requires a ready video asset.");
    return publishInstagramReel({
      config: input.config,
      supabase: input.supabase,
      post: input.post,
      asset,
    });
  }

  if (input.post.format === "text") {
    throw new Error("Instagram does not support text-only publishing.");
  }

  const asset = images[0];
  if (!asset) throw new Error("Instagram image publishing requires a ready image asset.");
  return publishInstagramImage({
    config: input.config,
    supabase: input.supabase,
    post: input.post,
    asset,
  });
}

export async function metaPublisherConfigFromIntegration(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<MetaPublisherConfig> {
  const rpcClient = supabase as any;

  const [
    { data: credentials, error: credentialError },
    { data: integration, error: integrationError },
  ] = await Promise.all([
    rpcClient.rpc("get_organization_integration_credentials", {
      p_organization_id: organizationId,
      p_provider: "meta",
    }),
    supabase
      .from("organization_integrations")
      .select("status,configuration")
      .eq("organization_id", organizationId)
      .eq("provider", "meta")
      .maybeSingle(),
  ]);

  if (credentialError) throw credentialError;
  if (integrationError) throw integrationError;
  if (integration?.status !== "connected") {
    throw new Error("Meta integration is not connected.");
  }

  const secret = (credentials || {}) as Json;
  const config = (integration.configuration || {}) as Json;
  const accessToken =
    typeof secret.access_token === "string" ? secret.access_token : "";
  const instagramAccessToken =
    typeof secret.instagram_user_access_token === "string"
      ? secret.instagram_user_access_token
      : "";
  const pageId = typeof config.page_id === "string" ? config.page_id : "";

  if (!accessToken || !pageId) {
    throw new Error("Meta publishing credentials are incomplete.");
  }

  return {
    accessToken,
    apiVersion:
      typeof config.api_version === "string" ? config.api_version : "v24.0",
    pageId,
    instagramBusinessAccountId:
      typeof secret.instagram_login_user_id === "string"
        ? secret.instagram_login_user_id
        : typeof config.instagram_login_user_id === "string"
          ? config.instagram_login_user_id
          : typeof config.instagram_business_account_id === "string"
            ? config.instagram_business_account_id
            : undefined,
    instagramAccessToken: instagramAccessToken || undefined,
    instagramGraphHost: instagramAccessToken
      ? "graph.instagram.com"
      : "graph.facebook.com",
  };
}
