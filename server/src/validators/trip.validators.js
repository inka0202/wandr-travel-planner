import { body, param } from 'express-validator';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const createTripValidator = [
  body('destination.name')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Destination name is required')
    .isLength({ max: 100 })
    .withMessage('Destination name too long'),
  body('destination.country').optional().isString().trim().isLength({ max: 80 }),
  body('destination.latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),
  body('destination.longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude'),
  body('startDate').matches(ISO_DATE).withMessage('startDate must be YYYY-MM-DD'),
  body('endDate')
    .matches(ISO_DATE)
    .withMessage('endDate must be YYYY-MM-DD')
    .custom((value, { req }) => {
      if (new Date(value) < new Date(req.body.startDate)) {
        throw new Error('endDate must be on or after startDate');
      }
      return true;
    }),
  body('notes').optional().isString().isLength({ max: 1000 }),
  body('savedAttractions')
    .optional()
    .isArray({ max: 50 })
    .withMessage('Maximum 50 attractions per trip'),
  body('savedAttractions.*.xid').optional().isString(),
  body('savedAttractions.*.name').optional().isString(),
  body('savedAttractions.*.latitude').optional().isFloat({ min: -90, max: 90 }),
  body('savedAttractions.*.longitude').optional().isFloat({ min: -180, max: 180 }),
];

export const tripIdValidator = [
  param('id').isMongoId().withMessage('Invalid trip id'),
];

export const updateNotesValidator = [
  ...tripIdValidator,
  body('notes').isString().isLength({ max: 1000 }),
];
