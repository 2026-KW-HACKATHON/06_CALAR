const express = require('express');
const auth = require('./auth');
const kakao = require('../services/kakaoPayService');
const router = express.Router();
router.use(auth.requireUser);
router.post('/kakaopay/ready', async (req, res) => res.json(await kakao.ready(req.user.id, req.body)));
router.post('/kakaopay/approve', async (req, res) => res.json(await kakao.approve(req.user.id, req.body)));
module.exports = router;
