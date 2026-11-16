const router = require('express').Router();
const { protect } = require('../middleware/auth');
const c = require('../controllers/authController');

router.post('/login', c.login);
router.get('/me', protect, c.me);
router.patch('/profile', protect, c.updateProfile);
router.post('/change-password', protect, c.changePassword);

module.exports = router;
