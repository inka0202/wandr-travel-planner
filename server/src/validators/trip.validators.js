import { body, param } from 'express-validator';
import { checkStartDate, checkEndDate } from '../utils/tripDates.js';

export const MAX_ATTRACTIONS = 50;

// Turns a pure check (returns message or null) into an express-validator custom rule
const rule = (check) => (value, meta) => {
  const message = check(value, meta);
  if (message) throw new Error(message);
  return true;
};

export const createTripValidator = [
  body('destination.name')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Destination name is required')
    .isLength({ max: 100 })
    .withMessage('Destination name too long'),
  body('destination.country')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 80 })
    .withMessage('Country too long'),
  body('destination.latitude').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('destination.longitude').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),

  body('startDate')
    .isISO8601({ strict: true, strictSeparator: true })
    .withMessage('startDate must be a valid date (YYYY-MM-DD)')
    .bail()
    .custom(rule((value) => checkStartDate(value))),
  body('endDate')
    .isISO8601({ strict: true, strictSeparator: true })
    .withMessage('endDate must be a valid date (YYYY-MM-DD)')
    .bail()
    .custom(rule((value, { req }) => checkEndDate(req.body.startDate, value))),

  body('notes').optional().isString().isLength({ max: 1000 }).withMessage('Notes too long'),

  body('savedAttractions')
    .optional()
    .isArray({ max: MAX_ATTRACTIONS })
    .withMessage(`Maximum ${MAX_ATTRACTIONS} attractions per trip`),
  body('savedAttractions.*')
    .isObject()
    .withMessage('Each saved attraction must be an object'),
  body('savedAttractions.*.xid')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Attraction xid is required')
    .isLength({ max: 64 })
    .withMessage('Attraction xid too long'),
  body('savedAttractions.*.name')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Attraction name is required')
    .isLength({ max: 200 })
    .withMessage('Attraction name too long'),
  body('savedAttractions.*.latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid attraction latitude'),
  body('savedAttractions.*.longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid attraction longitude'),
  body('savedAttractions.*.kind')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 60 })
    .withMessage('Attraction kind too long'),
  body('savedAttractions.*.address')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 300 })
    .withMessage('Attraction address too long'),
];

export const tripIdValidator = [param('id').isMongoId().withMessage('Invalid trip id')];

export const updateNotesValidator = [
  ...tripIdValidator,
  body('notes').isString().isLength({ max: 1000 }),
];
