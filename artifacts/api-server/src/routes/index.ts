import { Router, type IRouter } from "express";
import healthRouter from "./health";
import euroleagueRouter from "./euroleague";
import cricketRouter from "./cricket";

const router: IRouter = Router();

router.use(healthRouter);
router.use(euroleagueRouter);
router.use(cricketRouter);

export default router;
