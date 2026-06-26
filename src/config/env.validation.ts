import * as Joi from 'joi'

export const validationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().required(),
  VERIFY_TOKEN: Joi.string().required(),
  WHATSAPP_TOKEN: Joi.string().required(),
  WHATSAPP_PHONE_NUMBER_ID: Joi.string().required(),
  GOOGLE_SHEET_ID: Joi.string().required(),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: Joi.string().email().required(),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: Joi.string().required(),
  GOOGLE_SHEET_RANGE: Joi.string().required(),
  OPENROUTER_API_KEY: Joi.string().required(),
  OPENROUTER_MODEL: Joi.string().required(),
  BOT_BUSINESS_NAME: Joi.string().required(),
})
