import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import leadsRouter from "./leads.js";
import manualLeadsRouter from "./manual-leads.js";
import pipelineRouter from "./pipeline.js";
import enrollmentsRouter from "./enrollments.js";
import paymentsRouter from "./payments.js";
import usersRouter from "./users.js";
import coachesRouter from "./coaches.js";
import adminsRouter from "./admins.js";
import seancesRouter from "./seances.js";
import groupsRouter from "./groups.js";
import presencesRouter from "./presences.js";
import eventsRouter from "./events.js";
import galleryRouter from "./gallery.js";
import settingsRouter from "./settings.js";
import whatsappStatusRouter from "./whatsapp.js";
import storageRouter from "./storage.js";
import historyRouter from "./history.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
// WhatsApp webhook routes must come before generic pipeline routes
router.use(pipelineRouter);
router.use(manualLeadsRouter);
router.use(leadsRouter);
router.use(enrollmentsRouter);
router.use(paymentsRouter);
router.use(usersRouter);
router.use(coachesRouter);
router.use(adminsRouter);
router.use(seancesRouter);
router.use(groupsRouter);
router.use(presencesRouter);
router.use(eventsRouter);
router.use(galleryRouter);
router.use(settingsRouter);
router.use(whatsappStatusRouter);
router.use(storageRouter);
router.use(historyRouter);

export default router;
