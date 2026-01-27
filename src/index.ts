export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);

    // Serve only "/" from assets, keep everything else minimal.
    if (url.pathname === "/") {
      // Fetch from the bound ASSETS (static assets).
      return env.ASSETS.fetch(
        new Request(new URL("/index.html", url), request),
      );
    }

    return new Response("Not found", { status: 404 });
  },
};
