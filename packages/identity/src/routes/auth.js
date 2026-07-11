const { Router } = require('express');
const { body } = require('express-validator');
const authenticate = require('../middleware/auth');
const {
  loginLimiter,
  registerLimiter,
  otpVerifyLimiter,
  otpResendLimiter,
  refreshLimiter,
  forgotPasswordLimiter,
} = require('@rach/core').rateLimit;
const {
  register,
  verifyEmail,
  resendVerification,
  verifyPhone,
  resendOtp,
  login,
  refresh,
  logout,
  logoutAll,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');

const router = Router();

router.post(
  '/register',
  registerLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('phone_number').optional({ checkFalsy: true }).trim(),
    body('address').optional().trim(),
  ],
  register
);

// OTP-based email verification — pending_id + 6-digit code entered by the user
router.post(
  '/verify-email',
  otpVerifyLimiter,
  [
    body('pending_id').isInt({ gt: 0 }).withMessage('Valid pending_id is required'),
    body('code').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Code must be 6 digits'),
  ],
  verifyEmail
);

// Resend the verification OTP
router.post(
  '/resend-verification',
  otpResendLimiter,
  [body('pending_id').isInt({ gt: 0 }).withMessage('Valid pending_id is required')],
  resendVerification
);

router.post(
  '/verify-phone',
  otpVerifyLimiter,
  [
    body('user_id').isInt({ gt: 0 }).withMessage('Valid user_id is required'),
    body('code').isLength({ min: 6, max: 6 }).withMessage('Code must be 6 digits'),
  ],
  verifyPhone
);

router.post(
  '/resend-otp',
  otpResendLimiter,
  [body('user_id').isInt({ gt: 0 }).withMessage('Valid user_id is required')],
  resendOtp
);

router.post(
  '/login',
  loginLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  login
);

// Refresh token is read from the HttpOnly cookie automatically
router.post('/refresh', refreshLimiter, refresh);

// Logout routes require a valid access token
router.post('/logout',     authenticate, logout);
router.post('/logout-all', authenticate, logoutAll);

// Password reset
router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  [body('email').isEmail().withMessage('Valid email is required')],
  forgotPassword
);

router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  resetPassword
);

module.exports = router;
