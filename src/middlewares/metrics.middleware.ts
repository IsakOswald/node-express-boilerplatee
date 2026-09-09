import type { NextFunction, Request, Response } from "express";

import { httpRequestDurationSeconds, httpRequestsTotal } from "@/configs/metrics.config";

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const end = httpRequestDurationSeconds.startTimer();

  res.on("finish", () => {
    const route = req.path;

    const labels = {
      method: req.method,
      route,
      status_code: res.statusCode.toString(),
    };

    httpRequestsTotal.inc(labels);
    end(labels);
  });

  next();
};
