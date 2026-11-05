import type { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';

export default function handler(req: Request | any, res: Response | any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const publicVersionFile = path.join(process.cwd(), 'public', 'version.json');
    if (fs.existsSync(publicVersionFile)) {
      const data = JSON.parse(fs.readFileSync(publicVersionFile, 'utf-8'));
      return res.status(200).json(data);
    }

    const distVersionFile = path.join(process.cwd(), 'dist', 'version.json');
    if (fs.existsSync(distVersionFile)) {
      const data = JSON.parse(fs.readFileSync(distVersionFile, 'utf-8'));
      return res.status(200).json(data);
    }

    const pkgFile = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(pkgFile)) {
      const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf-8'));
      return res.status(200).json({
        version: pkg.version || '1.2.0',
        forceUpdate: true,
        mandatory: true,
        bundlePath: '/ota-bundle.zip',
        timestamp: new Date().toISOString(),
      });
    }
  } catch {
    // fallback
  }

  return res.status(200).json({
    version: process.env.VERCEL_GIT_COMMIT_SHA || 'v-latest',
    forceUpdate: true,
    bundlePath: '/ota-bundle.zip',
    timestamp: new Date().toISOString(),
  });
}

