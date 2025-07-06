import swaggerJsdoc from 'swagger-jsdoc'

const options = {
  definition: {
    openapi: '3.1.0',
    info: {
      title: process.env.NPM_PACKAGE_NAME ?? 'TrustVault API Gateway',
      version: process.env.NPM_PACKAGE_VERSION ?? '0.0.0',
    },
  },
  apis: ['src/routes/**/*.ts'],
}

const openapiSpec = swaggerJsdoc(options)

export default openapiSpec
