export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);

    // Map "/" to "/index.html"
    if (url.pathname === "/") {
      return env.ASSETS.fetch(
        new Request(new URL("/index.html", url), request),
      );
    }

    // For everything else, try static assets first
    const assetResp = await env.ASSETS.fetch(request);
    if (assetResp.status !== 404) return assetResp;

    return new Response("Not found", { status: 404 });
  },
};
