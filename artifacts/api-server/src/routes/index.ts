import { Router, type IRouter } from "express";
import healthRouter from "./health";
import euroleagueRouter from "./euroleague";

const router: IRouter = Router();

router.use(healthRouter);
router.use(euroleagueRouter);

export default router;
