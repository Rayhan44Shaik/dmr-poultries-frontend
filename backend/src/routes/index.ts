import { Router } from "express";
import { healthRouter } from "./health.js";
import { mastersRouter } from "./masters.js";
import { tripsRouter } from "./trips.js";
import { staffRouter } from "./staff.js";
import { authRouter, requireScoped } from "./auth.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/health", healthRouter);
// Everything below this line requires a signed-in session; supervisors are
// additionally held to their entry-workspace whitelist (see auth.ts).
apiRouter.use(requireScoped);
apiRouter.use("/masters", mastersRouter);
apiRouter.use("/trips", tripsRouter);
apiRouter.use("/staff", staffRouter);
