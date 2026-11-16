const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const c = require('../controllers/settingsController');

router.use(protect);
router.get('/', c.get);
router.patch('/', authorize('superadmin', 'manager'), c.update);

module.exports = router;
