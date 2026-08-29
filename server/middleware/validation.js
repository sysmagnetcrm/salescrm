import { body, param, query, validationResult } from 'express-validator';

/**
 * Handle validation errors gracefully without exposing stack traces
 */
export const validateResult = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
};

/**
 * Validation rules for lead creation / updates
 */
export const validateLeadPayload = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty'),
  body('phone')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Phone cannot be empty'),
  body('country')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Country cannot be empty'),
  body('email')
    .optional({ checkFalsy: true })
    .isEmail()
    .withMessage('Must be a valid email address'),
  body('value')
    .optional({ nullable: true })
    .custom(val => {
      if (val === '' || val === null || val === undefined) return true;
      const num = Number(val);
      if (isNaN(num) || !isFinite(num)) {
        throw new Error('Financial value must be a valid numeric number');
      }
      if (num < 0) {
        throw new Error('Financial value cannot be negative');
      }
      return true;
    }),
  validateResult
];

/**
 * Validation rules for user creation / update
 */
export const validateUserPayload = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Must be a valid email address'),
  body('password')
    .optional()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('role')
    .optional()
    .isIn(['admin', 'accountant', 'salesperson'])
    .withMessage('Invalid role'),
  body('branch')
    .optional()
    .isIn(['kochi', 'chennai'])
    .withMessage('Invalid branch'),
  body('monthlyTarget')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Monthly target must be a non-negative number'),
  body('weeklyTarget')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Weekly target must be a non-negative number'),
  validateResult
];
