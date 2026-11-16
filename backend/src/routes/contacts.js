const router = require('express').Router();
const { protect } = require('../middleware/auth');
const c = require('../controllers/contactController');

router.use(protect);

router.get('/', c.list);
router.get('/:id', c.get);
router.post('/', c.create);
router.post('/import', c.importMany);
router.post('/:id/activities', c.addActivity);
router.post('/:id/purchases', c.addPurchase);
router.patch('/:id', c.update);
router.delete('/:id', c.remove);

module.exports = router;
