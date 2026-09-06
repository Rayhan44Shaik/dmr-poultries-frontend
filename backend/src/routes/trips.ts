import { Router } from "express";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import { availableTripResources, changeStatus, persistDiesel } from "../services/tripWorkflowService.js";
import { sendAssignmentWhatsApp } from "../services/ordersWhatsAppService.js";
import { tripsService } from "../services/tripsService.js";

export const tripsRouter = Router();
tripsRouter.param('id',(req,_res,next,value)=>{
  if (!Number.isInteger(Number(value)) || Number(value)<=0) return next(new AppError(400,'A positive backend trip ID is required'));
  next();
});
tripsRouter.get('/available-resources',asyncHandler(async(req,res)=>{res.json(await availableTripResources(Number(req.query.tripId)||0));}));
tripsRouter.put('/:id/deliveries',asyncHandler(async(req,res)=>{res.json(await tripsService.saveWizardStep(Number(req.params.id),'deliveries',req.body,'save'));}));
tripsRouter.patch('/:id/status',asyncHandler(async(req,res)=>{res.json(await changeStatus(Number(req.params.id),req.body.status,req.body.approvedBy));}));
tripsRouter.post('/:id/diesel',asyncHandler(async(req,res)=>{res.json(await persistDiesel(Number(req.params.id),req.body));}));
tripsRouter.patch('/:id/diesel/:entryId',asyncHandler(async(req,res)=>{res.json(await persistDiesel(Number(req.params.id),req.body,Number(req.params.entryId)));}));
tripsRouter.delete('/:id/diesel/:entryId',asyncHandler(async(req,res)=>{res.json(await persistDiesel(Number(req.params.id),null,Number(req.params.entryId),true));}));
tripsRouter.post('/:id/whatsapp',asyncHandler(async(req,res)=>{res.json(await sendAssignmentWhatsApp(Number(req.params.id),req.body));}));

tripsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(
      await tripsService.list({
        fromDate: typeof req.query.fromDate === "string" ? req.query.fromDate : undefined,
        toDate: typeof req.query.toDate === "string" ? req.query.toDate : undefined,
        status: typeof req.query.status === "string" ? req.query.status : undefined,
        vehicleId: req.query.vehicleId ? Number(req.query.vehicleId) : undefined,
        includeDeleted: req.query.includeDeleted === "true",
      })
    );
  })
);

tripsRouter.get(
  "/vehicle/:vehicleId/last-meter",
  asyncHandler(async (req, res) => {
    res.json(await tripsService.lastClosingMeter(Number(req.params.vehicleId)));
  })
);

/** Final Step 1 submission — must be registered before /:id. */
tripsRouter.post(
  "/steps/start",
  asyncHandler(async (req, res) => {
    res.status(201).json(await tripsService.createSubmittedStartStep({...req.body,requestKey:req.get("Idempotency-Key") || undefined}));
  })
);

tripsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await tripsService.getById(Number(req.params.id)));
  })
);

tripsRouter.post(
  "/:id/steps/:step",
  asyncHandler(async (req, res) => {
    const step = req.params.step;
    if (!["start", "farm", "pickup", "deliveries", "expenses"].includes(step)) {
      throw new AppError(400, "Invalid step. Use start|farm|pickup|deliveries|expenses");
    }
    const mode = req.body?.mode === "save" ? "save" : "submit";
    res.json(
      await tripsService.saveWizardStep(
        Number(req.params.id),
        step as "start" | "farm" | "pickup" | "deliveries" | "expenses",
        req.body,
        mode
      )
    );
  })
);

tripsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(
      await tripsService.softDelete(
        Number(req.params.id),
        typeof req.body?.reason === "string" ? req.body.reason : undefined
      )
    );
  })
);
