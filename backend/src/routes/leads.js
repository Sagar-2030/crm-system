const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const c = require('../controllers/leadController');

router.use(protect);

router.get('/', c.list);
router.get('/board', c.board);
router.post('/', c.create);
router.post('/import', c.importMany);
router.post('/:id/convert', c.convert);
router.get('/:id', c.get);
router.patch('/:id', c.update);
router.patch('/:id/stage', c.setStage);
router.patch('/:id/assign', authorize('superadmin', 'manager'), c.assign);
router.post('/:id/activities', c.addActivity);
router.delete('/:id', authorize('superadmin', 'manager'), c.remove);

module.exports = router;
