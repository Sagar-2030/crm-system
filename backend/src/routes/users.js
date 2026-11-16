const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const c = require('../controllers/userController');

router.use(protect, authorize('superadmin', 'manager'));

router.get('/', c.list);
router.post('/', c.create);
router.patch('/:id', c.update);

module.exports = router;
