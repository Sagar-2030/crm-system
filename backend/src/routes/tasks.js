const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const c = require('../controllers/taskController');

router.use(protect);

router.get('/notifications', c.notifications);
router.get('/', c.list);
router.post('/', c.create);
router.patch('/:id', c.update);
router.delete('/:id', authorize('superadmin', 'manager'), c.remove);

module.exports = router;
