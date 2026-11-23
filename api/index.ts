import type { Request, Response } from "express";
import { createApp, ensureServerReady } from "../server.ts";

let appPromise: Promise<ReturnType<typeof createApp>> | null = null;

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      await ensureServerReady();
      return createApp();
    })();
  }
  return appPromise;
}

export default async function handler(req: Request, res: Response) {
  const app = await getApp();
  return app(req, res);
}
