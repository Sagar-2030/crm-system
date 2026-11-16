const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const c = require('../controllers/reportController');

router.use(protect, authorize('superadmin', 'manager'));

router.get('/overview', c.overview);
router.get('/team', c.team);

module.exports = router;
