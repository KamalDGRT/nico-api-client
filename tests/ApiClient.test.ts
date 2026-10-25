import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiClient,
  ApiError,
  createPublicFetcher,
  errorMessage,
  parseJsonOrThrow,
  parseTextOrThrow,
} from "../src";

const STATUS_NO_CONTENT = 204;
const STATUS_CONFLICT = 409;
const STATUS_UNPROCESSABLE = 422;
const STATUS_BAD_GATEWAY = 502;
const PATH = "/x";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("parseJsonOrThrow", () => {
  it("returns the parsed body on success", async () => {
    expect(await parseJsonOrThrow(json({ a: 1 }))).toEqual({ a: 1 });
  });

  it("returns undefined for 204 No Content instead of failing on empty body", async () => {
    const res = new Response(null, { status: STATUS_NO_CONTENT });
    expect(await parseJsonOrThrow(res)).toBeUndefined();
  });

  it("throws ApiError carrying the API's error detail and status", async () => {
    const res = json({ errors: [{ detail: "Already a member" }] }, STATUS_CONFLICT);
    await expect(parseJsonOrThrow(res)).rejects.toMatchObject({
      message: "Already a member",
      status: STATUS_CONFLICT,
    });
  });

  it("joins several error details into one message", async () => {
    const res = json({ errors: [{ detail: "a" }, { detail: "b" }] }, STATUS_UNPROCESSABLE);
    await expect(parseJsonOrThrow(res)).rejects.toThrow("a b");
  });

  it("exposes every server message in messages, one per error", async () => {
    const res = json({ errors: [{ detail: "title: too long" }, { detail: "slug: bad" }] }, STATUS_UNPROCESSABLE);
    const error = (await parseJsonOrThrow(res).catch((e) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.messages).toEqual(["title: too long", "slug: bad"]);
    expect(error.message).toBe("title: too long slug: bad");
  });

  it("messages holds the generic fallback when the body has no details", async () => {
    const error = (await parseJsonOrThrow(json({ errors: [] }, 400)).catch((e) => e)) as ApiError;
    expect(error.messages).toEqual(["Request failed"]);
  });

  it("uses a plain string body as the message", async () => {
    await expect(parseJsonOrThrow(json("plain failure", 400))).rejects.toThrow(
      "plain failure",
    );
  });

  it("falls back to a generic message for an empty errors array", async () => {
    await expect(parseJsonOrThrow(json({ errors: [] }, 400))).rejects.toThrow(
      "Request failed",
    );
  });

  it("falls back to a generic message when the body is not the API shape", async () => {
    const res = new Response("<html>bad gateway</html>", { status: STATUS_BAD_GATEWAY });
    await expect(parseJsonOrThrow(res)).rejects.toMatchObject({
      message: "Request failed",
      status: STATUS_BAD_GATEWAY,
    });
  });
});

describe("parseTextOrThrow", () => {
  it("returns the raw text body on success", async () => {
    expect(await parseTextOrThrow(new Response("<p>hi</p>"))).toBe("<p>hi</p>");
  });

  it("throws the same ApiError shape on failure", async () => {
    const res = json({ errors: [{ detail: "no preview" }] }, 404);
    await expect(parseTextOrThrow(res)).rejects.toMatchObject({
      message: "no preview",
      status: 404,
    });
  });
});

describe("errorMessage", () => {
  it("uses the server message for ApiError", () => {
    expect(errorMessage(new ApiError("nope", 400), "fallback")).toBe("nope");
  });

  it("uses the fallback for anything else (network failure)", () => {
    expect(errorMessage(new TypeError("Failed to fetch"), "fallback")).toBe("fallback");
  });
});

describe("createPublicFetcher", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("prefixes the base url and passes init through to fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({}));
    vi.stubGlobal("fetch", fetchMock);
    await createPublicFetcher("https://api.test")(PATH, { method: "POST" });
    expect(fetchMock).toHaveBeenCalledWith("https://api.test/x", { method: "POST" });
  });
});

describe("ApiClient verbs", () => {
  class Probe extends ApiClient {
    getIt(headers?: Record<string, string>) {
      return this.get(PATH, headers);
    }
    getTextIt() {
      return this.getText(PATH);
    }
    postIt(headers?: Record<string, string>) {
      return this.post(PATH, { a: 1 }, headers);
    }
    putIt() {
      return this.put(PATH, { a: 2 });
    }
    patchIt() {
      return this.patch(PATH, { a: 3 });
    }
    postRawIt(body: FormData | URLSearchParams) {
      return this.post(PATH, body);
    }
    deleteIt() {
      return this.delete(PATH);
    }
    deleteWithBodyIt() {
      return this.delete(PATH, { ids: [1] });
    }
  }

  const probeWith = (response: () => Response) => {
    const fetcher = vi.fn().mockImplementation(async () => response());
    return { fetcher, probe: new Probe(fetcher) };
  };

  it("sends method, JSON body and content type for POST and PUT; plain GET has no init", async () => {
    const { fetcher, probe } = probeWith(() => json({}));
    await probe.getIt();
    await probe.postIt();
    await probe.putIt();

    expect(fetcher.mock.calls).toEqual([
      [PATH, undefined],
      [PATH, { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"a":1}' }],
      [PATH, { method: "PUT", headers: { "Content-Type": "application/json" }, body: '{"a":2}' }],
    ]);
  });

  it("PATCH sends a JSON body", async () => {
    const { fetcher, probe } = probeWith(() => json({}));
    await probe.patchIt();
    expect(fetcher).toHaveBeenCalledWith(PATH, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: '{"a":3}',
    });
  });

  it("sends URLSearchParams and FormData untouched with no Content-Type", async () => {
    const { fetcher, probe } = probeWith(() => json({}));
    const form = new URLSearchParams({ username: "a@b.co" });
    const upload = new FormData();
    upload.append("file", new Blob(["x"]), "x.png");
    await probe.postRawIt(form);
    await probe.postRawIt(upload);
    expect(fetcher.mock.calls[0][1]).toEqual({ method: "POST", headers: {}, body: form });
    expect(fetcher.mock.calls[0][1].body).toBe(form);
    expect(fetcher.mock.calls[1][1].headers).toEqual({});
    expect(fetcher.mock.calls[1][1].body).toBe(upload);
  });

  it("DELETE without a body sends neither body nor content type", async () => {
    const { fetcher, probe } = probeWith(() => new Response(null, { status: STATUS_NO_CONTENT }));
    await expect(probe.deleteIt()).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith(PATH, { method: "DELETE", headers: {} });
  });

  it("DELETE with a body sends it as JSON", async () => {
    const { fetcher, probe } = probeWith(() => json({}));
    await probe.deleteWithBodyIt();
    expect(fetcher).toHaveBeenCalledWith(PATH, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: '{"ids":[1]}',
    });
  });

  it("extra headers are merged over the defaults", async () => {
    const { fetcher, probe } = probeWith(() => json({}));
    await probe.getIt({ "If-Match": "v1" });
    await probe.postIt({ "Content-Type": "application/merge-patch+json", "X-Key": "k" });
    expect(fetcher.mock.calls).toEqual([
      [PATH, { headers: { "If-Match": "v1" } }],
      [PATH, {
        method: "POST",
        headers: { "Content-Type": "application/merge-patch+json", "X-Key": "k" },
        body: '{"a":1}',
      }],
    ]);
  });

  it("getText returns raw text and throws ApiError on failure", async () => {
    expect(await probeWith(() => new Response("<p>ok</p>")).probe.getTextIt()).toBe("<p>ok</p>");
    const failing = probeWith(() => json({ errors: [{ detail: "gone" }] }, 410)).probe;
    await expect(failing.getTextIt()).rejects.toMatchObject({ message: "gone", status: 410 });
  });

  it("verbs surface server errors as ApiError", async () => {
    const { probe } = probeWith(() => json({ errors: [{ detail: "dup" }] }, STATUS_CONFLICT));
    await expect(probe.postIt()).rejects.toMatchObject({ message: "dup", status: STATUS_CONFLICT });
  });
});
