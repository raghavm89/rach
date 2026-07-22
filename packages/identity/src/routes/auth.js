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
  resetPasswordLimiter,
} = require('@rach/core').rateLimit;

// ── Shared validators ─────────────────────────────────────────────────────────

// normalizeEmail with gmail dot/subaddress folding disabled: we want
// case-insensitivity, not identity merging across distinct addresses.
const emailField = (field = 'email') =>
  body(field)
    .isEmail().withMessage('Valid email is required')
    .bail()
    .normalizeEmail({
      gmail_remove_dots:       false,
      gmail_remove_subaddress: false,
      all_lowercase:           true,
    });

// Minimum was 6 with no composition rules. 10 with a mixed-character
// requirement is the floor; length carries most of the strength.
const passwordField = (field = 'password') =>
  body(field)
    .isLength({ min: 10 }).withMessage('Password must be at least 10 characters')
    .bail()
    .matches(/[a-zA-Z]/).withMessage('Password must contain a letter')
    .bail()
    .matches(/[0-9!@#$%^&*(),.?":{}|<>_\-+=[\]\\/~`';]/)
    .withMessage('Password must contain a number or symbol');
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
    body('name').trim().notEmpty().withMessage('Name is required')
      .isLength({ max: 100 }).withMessage('Name is too long'),
    emailField(),
    passwordField(),
    body('phone_number').optional({ checkFalsy: true }).trim(),
    body('address').optional().trim().isLength({ max: 500 }).withMessage('Address is too long'),
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
    emailField(),
    // Deliberately not passwordField(): the policy applies to passwords being
    // set, not to ones being checked. Rejecting a short password at login would
    // tell an attacker the policy predates the account.
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
  [emailField()],
  forgotPassword
);

router.post(
  '/reset-password',
  resetPasswordLimiter,
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    passwordField(),
  ],
  resetPassword
);

module.exports = router;
