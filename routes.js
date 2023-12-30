import express from 'express';
import controller from './controller.js';
const router=express.Router();


router.get('/mail/new', controller.checkForNewEmails);

router.get('/mail/run', controller.run);

export default router;

