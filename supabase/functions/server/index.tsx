import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";

// Inline KV store to avoid import issues
const getSupabaseClient = () =>
  createClient(
    Deno.env.get("SB_URL")!,
    Deno.env.get("SB_SERVICE_ROLE_KEY")!,
  );

const kv = {
  async get(key: string): Promise<any> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("kv_store_legacy")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      return data?.value;
    } catch (error) {
      console.error(`KV get error for key ${key}:`, error);
      throw error;
    }
  },

  async set(key: string, value: any): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("kv_store_legacy")
        .upsert({ key, value });
      if (error) throw error;
    } catch (error) {
      console.error(`KV set error for key ${key}:`, error);
      throw error;
    }
  },
};

const supabaseAdmin = () =>
  createClient(
    Deno.env.get("SB_URL")!,
    Deno.env.get("SB_SERVICE_ROLE_KEY")!,
  );
const legacyPostsTable = "posts_legacy";
const officesTable = "offices";
const platformsTable = "platforms";
const submissionsTable = "audit_submissions";
const submissionPlatformsTable = "submission_platforms";
const scoresTable = "audit_scores";
const reviewsTable = "central_reviews";
const appealsTable = "appeals";
const accessRequestsTable = "access_requests";
const countersTable = "app_counters";

const isMissingTableError = (error: any) =>
  error?.code === "42P01" ||
  String(error?.message || error).includes("does not exist") ||
  String(error?.message || error).includes("schema cache");

const dateOrNull = (value: any) =>
  typeof value === "string" && value.trim() ? value : null;

const numberOrNull = (value: any) =>
  typeof value === "number" && Number.isFinite(value)
    ? value
    : value === null || value === undefined || value === ""
      ? null
      : Number(value);

const normalizePlatforms = (platform: any): string[] => {
  if (Array.isArray(platform)) {
    return platform.filter(Boolean);
  }
  return platform ? [platform] : [];
};

const legacyPostsStore = {
  async list(): Promise<any[]> {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from(legacyPostsTable)
      .select("value")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data?.map((row: any) => row.value) ?? [];
  },

  async create(post: any): Promise<any> {
    const supabase = supabaseAdmin();
    const postWithId = {
      ...post,
      id: post.id || crypto.randomUUID(),
    };

    const { error } = await supabase.from(legacyPostsTable).insert({
      id: postWithId.id,
      value: postWithId,
    });

    if (error) throw error;
    return postWithId;
  },

  async replace(id: string, post: any): Promise<any> {
    const supabase = supabaseAdmin();
    const postWithId = { ...post, id };

    const { error } = await supabase
      .from(legacyPostsTable)
      .update({
        value: postWithId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;
    return postWithId;
  },

  async patch(
    id: string,
    fields: Record<string, any>,
  ): Promise<any> {
    const supabase = supabaseAdmin();

    const { data: existing, error: fetchError } = await supabase
      .from(legacyPostsTable)
      .select("value")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) return null;

    const updatedPost = {
      ...existing.value,
      ...fields,
      id,
    };

    const { error: updateError } = await supabase
      .from(legacyPostsTable)
      .update({
        value: updatedPost,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) throw updateError;
    return updatedPost;
  },

  async delete(id: string): Promise<void> {
    const supabase = supabaseAdmin();
    const { error } = await supabase
      .from(legacyPostsTable)
      .delete()
      .eq("id", id);

    if (error) throw error;
  },
};

const normalizedPostsStore = {
  async getOfficeId(supabase: any, officeName?: string) {
    if (!officeName) return null;

    const { data, error } = await supabase
      .from(officesTable)
      .upsert({ name: officeName }, { onConflict: "name" })
      .select("id")
      .single();

    if (error) throw error;
    return data?.id || null;
  },

  async syncRelations(
    supabase: any,
    id: string,
    post: any,
  ): Promise<void> {
    const platforms = normalizePlatforms(post.platform);

    if (platforms.length > 0) {
      const { error: platformError } = await supabase
        .from(platformsTable)
        .upsert(
          platforms.map((name) => ({ name })),
          { onConflict: "name" },
        );
      if (platformError) throw platformError;
    }

    const { error: deletePlatformError } = await supabase
      .from(submissionPlatformsTable)
      .delete()
      .eq("submission_id", id);
    if (deletePlatformError) throw deletePlatformError;

    if (platforms.length > 0) {
      const { error: insertPlatformError } = await supabase
        .from(submissionPlatformsTable)
        .insert(
          platforms.map((platform) => ({
            submission_id: id,
            platform,
          })),
        );
      if (insertPlatformError) throw insertPlatformError;
    }

    const { error: scoreError } = await supabase
      .from(scoresTable)
      .upsert(
        {
          submission_id: id,
          score: numberOrNull(post.score) ?? 0,
          caption_score: numberOrNull(post.captionScore),
          pubmat_score: numberOrNull(post.pubmatScore),
          grammar: numberOrNull(post.grammar),
          inclusivity: numberOrNull(post.inclusivity),
          tone: numberOrNull(post.tone),
        },
        { onConflict: "submission_id" },
      );
    if (scoreError) throw scoreError;

    if (post.centralReviewStatus || post.centralReviewComment) {
      const { error: reviewError } = await supabase
        .from(reviewsTable)
        .upsert(
          {
            submission_id: id,
            status: post.centralReviewStatus || "Pending Review",
            comment: post.centralReviewComment || null,
            reviewed_on: dateOrNull(post.centralReviewDate),
          },
          { onConflict: "submission_id" },
        );
      if (reviewError) throw reviewError;
    }

    const { error: deleteAppealError } = await supabase
      .from(appealsTable)
      .delete()
      .eq("submission_id", id);
    if (deleteAppealError) throw deleteAppealError;

    if (
      post.appealStatus &&
      post.appealStatus !== "Not Appealed"
    ) {
      const { error: appealError } = await supabase
        .from(appealsTable)
        .insert({
          submission_id: id,
          status: post.appealStatus,
          comment: post.appealComment || null,
          appealed_on: dateOrNull(post.appealDate),
        });
      if (appealError) throw appealError;
    }
  },

  async rowToPost(
    row: any,
    maps: {
      offices: Map<string, string>;
      platforms: Map<string, string[]>;
      scores: Map<string, any>;
      reviews: Map<string, any>;
      appeals: Map<string, any>;
    },
  ) {
    const platformList = maps.platforms.get(row.id) || [];
    const score = maps.scores.get(row.id) || {};
    const review = maps.reviews.get(row.id) || {};
    const appeal = maps.appeals.get(row.id) || {};

    return {
      id: row.id,
      platform:
        platformList.length === 1
          ? platformList[0]
          : platformList,
      caption: row.caption || "",
      thumbnail: row.thumbnail || undefined,
      score: score.score ?? 0,
      captionScore: score.caption_score ?? undefined,
      pubmatScore: score.pubmat_score ?? undefined,
      grammar: score.grammar ?? undefined,
      inclusivity: score.inclusivity ?? undefined,
      tone: score.tone ?? undefined,
      status: row.status,
      recommendation: row.recommendation || "",
      date: row.posting_date || "",
      reviewer: row.reviewer || undefined,
      submissionDate: row.submission_date || undefined,
      lastUpdated: row.last_updated || undefined,
      auditFocus: row.audit_focus,
      pubmatType: row.pubmat_type || undefined,
      hasBeenRevised: row.has_been_revised,
      office: row.office_id
        ? maps.offices.get(row.office_id)
        : undefined,
      centralReviewStatus:
        review.status || "Pending Review",
      centralReviewComment: review.comment || undefined,
      centralReviewDate: review.reviewed_on || undefined,
      appealStatus: appeal.status || "Not Appealed",
      appealComment: appeal.comment || undefined,
      appealDate: appeal.appealed_on || undefined,
    };
  },

  async list(): Promise<any[]> {
    const supabase = supabaseAdmin();
    const { data: submissions, error } = await supabase
      .from(submissionsTable)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (!submissions?.length) return [];

    const ids = submissions.map((row: any) => row.id);
    const officeIds = submissions
      .map((row: any) => row.office_id)
      .filter(Boolean);

    const [
      officesResult,
      platformsResult,
      scoresResult,
      reviewsResult,
      appealsResult,
    ] = await Promise.all([
      officeIds.length
        ? supabase
            .from(officesTable)
            .select("id, name")
            .in("id", officeIds)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from(submissionPlatformsTable)
        .select("submission_id, platform")
        .in("submission_id", ids),
      supabase
        .from(scoresTable)
        .select("*")
        .in("submission_id", ids),
      supabase
        .from(reviewsTable)
        .select("*")
        .in("submission_id", ids),
      supabase
        .from(appealsTable)
        .select("*")
        .in("submission_id", ids)
        .order("created_at", { ascending: false }),
    ]);

    for (const result of [
      officesResult,
      platformsResult,
      scoresResult,
      reviewsResult,
      appealsResult,
    ]) {
      if (result.error) throw result.error;
    }

    const offices = new Map(
      (officesResult.data || []).map((office: any) => [
        office.id,
        office.name,
      ]),
    );
    const platforms = new Map<string, string[]>();
    for (const row of platformsResult.data || []) {
      const existing = platforms.get(row.submission_id) || [];
      existing.push(row.platform);
      platforms.set(row.submission_id, existing);
    }
    const scores = new Map(
      (scoresResult.data || []).map((row: any) => [
        row.submission_id,
        row,
      ]),
    );
    const reviews = new Map(
      (reviewsResult.data || []).map((row: any) => [
        row.submission_id,
        row,
      ]),
    );
    const appeals = new Map();
    for (const row of appealsResult.data || []) {
      if (!appeals.has(row.submission_id)) {
        appeals.set(row.submission_id, row);
      }
    }

    return Promise.all(
      submissions.map((row: any) =>
        this.rowToPost(row, {
          offices,
          platforms,
          scores,
          reviews,
          appeals,
        }),
      ),
    );
  },

  async getById(id: string): Promise<any | null> {
    const posts = await this.list();
    return posts.find((post: any) => post.id === id) || null;
  },

  async create(post: any): Promise<any> {
    const supabase = supabaseAdmin();
    const postWithId = {
      ...post,
      id: post.id || crypto.randomUUID(),
    };
    const officeId = await this.getOfficeId(
      supabase,
      postWithId.office,
    );

    const { error } = await supabase
      .from(submissionsTable)
      .insert({
        id: postWithId.id,
        office_id: officeId,
        caption: postWithId.caption || "",
        thumbnail: postWithId.thumbnail || null,
        status: postWithId.status || "Rejected",
        recommendation:
          postWithId.recommendation || postWithId.remarks || "",
        posting_date: dateOrNull(postWithId.date),
        reviewer: postWithId.reviewer || null,
        submission_date: dateOrNull(postWithId.submissionDate),
        last_updated: dateOrNull(postWithId.lastUpdated),
        audit_focus: postWithId.auditFocus || "caption",
        pubmat_type: postWithId.pubmatType || null,
        has_been_revised: !!postWithId.hasBeenRevised,
      });

    if (error) throw error;
    await this.syncRelations(supabase, postWithId.id, postWithId);
    return postWithId;
  },

  async replace(id: string, post: any): Promise<any> {
    const supabase = supabaseAdmin();
    const postWithId = { ...post, id };
    const officeId = await this.getOfficeId(
      supabase,
      postWithId.office,
    );

    const { error } = await supabase
      .from(submissionsTable)
      .upsert(
        {
          id,
          office_id: officeId,
          caption: postWithId.caption || "",
          thumbnail: postWithId.thumbnail || null,
          status: postWithId.status || "Rejected",
          recommendation:
            postWithId.recommendation || postWithId.remarks || "",
          posting_date: dateOrNull(postWithId.date),
          reviewer: postWithId.reviewer || null,
          submission_date: dateOrNull(postWithId.submissionDate),
          last_updated: dateOrNull(postWithId.lastUpdated),
          audit_focus: postWithId.auditFocus || "caption",
          pubmat_type: postWithId.pubmatType || null,
          has_been_revised: !!postWithId.hasBeenRevised,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );

    if (error) throw error;
    await this.syncRelations(supabase, id, postWithId);
    return postWithId;
  },

  async patch(
    id: string,
    fields: Record<string, any>,
  ): Promise<any> {
    const existing = await this.getById(id);
    if (!existing) return null;
    return this.replace(id, { ...existing, ...fields, id });
  },

  async delete(id: string): Promise<void> {
    const supabase = supabaseAdmin();
    const { error } = await supabase
      .from(submissionsTable)
      .delete()
      .eq("id", id);

    if (error) throw error;
  },
};

const postsStore = {
  async list(): Promise<any[]> {
    try {
      return await normalizedPostsStore.list();
    } catch (error) {
      if (isMissingTableError(error)) {
        return legacyPostsStore.list();
      }
      throw error;
    }
  },

  async create(post: any): Promise<any> {
    try {
      return await normalizedPostsStore.create(post);
    } catch (error) {
      if (isMissingTableError(error)) {
        return legacyPostsStore.create(post);
      }
      throw error;
    }
  },

  async replace(id: string, post: any): Promise<any> {
    try {
      return await normalizedPostsStore.replace(id, post);
    } catch (error) {
      if (isMissingTableError(error)) {
        return legacyPostsStore.replace(id, post);
      }
      throw error;
    }
  },

  async patch(
    id: string,
    fields: Record<string, any>,
  ): Promise<any> {
    try {
      return await normalizedPostsStore.patch(id, fields);
    } catch (error) {
      if (isMissingTableError(error)) {
        return legacyPostsStore.patch(id, fields);
      }
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await normalizedPostsStore.delete(id);
    } catch (error) {
      if (isMissingTableError(error)) {
        await legacyPostsStore.delete(id);
        return;
      }
      throw error;
    }
  },
};

const requestFromRow = (row: any) => ({
  id: row.id,
  type: row.type,
  officeEmail: row.office_email,
  officeName: row.office_name,
  status: row.status,
  submittedAt: row.submitted_at,
  reason: row.reason || undefined,
  newAssignedPerson: row.new_assigned_person || undefined,
  verificationCode: row.verification_code || undefined,
  verificationCodeExpiresAt:
    row.verification_code_expires_at || undefined,
  requestedPassword: row.requested_password || undefined,
});

const requestToRow = (request: any) => ({
  id: request.id,
  type: request.type,
  office_email: request.officeEmail,
  office_name: request.officeName,
  status: request.status || "Pending",
  submitted_at: request.submittedAt || new Date().toISOString(),
  reason: request.reason || null,
  new_assigned_person: request.newAssignedPerson || null,
  verification_code: request.verificationCode || null,
  verification_code_expires_at:
    request.verificationCodeExpiresAt || null,
  requested_password: request.requestedPassword || null,
  updated_at: new Date().toISOString(),
});

const requestPatchToRow = (fields: Record<string, any>) => {
  const row: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if ("type" in fields) row.type = fields.type;
  if ("officeEmail" in fields) row.office_email = fields.officeEmail;
  if ("officeName" in fields) row.office_name = fields.officeName;
  if ("status" in fields) row.status = fields.status;
  if ("submittedAt" in fields) row.submitted_at = fields.submittedAt;
  if ("reason" in fields) row.reason = fields.reason || null;
  if ("newAssignedPerson" in fields) {
    row.new_assigned_person = fields.newAssignedPerson || null;
  }
  if ("verificationCode" in fields) {
    row.verification_code = fields.verificationCode || null;
  }
  if ("verificationCodeExpiresAt" in fields) {
    row.verification_code_expires_at =
      fields.verificationCodeExpiresAt || null;
  }
  if ("requestedPassword" in fields) {
    row.requested_password = fields.requestedPassword || null;
  }

  return row;
};

const legacyAccessRequestsStore = {
  async list(): Promise<any[]> {
    return (await kv.get("access_requests")) || [];
  },

  async create(request: any): Promise<any> {
    const requests = await this.list();
    const updatedRequests = [request, ...requests];
    await kv.set("access_requests", updatedRequests);
    return request;
  },

  async patch(id: string, fields: Record<string, any>): Promise<any> {
    const requests = await this.list();
    let updatedRequest = null;
    const updatedRequests = requests.map((req: any) => {
      if (req.id !== id) return req;
      updatedRequest = { ...req, ...fields };
      return updatedRequest;
    });
    await kv.set("access_requests", updatedRequests);
    return updatedRequest;
  },

  async findByVerificationCode(code: string): Promise<any | null> {
    const requests = await this.list();
    return (
      requests.find(
        (req: any) =>
          req.verificationCode === code &&
          req.status === "Approved",
      ) || null
    );
  },
};

const normalizedAccessRequestsStore = {
  async list(): Promise<any[]> {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from(accessRequestsTable)
      .select("*")
      .order("submitted_at", { ascending: false });

    if (error) throw error;
    return (data || []).map(requestFromRow);
  },

  async create(request: any): Promise<any> {
    const supabase = supabaseAdmin();
    const { error } = await supabase
      .from(accessRequestsTable)
      .insert(requestToRow(request));

    if (error) throw error;
    return request;
  },

  async patch(id: string, fields: Record<string, any>): Promise<any> {
    const supabase = supabaseAdmin();
    const rowFields = requestPatchToRow(fields);

    const { data, error } = await supabase
      .from(accessRequestsTable)
      .update(rowFields)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    return data ? requestFromRow(data) : null;
  },

  async findByVerificationCode(code: string): Promise<any | null> {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from(accessRequestsTable)
      .select("*")
      .eq("verification_code", code)
      .eq("status", "Approved")
      .maybeSingle();

    if (error) throw error;
    return data ? requestFromRow(data) : null;
  },
};

const accessRequestsStore = {
  async list(): Promise<any[]> {
    try {
      return await normalizedAccessRequestsStore.list();
    } catch (error) {
      if (isMissingTableError(error)) {
        return legacyAccessRequestsStore.list();
      }
      throw error;
    }
  },

  async create(request: any): Promise<any> {
    try {
      return await normalizedAccessRequestsStore.create(request);
    } catch (error) {
      if (isMissingTableError(error)) {
        return legacyAccessRequestsStore.create(request);
      }
      throw error;
    }
  },

  async patch(id: string, fields: Record<string, any>): Promise<any> {
    try {
      return await normalizedAccessRequestsStore.patch(id, fields);
    } catch (error) {
      if (isMissingTableError(error)) {
        return legacyAccessRequestsStore.patch(id, fields);
      }
      throw error;
    }
  },

  async findByVerificationCode(code: string): Promise<any | null> {
    try {
      return await normalizedAccessRequestsStore.findByVerificationCode(
        code,
      );
    } catch (error) {
      if (isMissingTableError(error)) {
        return legacyAccessRequestsStore.findByVerificationCode(code);
      }
      throw error;
    }
  },
};

const counterStore = {
  async increment(key: string): Promise<number> {
    const supabase = supabaseAdmin();
    try {
      const { data: existing, error: fetchError } = await supabase
        .from(countersTable)
        .select("value")
        .eq("key", key)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const nextValue = Number(existing?.value || 0) + 1;
      const { error: upsertError } = await supabase
        .from(countersTable)
        .upsert(
          { key, value: nextValue },
          { onConflict: "key" },
        );
      if (upsertError) throw upsertError;
      return nextValue;
    } catch (error) {
      if (!isMissingTableError(error)) throw error;

      const currentValue = Number(
        (await kv.get(key)) || 0,
      );
      const nextValue = currentValue + 1;
      await kv.set(key, nextValue);
      return nextValue;
    }
  },
};

console.log("ENV CHECK:", {
  url: Deno.env.get("SB_URL"),
  key: Deno.env.get("SB_SERVICE_ROLE_KEY")
    ? "EXISTS"
    : "MISSING",
});

const app = new Hono();
const functionPath = "/make-server-e75a6481";

app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

app.use("*", logger(console.log));

app.get(functionPath, (c) => {
  return c.json({ message: "SMARTech Server Running" });
});

app.get(`${functionPath}/health`, (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: {
      hasUrl: !!Deno.env.get("SB_URL"),
      hasKey: !!Deno.env.get("SB_SERVICE_ROLE_KEY"),
      url: Deno.env.get("SB_URL"),
    },
  });
});

app.get(`${functionPath}/test`, (c) => {
  return c.json({
    test: "success",
    timestamp: new Date().toISOString(),
  });
});

app.get(`${functionPath}/posts`, async (c) => {
  try {
    const posts = await postsStore.list();
    return c.json({ posts });
  } catch (error: any) {
    console.error("Error fetching posts:", error);
    return c.json(
      {
        error: "Failed to fetch posts",
        details: error?.message || String(error),
        posts: [],
      },
      500,
    );
  }
});

app.post(`${functionPath}/posts`, async (c) => {
  try {
    const newPost = await c.req.json();
    const savedPost = await postsStore.create(newPost);

    return c.json({ success: true, post: savedPost });
  } catch (error) {
    console.error("Error adding post:", error);
    return c.json(
      { error: "Failed to add post", details: String(error) },
      500,
    );
  }
});

app.put(`${functionPath}/posts/:id`, async (c) => {
  try {
    const postId = c.req.param("id");
    const updatedPost = await c.req.json();
    const savedPost = await postsStore.replace(
      postId,
      updatedPost,
    );
    return c.json({ success: true, post: savedPost });
  } catch (error) {
    console.log("Error updating post:", error);
    return c.json({ error: "Failed to update post" }, 500);
  }
});

app.delete(`${functionPath}/posts/:id`, async (c) => {
  try {
    const postId = c.req.param("id");
    await postsStore.delete(postId);
    return c.json({ success: true });
  } catch (error) {
    console.log("Error deleting post:", error);
    return c.json({ error: "Failed to delete post" }, 500);
  }
});

app.post(
  `${functionPath}/posts/:id/central-review`,
  async (c) => {
    try {
      const postId = c.req.param("id");
      const { centralReviewStatus, centralReviewComment } =
        await c.req.json();

      const updatedPost = await postsStore.patch(postId, {
        centralReviewStatus,
        centralReviewComment,
        centralReviewDate: new Date()
          .toISOString()
          .split("T")[0],
      });

      if (!updatedPost) {
        return c.json({ error: "Post not found" }, 404);
      }

      return c.json({ success: true });
    } catch (error) {
      console.log("Error reviewing post:", error);
      return c.json({ error: "Failed to review post" }, 500);
    }
  },
);

app.post(`${functionPath}/posts/:id/appeal`, async (c) => {
  try {
    const postId = c.req.param("id");
    const { appealComment } = await c.req.json();

    const updatedPost = await postsStore.patch(postId, {
      appealStatus: "Appealed",
      appealComment,
      appealDate: new Date().toISOString().split("T")[0],
    });

    if (!updatedPost) {
      return c.json({ error: "Post not found" }, 404);
    }

    return c.json({ success: true });
  } catch (error) {
    console.log("Error appealing post:", error);
    return c.json({ error: "Failed to appeal post" }, 500);
  }
});

app.post(
  `${functionPath}/posts/:id/review-appeal`,
  async (c) => {
    try {
      const postId = c.req.param("id");
      const { approved, centralReviewComment } =
        await c.req.json();

      const updatedPost = await postsStore.patch(postId, {
        appealStatus: approved
          ? "Appeal Approved"
          : "Appeal Rejected",
        centralReviewStatus: approved
          ? "Good for Posting"
          : "For Revision",
        centralReviewComment,
        centralReviewDate: new Date()
          .toISOString()
          .split("T")[0],
      });

      if (!updatedPost) {
        return c.json({ error: "Post not found" }, 404);
      }

      return c.json({ success: true });
    } catch (error) {
      console.log("Error reviewing appeal:", error);
      return c.json({ error: "Failed to review appeal" }, 500);
    }
  },
);

app.get(
  `${functionPath}/profiles/by-email/:email`,
  async (c) => {
    try {
      const email = decodeURIComponent(c.req.param("email"))
        .trim()
        .toLowerCase();
      const supabase = supabaseAdmin();

      const { data, error } = await supabase
        .from("profiles")
        .select("email, office")
        .eq("email", email)
        .maybeSingle();

      if (error) {
        return c.json({ error: error.message }, 500);
      }

      if (!data) {
        return c.json({ error: "Profile not found" }, 404);
      }

      return c.json({ profile: data });
    } catch (error: any) {
      return c.json(
        {
          error: "Failed to fetch profile",
          details: error?.message || String(error),
        },
        500,
      );
    }
  },
);

app.get(`${functionPath}/access-requests`, async (c) => {
  try {
    const requests = await accessRequestsStore.list();
    return c.json({ requests });
  } catch (error) {
    console.log("Error fetching access requests:", error);
    return c.json(
      { error: "Failed to fetch access requests" },
      500,
    );
  }
});

app.post(`${functionPath}/access-requests`, async (c) => {
  try {
    const newRequest = await c.req.json();
    const request = await accessRequestsStore.create(newRequest);
    return c.json({ success: true, request });
  } catch (error) {
    console.log("Error adding access request:", error);
    return c.json(
      { error: "Failed to add access request" },
      500,
    );
  }
});

app.put(`${functionPath}/access-requests/:id`, async (c) => {
  try {
    const requestId = c.req.param("id");
    const { status, verificationCode, ...extraFields } =
      await c.req.json();

    let verificationCodeExpiresAt;
    if (verificationCode) {
      const expirationDate = new Date();
      expirationDate.setMinutes(
        expirationDate.getMinutes() + 15,
      );
      verificationCodeExpiresAt = expirationDate.toISOString();
    }

    const request = await accessRequestsStore.patch(requestId, {
      status,
      verificationCode,
      verificationCodeExpiresAt,
      ...extraFields,
    });

    if (!request) {
      return c.json({ error: "Request not found" }, 404);
    }

    return c.json({ success: true, request });
  } catch (error) {
    console.log("Error updating access request:", error);
    return c.json(
      { error: "Failed to update access request" },
      500,
    );
  }
});

app.post(
  `${functionPath}/access-requests/:id/approve-create-account`,
  async (c) => {
    try {
      const requestId = c.req.param("id");
      const requests = await accessRequestsStore.list();
      const request = requests.find(
        (req: any) => req.id === requestId,
      );

      if (!request) {
        return c.json({ error: "Request not found" }, 404);
      }

      if (request.type !== "create-account") {
        return c.json(
          { error: "Request is not a create-account request" },
          400,
        );
      }

      const supabase = supabaseAdmin();

      const nextPasswordNumber = await counterStore.increment(
        "account_password_counter",
      );
      const temporaryPassword = `nycsmartech${nextPasswordNumber}`;

      const { data: createdUser, error: createError } =
        await supabase.auth.admin.createUser({
          email: request.officeEmail,
          password: temporaryPassword,
          email_confirm: true,
        });

      if (createError || !createdUser.user) {
        return c.json(
          {
            error:
              createError?.message || "Failed to create user",
          },
          500,
        );
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: createdUser.user.id,
          email: request.officeEmail,
          office: request.officeName,
          role: "user",
        });

      if (profileError) {
        return c.json({ error: profileError.message }, 500);
      }

      await accessRequestsStore.patch(
        requestId,
        {
          status: "Approved",
          requestedPassword: temporaryPassword,
        },
      );

      return c.json({
        success: true,
        email: request.officeEmail,
        temporaryPassword,
      });
    } catch (error: any) {
      console.error("Error approving create account:", error);
      return c.json(
        {
          error: "Failed to approve create account",
          details: error?.message || String(error),
        },
        500,
      );
    }
  },
);

app.get(
  `${functionPath}/access-requests/verify/:code`,
  async (c) => {
    try {
      const code = c.req.param("code");
      const request = await accessRequestsStore.findByVerificationCode(
        code,
      );

      if (!request) {
        return c.json(
          { error: "Invalid or expired verification code" },
          404,
        );
      }

      if (request.verificationCodeExpiresAt) {
        const expirationTime = new Date(
          request.verificationCodeExpiresAt,
        );
        const currentTime = new Date();

        if (currentTime > expirationTime) {
          return c.json(
            {
              error:
                "Verification code has expired. Please request a new one.",
            },
            410,
          );
        }
      }

      return c.json({ request });
    } catch (error) {
      console.log("Error verifying code:", error);
      return c.json({ error: "Failed to verify code" }, 500);
    }
  },
);

app.post(`${functionPath}/auth/update-password`, async (c) => {
  try {
    const { email, newPassword } = await c.req.json();

    if (!email || !newPassword) {
      return c.json(
        { error: "Email and new password are required" },
        400,
      );
    }

    const supabase = supabaseAdmin();
    const { data, error: listError } =
      await supabase.auth.admin.listUsers();

    if (listError) {
      console.log("Error listing users:", listError);
      return c.json({ error: "Failed to find user" }, 500);
    }

    const user = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    const { error: updateError } =
      await supabase.auth.admin.updateUserById(user.id, {
        password: newPassword,
      });

    if (updateError) {
      console.log("Error updating password:", updateError);
      return c.json(
        { error: "Failed to update password" },
        500,
      );
    }

    return c.json({ success: true });
  } catch (error) {
    console.log("Error updating password:", error);
    return c.json({ error: "Failed to update password" }, 500);
  }
});

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json(
    {
      error: "Internal server error",
      message: err.message,
      stack: err.stack,
    },
    500,
  );
});

app.notFound((c) => {
  console.log("404 - Path not found:", c.req.url);
  return c.json({ error: "Not found", path: c.req.path }, 404);
});

Deno.serve(app.fetch);
